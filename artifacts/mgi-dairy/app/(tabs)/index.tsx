import React, { useState, useMemo, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, TextInput, Modal, Alert, Platform, useColorScheme,
  KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useApp, MealEntry, CustomActivity } from "@/context/AppContext";
import {
  useDateString, formatTimeFromDate, formatDisplayDate,
  mlToGallons, calcSleepHours, calcSleepHoursNum,
  getProgressColor,
} from "@/hooks/useDateString";
import { SimpleTimeInput, parse24h } from "@/components/WheelPicker";

const GAL_PRESETS = [
  { label: "0.5 gal", ml: 1893 },
  { label: "1 gal", ml: 3785 },
  { label: "1.5 gal", ml: 5678 },
  { label: "2 gal", ml: 7571 },
];
const SLEEP_PRESETS = [6, 7, 8, 9];
const EXERCISE_PRESETS = [20, 30, 45, 60];
const WEIGHT_KG_PRESETS = [50, 60, 70, 80, 90, 100];

function getMealImages(meal: MealEntry): string[] {
  const imgs = meal.images ?? [];
  if (imgs.length > 0) return imgs;
  if (meal.imagePath) return [meal.imagePath];
  return [];
}

function KbSheet({ visible, onClose, title, children, insets, scrollable }: {
  visible: boolean; onClose: () => void; title: string; children: React.ReactNode;
  insets: { bottom: number }; scrollable?: boolean;
}) {
  const inner = (
    <View style={[shStyles.sheet, { paddingBottom: insets.bottom + 16 }]}>
      <View style={shStyles.handle} />
      <Text style={shStyles.title}>{title}</Text>
      {children}
    </View>
  );
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={shStyles.overlay}>
          <TouchableWithoutFeedback onPress={onClose}><View style={StyleSheet.absoluteFill} /></TouchableWithoutFeedback>
          {scrollable ? (
            <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ flexGrow: 0 }}>
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>{inner}</TouchableWithoutFeedback>
            </ScrollView>
          ) : (
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>{inner}</TouchableWithoutFeedback>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const shStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "92%" },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E0D8F0", alignSelf: "center", marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "700" as const, marginBottom: 16, color: "#1A1A2E" },
});

function Simple24hInput({ value, onChange, colors }: { value: string; onChange: (v: string) => void; colors: any }) {
  const [text, setText] = React.useState(value || "22:00");
  React.useEffect(() => { setText(value); }, [value]);
  const tryEmit = (t: string) => {
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (m) {
      const h = parseInt(m[1], 10); const mn = parseInt(m[2], 10);
      if (h >= 0 && h <= 23 && mn >= 0 && mn <= 59)
        onChange(`${String(h).padStart(2, "0")}:${String(mn).padStart(2, "0")}`);
    }
  };
  return (
    <TextInput value={text} onChangeText={(t) => { setText(t); tryEmit(t); }}
      placeholder="22:00" keyboardType="numbers-and-punctuation" maxLength={5}
      style={{ width: 88, height: 40, borderRadius: 10, paddingHorizontal: 10, fontSize: 16, fontWeight: "600" as const, backgroundColor: colors.inputBg, color: colors.text }} />
  );
}

function GoalProgressBar({ pct }: { pct: number }) {
  const color = getProgressColor(pct);
  return (
    <View style={[styles.progressTrack, { backgroundColor: "rgba(0,0,0,0.08)" }]}>
      <View style={[styles.progressFill, { width: `${Math.min(pct, 100)}%` as any, backgroundColor: color }]} />
    </View>
  );
}

function NutritionBadge({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <View style={[styles.nutBadge, { backgroundColor: color + "18", borderColor: color + "40", borderWidth: 1 }]}>
      <Text style={[styles.nutBadgeText, { color }]}>{value}{unit} {label}</Text>
    </View>
  );
}

export default function DiaryScreen() {
  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const today = useDateString();

  const {
    meals, waterEntries, sleepLogs, weightLogs,
    addMeal, updateMeal, deleteMeal,
    addWaterEntry, deleteWaterEntry, updateWaterEntry,
    addSleepLog, updateSleepLog,
    saveExerciseLog, getTodayExercise,
    saveWeightEntry, deleteWeightEntry, getWeightEntry,
    waterGoalMl, setWaterGoalMl,
    sleepGoalHours, setSleepGoalHours,
    exerciseGoalMinutes, setExerciseGoalMinutes,
    weightGoalKg, setWeightGoalKg,
    calorieGoal, proteinGoal, carbsGoal, fatsGoal, fiberGoal,
    setCalorieGoal, setProteinGoal, setCarbsGoal, setFatsGoal, setFiberGoal,
  } = useApp();

  const todayMeals = useMemo(() => meals.filter((m) => m.date === today).sort((a, b) => a.time.localeCompare(b.time)), [meals, today]);
  const todayWaterTotal = useMemo(() => waterEntries.filter((w) => w.date === today).reduce((sum, w) => sum + w.amountMl, 0), [waterEntries, today]);
  const todaySleep = useMemo(() => sleepLogs.find((s) => s.date === today), [sleepLogs, today]);
  const todayExercise = useMemo(() => getTodayExercise(today), [getTodayExercise, today]);
  const todayWeight = useMemo(() => getWeightEntry(today), [getWeightEntry, today]);

  const todayNutrition = useMemo(() => {
    return todayMeals.reduce((acc, m) => ({
      calories: acc.calories + (m.calories ?? 0),
      protein: acc.protein + (m.protein ?? 0),
      carbs: acc.carbs + (m.carbs ?? 0),
      fats: acc.fats + (m.fats ?? 0),
      fiber: acc.fiber + (m.fiber ?? 0),
    }), { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 });
  }, [todayMeals]);

  const [showMealModal, setShowMealModal] = useState(false);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [showWaterModal, setShowWaterModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showSleepSheet, setShowSleepSheet] = useState(false);
  const [showSleepGoalModal, setShowSleepGoalModal] = useState(false);
  const [showExerciseSheet, setShowExerciseSheet] = useState(false);
  const [showExerciseGoalModal, setShowExerciseGoalModal] = useState(false);
  const [showWeightSheet, setShowWeightSheet] = useState(false);
  const [showWeightGoalModal, setShowWeightGoalModal] = useState(false);
  const [showNutritionGoalModal, setShowNutritionGoalModal] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState<string | null>(null);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [waterUnit, setWaterUnit] = useState<"ml" | "gal">("ml");
  const [sleepTimeFormat, setSleepTimeFormat] = useState<"12h" | "24h">("12h");
  const [mealTimeFormat, setMealTimeFormat] = useState<"12h" | "24h">("12h");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">("kg");

  const [mealTime, setMealTime] = useState(formatTimeFromDate(new Date()));
  const [mealFood, setMealFood] = useState("");
  const [mealImages, setMealImages] = useState<string[]>([]);
  const [mealCalories, setMealCalories] = useState("");
  const [mealProtein, setMealProtein] = useState("");
  const [mealCarbs, setMealCarbs] = useState("");
  const [mealFats, setMealFats] = useState("");
  const [mealFiber, setMealFiber] = useState("");

  const [waterManual, setWaterManual] = useState("");
  const [editingWaterId, setEditingWaterId] = useState<string | null>(null);
  const [editWaterAmount, setEditWaterAmount] = useState("");

  const [bedtime, setBedtime] = useState("22:00");
  const [wakeTime, setWakeTime] = useState("07:00");
  const [sleepNotes, setSleepNotes] = useState("");

  const [exRunning, setExRunning] = useState("0");
  const [exWalking, setExWalking] = useState("0");
  const [exStrength, setExStrength] = useState("0");
  const [exCardio, setExCardio] = useState("0");
  const [customActivities, setCustomActivities] = useState<CustomActivity[]>([]);
  const [newActivityName, setNewActivityName] = useState("");
  const [newActivityMins, setNewActivityMins] = useState("");

  const [weightInput, setWeightInput] = useState("");
  const [weightNotes, setWeightNotes] = useState("");

  const [goalInput, setGoalInput] = useState(mlToGallons(waterGoalMl));
  const [goalUnit, setGoalUnit] = useState<"gal" | "ml">("gal");
  const [sleepGoalInput, setSleepGoalInput] = useState(String(sleepGoalHours));
  const [exerciseGoalInput, setExerciseGoalInput] = useState(String(exerciseGoalMinutes));
  const [weightGoalInput, setWeightGoalInput] = useState(String(weightGoalKg));
  const [weightGoalUnit, setWeightGoalUnit] = useState<"kg" | "lbs">("kg");

  const [nutCalGoal, setNutCalGoal] = useState(String(calorieGoal));
  const [nutProGoal, setNutProGoal] = useState(String(proteinGoal));
  const [nutCarbGoal, setNutCarbGoal] = useState(String(carbsGoal));
  const [nutFatGoal, setNutFatGoal] = useState(String(fatsGoal));
  const [nutFibGoal, setNutFibGoal] = useState(String(fiberGoal));

  const waterPct = Math.min((todayWaterTotal / waterGoalMl) * 100, 100);
  const to12h = (time: string) => {
    const [hStr, mStr] = time.split(":");
    const h = parseInt(hStr, 10);
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${mStr} ${period}`;
  };
  const displayTime = (t: string) => mealTimeFormat === "12h" ? to12h(t) : t;

  const topPad = Platform.OS === "web" ? 67 + insets.top : insets.top;
  const tabBarHeight = Platform.OS === "web" ? 60 : 50;
  const bottomPad = insets.bottom + tabBarHeight + 16;
  const sleepHoursToday = calcSleepHoursNum(todaySleep?.bedtime ?? "", todaySleep?.wakeTime ?? "");
  const sleepPct = Math.min((sleepHoursToday / sleepGoalHours) * 100, 100);
