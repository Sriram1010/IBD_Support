import React, { useState, useMemo, useCallback } from "react";
import { useRouter } from "expo-router";
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
import { AutoHideScrollView } from "@/components/AutoHideScrollView";

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
      style={{ flex: 1, height: 32, borderRadius: 8, paddingHorizontal: 10, fontSize: 14, fontWeight: "600" as const, backgroundColor: colors.inputBg, color: colors.text }} />
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
  const router = useRouter();
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
  const [waterNotes, setWaterNotes] = useState("");
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
  const totalExerciseMin = (todayExercise?.running ?? 0) + (todayExercise?.walking ?? 0) +
    (todayExercise?.strengthTraining ?? 0) + (todayExercise?.cardio ?? 0) +
    (todayExercise?.customActivities ?? []).reduce((s, a) => s + a.minutes, 0);
  const exercisePct = Math.min((totalExerciseMin / exerciseGoalMinutes) * 100, 100);
  const exTotalSheet = parseInt(exRunning || "0", 10) + parseInt(exWalking || "0", 10) +
    parseInt(exStrength || "0", 10) + parseInt(exCardio || "0", 10) +
    customActivities.reduce((s, a) => s + a.minutes, 0);

  const kgToLbs = (kg: number) => (kg * 2.20462).toFixed(1);
  const lbsToKg = (lbs: number) => lbs / 2.20462;
  const weightDisplayStr = todayWeight
    ? (weightUnit === "kg" ? `${todayWeight.weightKg.toFixed(1)} kg` : `${kgToLbs(todayWeight.weightKg)} lbs`) : "—";
  const weightGoalDisplay = weightUnit === "kg" ? `${weightGoalKg.toFixed(1)} kg` : `${kgToLbs(weightGoalKg)} lbs`;
  const waterAmountDisplay = waterUnit === "ml" ? `${todayWaterTotal} ml` : `${mlToGallons(todayWaterTotal)} gal`;
  const goalDisplayStr = waterUnit === "gal" ? `${mlToGallons(waterGoalMl)} gal` : `${waterGoalMl} ml`;
  const totalHoursStr = calcSleepHours(todaySleep?.bedtime ?? "", todaySleep?.wakeTime ?? "");

  const pickImages = async () => {
    Alert.alert("Add Photos", "Choose source", [
      {
        text: "Camera", onPress: async () => {
          const cp = await ImagePicker.requestCameraPermissionsAsync();
          if (cp.status !== "granted") { Alert.alert("Permission needed", "Camera access required."); return; }
          const r = await ImagePicker.launchCameraAsync({ quality: 0.8 });
          if (!r.canceled && r.assets[0]) setMealImages((prev) => [...prev, r.assets[0].uri]);
        },
      },
      {
        text: "Photo Library", onPress: async () => {
          const gp = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (gp.status !== "granted") { Alert.alert("Permission needed", "Library access required."); return; }
          const r = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            allowsMultipleSelection: true,
          });
          if (!r.canceled) setMealImages((prev) => [...prev, ...r.assets.map((a) => a.uri)]);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const openAddMeal = () => {
    setEditingMealId(null);
    setMealTime(formatTimeFromDate(new Date()));
    setMealFood(""); setMealImages([]);
    setMealCalories(""); setMealProtein(""); setMealCarbs(""); setMealFats(""); setMealFiber("");
    setShowMealModal(true);
  };

  const openEditMeal = (meal: MealEntry) => {
    setEditingMealId(meal.id);
    setMealTime(meal.time);
    setMealFood(meal.foodDetails);
    setMealImages(getMealImages(meal));
    setMealCalories(meal.calories ? String(meal.calories) : "");
    setMealProtein(meal.protein ? String(meal.protein) : "");
    setMealCarbs(meal.carbs ? String(meal.carbs) : "");
    setMealFats(meal.fats ? String(meal.fats) : "");
    setMealFiber(meal.fiber ? String(meal.fiber) : "");
    setShowMealModal(true);
  };

  const handleSaveMeal = async () => {
    if (!mealFood.trim()) { Alert.alert("Required", "Please enter food details."); return; }
    const payload: Partial<MealEntry> = {
      time: mealTime, foodDetails: mealFood.trim(), images: mealImages,
      calories: mealCalories ? parseInt(mealCalories, 10) : undefined,
      protein: mealProtein ? parseFloat(mealProtein) : undefined,
      carbs: mealCarbs ? parseFloat(mealCarbs) : undefined,
      fats: mealFats ? parseFloat(mealFats) : undefined,
      fiber: mealFiber ? parseFloat(mealFiber) : undefined,
    };
    if (editingMealId) {
      await updateMeal(editingMealId, payload);
    } else {
      await addMeal({ date: today, ...payload } as Omit<MealEntry, "id">);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowMealModal(false);
  };

  const handleDeleteMeal = (meal: MealEntry) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Delete meal?", meal.foodDetails, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMeal(meal.id) },
    ]);
  };

  const handleManualWater = async () => {
    const amount = parseFloat(waterManual);
    if (isNaN(amount) || amount <= 0) { Alert.alert("Invalid", "Enter a number > 0."); return; }
    const ml = waterUnit === "gal" ? Math.round(amount * 3785.41) : Math.round(amount);
    await addWaterEntry({ date: today, amountMl: ml, time: formatTimeFromDate(new Date()) });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWaterManual("");
  };

  const handleSaveWater = async () => {
    if (waterManual.trim()) {
      const amount = parseFloat(waterManual);
      if (!isNaN(amount) && amount > 0) {
        const ml = waterUnit === "gal" ? Math.round(amount * 3785.41) : Math.round(amount);
        await addWaterEntry({ date: today, amountMl: ml, time: formatTimeFromDate(new Date()), notes: waterNotes.trim() || undefined });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setWaterManual("");
    setWaterNotes("");
    setEditingWaterId(null);
    setShowWaterModal(false);
  };

  const handleSaveSleep = async () => {
    if (todaySleep) await updateSleepLog(todaySleep.id, { bedtime, wakeTime, notes: sleepNotes });
    else await addSleepLog({ date: today, bedtime, wakeTime, notes: sleepNotes });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowSleepSheet(false);
  };

  const handleAddCustomActivity = () => {
    if (!newActivityName.trim()) return;
    const mins = parseInt(newActivityMins, 10);
    if (isNaN(mins) || mins <= 0) return;
    setCustomActivities((prev) => [...prev, { name: newActivityName.trim(), minutes: mins }]);
    setNewActivityName(""); setNewActivityMins("");
  };

  const handleSaveExercise = async () => {
    await saveExerciseLog({
      date: today,
      running: parseInt(exRunning || "0", 10),
      walking: parseInt(exWalking || "0", 10),
      strengthTraining: parseInt(exStrength || "0", 10),
      cardio: parseInt(exCardio || "0", 10),
      customActivities,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowExerciseSheet(false);
  };

  const handleSaveWaterGoal = async () => {
    const val = parseFloat(goalInput);
    if (isNaN(val) || val <= 0) { Alert.alert("Invalid", "Enter a valid goal."); return; }
    const ml = goalUnit === "gal" ? Math.round(val * 3785.41) : Math.round(val);
    await setWaterGoalMl(ml);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowGoalModal(false);
  };

  const handleSaveSleepGoal = async () => {
    const val = parseFloat(sleepGoalInput);
    if (isNaN(val) || val <= 0) { Alert.alert("Invalid", "Enter a valid sleep goal."); return; }
    await setSleepGoalHours(val);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowSleepGoalModal(false);
  };

  const handleQuickExerciseGoal = async (minutes: number) => {
    await setExerciseGoalMinutes(minutes);
    setExerciseGoalInput(String(minutes));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowExerciseGoalModal(false);
  };

  const handleSaveExerciseGoal = async () => {
    const val = parseInt(exerciseGoalInput, 10);
    if (isNaN(val) || val <= 0) { Alert.alert("Invalid", "Enter a valid exercise goal."); return; }
    await setExerciseGoalMinutes(val);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowExerciseGoalModal(false);
  };

  const handleSaveWeight = async () => {
    const val = parseFloat(weightInput);
    if (isNaN(val) || val <= 0) { Alert.alert("Invalid", "Enter a valid weight."); return; }
    const kg = weightUnit === "lbs" ? lbsToKg(val) : val;
    await saveWeightEntry({ date: today, weightKg: kg, notes: weightNotes });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowWeightSheet(false);
  };

  const handleSaveWeightGoal = async () => {
    const val = parseFloat(weightGoalInput);
    if (isNaN(val) || val <= 0) { Alert.alert("Invalid", "Enter a valid weight goal."); return; }
    const kg = weightGoalUnit === "lbs" ? lbsToKg(val) : val;
    await setWeightGoalKg(kg);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowWeightGoalModal(false);
  };

  const handleSaveNutritionGoals = async () => {
    const cal = parseInt(nutCalGoal, 10);
    const pro = parseInt(nutProGoal, 10);
    const carb = parseInt(nutCarbGoal, 10);
    const fat = parseInt(nutFatGoal, 10);
    const fib = parseInt(nutFibGoal, 10);
    if ([cal, pro, carb, fat, fib].some((v) => isNaN(v) || v <= 0)) {
      Alert.alert("Invalid", "Enter valid positive numbers for all goals."); return;
    }
    await Promise.all([setCalorieGoal(cal), setProteinGoal(pro), setCarbsGoal(carb), setFatsGoal(fat), setFiberGoal(fib)]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowNutritionGoalModal(false);
  };

  const openExercise = () => {
    setExRunning(String(todayExercise?.running ?? 0));
    setExWalking(String(todayExercise?.walking ?? 0));
    setExStrength(String(todayExercise?.strengthTraining ?? 0));
    setExCardio(String(todayExercise?.cardio ?? 0));
    setCustomActivities(todayExercise?.customActivities ?? []);
    setNewActivityName(""); setNewActivityMins("");
    setShowExerciseSheet(true);
  };

  const openSleep = () => {
    setBedtime(todaySleep?.bedtime ?? "22:00");
    setWakeTime(todaySleep?.wakeTime ?? "07:00");
    setSleepNotes(todaySleep?.notes ?? "");
    setShowSleepSheet(true);
  };

  const openWeight = () => {
    if (todayWeight) {
      setWeightInput(weightUnit === "kg" ? todayWeight.weightKg.toFixed(1) : kgToLbs(todayWeight.weightKg));
      setWeightNotes(todayWeight.notes ?? "");
    } else { setWeightInput(""); setWeightNotes(""); }
    setShowWeightSheet(true);
  };

  const openPhotoViewer = (photos: string[], startIdx: number) => {
    setViewerImages(photos); setViewerIndex(startIdx); setShowImageViewer(photos[startIdx]);
  };

  const hasAnyNutrition = todayNutrition.calories > 0 || todayNutrition.protein > 0 || todayNutrition.carbs > 0 || todayNutrition.fats > 0 || todayNutrition.fiber > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: topPad + 16 }]}>
          <View style={styles.headerTopRow}>
            <View>
              <Text style={[styles.headerTitle, { color: colors.headerText }]}>Diary</Text>
              <Text style={[styles.headerDate, { color: colors.headerTextSecondary }]}>{formatDisplayDate(today)}</Text>
            </View>
            <TouchableOpacity
              testID="profile-settings-button"
              accessibilityRole="button"
              accessibilityLabel="Open profile settings"
              style={styles.headerIconBtn}
              onPress={() => router.push("/profile")}
            >
              <Feather name="settings" size={22} color={colors.headerText} />
            </TouchableOpacity>
          </View>
        </View>

        <AutoHideScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }} keyboardShouldPersistTaps="handled">

          {/* FOOD LOG */}
          <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Food Log</Text>
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.gold }]} onPress={openAddMeal}>
                <Feather name="plus" size={16} color="#fff" />
              </TouchableOpacity>
            </View>

            {todayMeals.length === 0 ? (
              <View style={styles.emptyState}><Feather name="coffee" size={24} color={colors.placeholder} /><Text style={[styles.emptyText, { color: colors.placeholder }]}>No food logged today</Text></View>
            ) : (
              <View>
                <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.thTime, { color: colors.textSecondary }]}>Time</Text>
                  <Text style={[styles.thFood, { color: colors.textSecondary }]}>Food & Nutrition</Text>
                  <Text style={[styles.thPhoto, { color: colors.textSecondary }]}>Photos</Text>
                </View>
                {todayMeals.map((meal) => {
                  const imgs = getMealImages(meal);
                  const hasNut = (meal.calories ?? 0) > 0 || (meal.protein ?? 0) > 0 || (meal.carbs ?? 0) > 0 || (meal.fats ?? 0) > 0 || (meal.fiber ?? 0) > 0;
                  return (
                    <View key={meal.id} style={[styles.mealRow, { borderTopColor: colors.borderLight }]}>
                      <Text style={[styles.tdTime, { color: colors.text }]}>{displayTime(meal.time)}</Text>
                      <View style={styles.tdFoodCol}>
                        <Text style={[styles.foodName, { color: colors.text }]} numberOfLines={2}>{meal.foodDetails}</Text>
                        {hasNut && (
                          <View style={styles.nutTagRow}>
                            {(meal.calories ?? 0) > 0 && <NutritionBadge label="cal" value={meal.calories!} unit="" color="#EF4444" />}
                            {(meal.protein ?? 0) > 0 && <NutritionBadge label="P" value={meal.protein!} unit="g" color="#10B981" />}
                            {(meal.carbs ?? 0) > 0 && <NutritionBadge label="C" value={meal.carbs!} unit="g" color="#3B82F6" />}
                            {(meal.fats ?? 0) > 0 && <NutritionBadge label="F" value={meal.fats!} unit="g" color="#F97316" />}
                            {(meal.fiber ?? 0) > 0 && <NutritionBadge label="Fb" value={meal.fiber!} unit="g" color="#8B5CF6" />}
                          </View>
                        )}
                      </View>
                      <View style={styles.tdPhotoCol}>
                        {imgs.length > 0 ? (
                          <TouchableOpacity onPress={() => openPhotoViewer(imgs, 0)}>
                            <Image source={{ uri: imgs[0] }} style={styles.thumbnail} />
                            {imgs.length > 1 && (
                              <View style={[styles.photoCountBadge, { backgroundColor: colors.purple }]}>
                                <Text style={styles.photoCountText}>+{imgs.length - 1}</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        ) : (
                          <View style={[styles.noPhoto, { backgroundColor: colors.borderLight }]}><Feather name="image" size={14} color={colors.placeholder} /></View>
                        )}
                      </View>
                      <View style={styles.mealActions}>
                        <TouchableOpacity style={[styles.mealActionBtn, { backgroundColor: colors.sectionBg }]} onPress={() => openEditMeal(meal)}>
                          <Feather name="edit-2" size={12} color={colors.tint} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.mealActionBtn, { backgroundColor: "#FEE2E2" }]} onPress={() => handleDeleteMeal(meal)}>
                          <Feather name="trash-2" size={12} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Nutrition progress bars */}
            {hasAnyNutrition && (
              <View style={[styles.nutProgressSection, { borderTopColor: colors.border }]}>
                <View style={styles.nutProgressHeader}>
                  <Text style={[styles.nutProgressTitle, { color: colors.textSecondary }]}>Daily Nutrition</Text>
                  <TouchableOpacity onPress={() => { setNutCalGoal(String(calorieGoal)); setNutProGoal(String(proteinGoal)); setNutCarbGoal(String(carbsGoal)); setNutFatGoal(String(fatsGoal)); setNutFibGoal(String(fiberGoal)); setShowNutritionGoalModal(true); }}>
                    <Text style={[styles.nutGoalBtn, { color: colors.tint }]}>Edit Goals</Text>
                  </TouchableOpacity>
                </View>
                {calorieGoal > 0 && todayNutrition.calories > 0 && (
                  <NutProgressRow label="Calories" current={todayNutrition.calories} goal={calorieGoal} unit="cal" color="#EF4444" colors={colors} />
                )}
                {proteinGoal > 0 && todayNutrition.protein > 0 && (
                  <NutProgressRow label="Protein" current={todayNutrition.protein} goal={proteinGoal} unit="g" color="#10B981" colors={colors} />
                )}
                {carbsGoal > 0 && todayNutrition.carbs > 0 && (
                  <NutProgressRow label="Carbs" current={todayNutrition.carbs} goal={carbsGoal} unit="g" color="#3B82F6" colors={colors} />
                )}
                {fatsGoal > 0 && todayNutrition.fats > 0 && (
                  <NutProgressRow label="Fats" current={todayNutrition.fats} goal={fatsGoal} unit="g" color="#F97316" colors={colors} />
                )}
                {fiberGoal > 0 && todayNutrition.fiber > 0 && (
                  <NutProgressRow label="Fiber" current={todayNutrition.fiber} goal={fiberGoal} unit="g" color="#8B5CF6" colors={colors} />
                )}
              </View>
            )}
            {!hasAnyNutrition && todayMeals.length > 0 && (
              <TouchableOpacity style={[styles.nutGoalHint, { borderTopColor: colors.border }]}
                onPress={() => { setNutCalGoal(String(calorieGoal)); setNutProGoal(String(proteinGoal)); setNutCarbGoal(String(carbsGoal)); setNutFatGoal(String(fatsGoal)); setNutFibGoal(String(fiberGoal)); setShowNutritionGoalModal(true); }}>
                <Feather name="bar-chart-2" size={13} color={colors.placeholder} />
                <Text style={[styles.nutGoalHintText, { color: colors.placeholder }]}>Add nutrition info to meals to track daily goals</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* WATER */}
          <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
            <View style={styles.waterHeaderRow}>
              <View style={styles.waterTitleRow}>
                <Feather name="droplet" size={16} color={colors.teal} />
                <Text style={[styles.cardTitle, { color: colors.text, marginLeft: 6 }]}>Water</Text>
              </View>
              <View style={styles.waterHeaderRight}>
                <View style={[styles.toggleGroup, { borderColor: colors.border, borderWidth: 1 }]}>
                  <TouchableOpacity style={[styles.toggleBtn, waterUnit === "ml" && { backgroundColor: colors.teal }]} onPress={() => setWaterUnit("ml")}>
                    <Text style={[styles.toggleBtnText, { color: waterUnit === "ml" ? "#fff" : colors.textSecondary }]}>ml</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.toggleBtn, waterUnit === "gal" && { backgroundColor: colors.teal }]} onPress={() => setWaterUnit("gal")}>
                    <Text style={[styles.toggleBtnText, { color: waterUnit === "gal" ? "#fff" : colors.textSecondary }]}>gal</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={[styles.addWaterBtn, { backgroundColor: colors.teal }]} onPress={() => setShowWaterModal(true)}>
                  <Text style={styles.addWaterBtnText}>+ Add</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={[styles.amountCard, { backgroundColor: colors.tealLight, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
              <Text style={[styles.amountBig, { color: colors.teal }]}>{waterAmountDisplay}</Text>
              <TouchableOpacity style={[styles.goalChip, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
                onPress={() => { setGoalInput(mlToGallons(waterGoalMl)); setGoalUnit("gal"); setShowGoalModal(true); }}>
                <Text style={[styles.goalChipText, { color: colors.textSecondary }]}>Goal: {goalDisplayStr}</Text>
                <Feather name="chevron-down" size={12} color={colors.textSecondary} style={{ marginLeft: 2 }} />
              </TouchableOpacity>
            </View>
            <GoalProgressBar pct={waterPct} />
            <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>{Math.round(waterPct)}% of daily goal</Text>
          </View>

          {/* SLEEP */}
          <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Sleep</Text>
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.gold }]} onPress={openSleep}>
                <Feather name="plus" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
            {todaySleep ? (
              <TouchableOpacity onPress={openSleep}>
                <View style={styles.sleepRow}>
                  <SleepStat label="Bedtime" value={todaySleep.bedtime} colors={colors} />
                  <SleepStat label="Wake" value={todaySleep.wakeTime} colors={colors} />
                  <SleepStat label="Total" value={totalHoursStr} colors={colors} highlight />
                </View>
                <View style={[styles.amountCard, { backgroundColor: colors.sectionBg, marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                  <Text style={[styles.amountBig, { color: colors.gold, fontSize: 24 }]}>{sleepHoursToday}h</Text>
                  <TouchableOpacity style={[styles.goalChip, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
                    onPress={(e) => { e.stopPropagation?.(); setSleepGoalInput(String(sleepGoalHours)); setShowSleepGoalModal(true); }}>
                    <Text style={[styles.goalChipText, { color: colors.textSecondary }]}>Goal: {sleepGoalHours}h</Text>
                    <Feather name="chevron-down" size={12} color={colors.textSecondary} style={{ marginLeft: 2 }} />
                  </TouchableOpacity>
                </View>
                <GoalProgressBar pct={sleepPct} />
                <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>{Math.round(sleepPct)}% of sleep goal</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={openSleep}>
                <View style={styles.emptyState}><Feather name="moon" size={24} color={colors.placeholder} /><Text style={[styles.emptyText, { color: colors.placeholder }]}>Tap to log your sleep</Text></View>
              </TouchableOpacity>
            )}
          </View>

          {/* WEIGHT */}
          <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
            <View style={styles.waterHeaderRow}>
              <View style={styles.waterTitleRow}>
                <Feather name="trending-up" size={16} color={colors.purple} />
                <Text style={[styles.cardTitle, { color: colors.text, marginLeft: 6 }]}>Weight</Text>
              </View>
              <View style={styles.waterHeaderRight}>
                <View style={[styles.toggleGroup, { borderColor: colors.border, borderWidth: 1 }]}>
                  <TouchableOpacity style={[styles.toggleBtn, weightUnit === "kg" && { backgroundColor: colors.purple }]} onPress={() => setWeightUnit("kg")}>
                    <Text style={[styles.toggleBtnText, { color: weightUnit === "kg" ? "#fff" : colors.textSecondary }]}>kg</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.toggleBtn, weightUnit === "lbs" && { backgroundColor: colors.purple }]} onPress={() => setWeightUnit("lbs")}>
                    <Text style={[styles.toggleBtnText, { color: weightUnit === "lbs" ? "#fff" : colors.textSecondary }]}>lbs</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={[styles.addWaterBtn, { backgroundColor: colors.purple }]} onPress={openWeight}>
                  <Text style={styles.addWaterBtnText}>{todayWeight ? "Edit" : "+ Log"}</Text>
                </TouchableOpacity>
              </View>
            </View>
            {todayWeight ? (
              <TouchableOpacity onPress={openWeight}>
                <View style={[styles.amountCard, { backgroundColor: colors.sectionBg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                  <Text style={[styles.amountBig, { color: colors.purple }]}>{weightDisplayStr}</Text>
                  <TouchableOpacity style={[styles.goalChip, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
                    onPress={(e) => { e.stopPropagation?.(); setWeightGoalInput(weightUnit === "kg" ? String(weightGoalKg) : kgToLbs(weightGoalKg)); setWeightGoalUnit(weightUnit); setShowWeightGoalModal(true); }}>
                    <Text style={[styles.goalChipText, { color: colors.textSecondary }]}>Goal: {weightGoalDisplay}</Text>
                    <Feather name="chevron-down" size={12} color={colors.textSecondary} style={{ marginLeft: 2 }} />
                  </TouchableOpacity>
                </View>
                {todayWeight.notes ? <Text style={[styles.progressLabel, { color: colors.textSecondary, marginTop: 4 }]}>{todayWeight.notes}</Text> : null}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={openWeight}>
                <View style={styles.emptyState}><Feather name="trending-up" size={24} color={colors.placeholder} /><Text style={[styles.emptyText, { color: colors.placeholder }]}>Tap to log your weight</Text></View>
              </TouchableOpacity>
            )}
          </View>

          {/* EXERCISE */}
          <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Exercise</Text>
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.gold }]} onPress={openExercise}>
                <Feather name="plus" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
            {todayExercise && totalExerciseMin > 0 ? (
              <TouchableOpacity onPress={openExercise}>
                <View style={styles.exerciseGrid}>
                  {(todayExercise.running ?? 0) > 0 && <ExerciseTile icon="activity" label="Running" value={todayExercise.running} colors={colors} />}
                  {(todayExercise.walking ?? 0) > 0 && <ExerciseTile icon="navigation" label="Walking" value={todayExercise.walking} colors={colors} />}
                  {(todayExercise.strengthTraining ?? 0) > 0 && <ExerciseTile icon="zap" label="Strength" value={todayExercise.strengthTraining} colors={colors} />}
                  {(todayExercise.cardio ?? 0) > 0 && <ExerciseTile icon="heart" label="Cardio" value={todayExercise.cardio} colors={colors} />}
                  {(todayExercise.customActivities ?? []).map((a, i) => (
                    <ExerciseTile key={i} icon="plus-circle" label={a.name} value={a.minutes} colors={colors} />
                  ))}
                </View>
                <View style={[styles.amountCard, { backgroundColor: colors.sectionBg, marginTop: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                  <Text style={[styles.amountBig, { color: colors.gold, fontSize: 24 }]}>{totalExerciseMin} min</Text>
                  <TouchableOpacity style={[styles.goalChip, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
                    onPress={(e) => { e.stopPropagation?.(); setExerciseGoalInput(String(exerciseGoalMinutes)); setShowExerciseGoalModal(true); }}>
                    <Text style={[styles.goalChipText, { color: colors.textSecondary }]}>Goal: {exerciseGoalMinutes}min</Text>
                    <Feather name="chevron-down" size={12} color={colors.textSecondary} style={{ marginLeft: 2 }} />
                  </TouchableOpacity>
                </View>
                <GoalProgressBar pct={exercisePct} />
                <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>{Math.round(exercisePct)}% of exercise goal</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={openExercise}>
                <View style={styles.emptyState}><Feather name="trending-up" size={24} color={colors.placeholder} /><Text style={[styles.emptyText, { color: colors.placeholder }]}>Tap to log exercise</Text></View>
              </TouchableOpacity>
            )}
          </View>
        </AutoHideScrollView>

        {/* ADD/EDIT MEAL MODAL */}
        <Modal visible={showMealModal} animationType="slide" transparent>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View style={shStyles.overlay}>
              <TouchableWithoutFeedback onPress={() => setShowMealModal(false)}><View style={StyleSheet.absoluteFill} /></TouchableWithoutFeedback>
              <View style={[shStyles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 16, maxHeight: "92%" }]}>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <View style={[shStyles.handle, { backgroundColor: colors.border }]} />
                  <Text style={[shStyles.title, { color: colors.text }]}>{editingMealId ? "Edit Meal" : "Add Food"}</Text>

                  <View style={styles.modalTimeRow}>
                    <View style={[styles.toggleGroup, { borderColor: colors.border, borderWidth: 1, marginRight: 10 }]}>
                      <TouchableOpacity style={[styles.toggleBtn, mealTimeFormat === "12h" && { backgroundColor: colors.teal }]} onPress={() => setMealTimeFormat("12h")}>
                        <Text style={[styles.toggleBtnText, { color: mealTimeFormat === "12h" ? "#fff" : colors.textSecondary }]}>12h</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.toggleBtn, mealTimeFormat === "24h" && { backgroundColor: colors.teal }]} onPress={() => setMealTimeFormat("24h")}>
                        <Text style={[styles.toggleBtnText, { color: mealTimeFormat === "24h" ? "#fff" : colors.textSecondary }]}>24h</Text>
                      </TouchableOpacity>
                    </View>
                    {mealTimeFormat === "24h" ? (
                      <Simple24hInput value={mealTime} onChange={setMealTime} colors={colors} />
                    ) : (
                      <SimpleTimeInput value={mealTime} onChange={setMealTime} colors={colors} />
                    )}
                  </View>

                  <View style={[styles.foodInputRow, { backgroundColor: colors.inputBg, borderRadius: 10, marginTop: 10 }]}>
                    <TextInput style={[styles.foodInput, { color: colors.text }]} value={mealFood} onChangeText={setMealFood} placeholder="Food details…" placeholderTextColor={colors.placeholder} multiline numberOfLines={3} />
                    <TouchableOpacity style={[styles.micBtn, { backgroundColor: colors.borderLight }]} onPress={() => Alert.alert("Voice Input", "Use your device's dictation feature in the keyboard.")}>
                      <Feather name="mic" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  {/* Nutrition section */}
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 14 }]}>Nutrition Details (optional)</Text>
                  <View style={styles.nutGrid}>
                    <NutInput label="Calories" unit="cal" value={mealCalories} onChange={setMealCalories} colors={colors} />
                    <NutInput label="Protein" unit="g" value={mealProtein} onChange={setMealProtein} colors={colors} />
                    <NutInput label="Carbs" unit="g" value={mealCarbs} onChange={setMealCarbs} colors={colors} />
                    <NutInput label="Fats" unit="g" value={mealFats} onChange={setMealFats} colors={colors} />
                    <NutInput label="Fiber" unit="g" value={mealFiber} onChange={setMealFiber} colors={colors} />
                  </View>

                  {/* Photos */}
                  <View style={styles.imageSection}>
                    <TouchableOpacity style={[styles.cameraBtn, { backgroundColor: colors.sectionBg }]} onPress={pickImages}>
                      <Feather name="camera" size={18} color={colors.gold} />
                      <Text style={[styles.cameraBtnText, { color: colors.gold }]}>Add Photos</Text>
                    </TouchableOpacity>
                  </View>
                  {mealImages.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                      {mealImages.map((uri, idx) => (
                        <View key={`${uri}-${idx}`} style={{ marginRight: 8, position: "relative" }}>
                          <Image source={{ uri }} style={styles.previewImage} />
                          <TouchableOpacity style={styles.removePhotoBtn} onPress={() => setMealImages((prev) => prev.filter((_, i) => i !== idx))}>
                            <Feather name="x" size={11} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  )}

                  <View style={styles.modalButtons}>
                    <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.sectionBg }]} onPress={() => setShowMealModal(false)}>
                      <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.gold }]} onPress={handleSaveMeal}>
                      <Text style={styles.saveText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* WATER MODAL */}
        <KbSheet visible={showWaterModal} onClose={() => { setShowWaterModal(false); setWaterManual(""); setWaterNotes(""); setEditingWaterId(null); }} title="Log Water" insets={insets}>
          <View style={[styles.manualRow, { marginBottom: 0 }]}>
            <TextInput style={[styles.manualInput, { backgroundColor: colors.inputBg, color: colors.text }]} value={waterManual} onChangeText={setWaterManual} placeholder={`Amount in ${waterUnit}`} placeholderTextColor={colors.placeholder} keyboardType="decimal-pad" />
            <TouchableOpacity style={[styles.manualAddBtn, { backgroundColor: colors.teal }]} onPress={handleManualWater}>
              <Feather name="plus" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          {waterEntries.filter((w) => w.date === today).length > 0 && (
            <View style={[styles.waterEntryList, { borderTopColor: colors.border, borderTopWidth: 1, marginTop: 14 }]}>
              <Text style={[styles.hint, { color: colors.textSecondary, marginBottom: 6, marginTop: 2 }]}>Today's entries</Text>
              {waterEntries.filter((w) => w.date === today).sort((a, b) => a.id.localeCompare(b.id)).map((w) => (
                <View key={w.id}>
                  {editingWaterId === w.id ? (
                    <View style={styles.waterEntryRow}>
                      <TextInput style={[styles.manualInput, { flex: 1, backgroundColor: colors.inputBg, color: colors.text, height: 38 }]} value={editWaterAmount} onChangeText={setEditWaterAmount} keyboardType="decimal-pad" autoFocus />
                      <TouchableOpacity style={[styles.manualAddBtn, { backgroundColor: colors.teal, height: 38, width: 38 }]} onPress={async () => {
                        const amt = waterUnit === "gal" ? Math.round(parseFloat(editWaterAmount) * 3785.41) : Math.round(parseFloat(editWaterAmount));
                        if (!isNaN(amt) && amt > 0) await updateWaterEntry(w.id, amt);
                        setEditingWaterId(null);
                      }}><Feather name="check" size={16} color="#fff" /></TouchableOpacity>
                      <TouchableOpacity style={[styles.manualAddBtn, { backgroundColor: colors.sectionBg, height: 38, width: 38 }]} onPress={() => setEditingWaterId(null)}><Feather name="x" size={16} color={colors.textSecondary} /></TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.waterEntryRow}>
                      <Feather name="clock" size={12} color={colors.placeholder} />
                      <Text style={[styles.waterEntryTime, { color: colors.textSecondary }]}>{w.time ?? "—"}</Text>
                      <Text style={[styles.waterEntryAmt, { color: colors.text }]}>{waterUnit === "gal" ? `${mlToGallons(w.amountMl)} gal` : `${w.amountMl} ml`}</Text>
                      <TouchableOpacity onPress={() => { setEditingWaterId(w.id); setEditWaterAmount(waterUnit === "gal" ? mlToGallons(w.amountMl) : String(w.amountMl)); }}><Feather name="edit-2" size={14} color={colors.tint} /></TouchableOpacity>
                      <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); deleteWaterEntry(w.id); }}><Feather name="trash-2" size={14} color="#EF4444" /></TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
          <TextInput style={[styles.sleepNotesInput, { backgroundColor: colors.inputBg, color: colors.text, marginTop: 14 }]} value={waterNotes} onChangeText={setWaterNotes} placeholder="Optional notes…" placeholderTextColor={colors.placeholder} multiline numberOfLines={2} />
          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.sectionBg }]} onPress={() => { setShowWaterModal(false); setWaterManual(""); setWaterNotes(""); setEditingWaterId(null); }}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.teal }]} onPress={handleSaveWater}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </KbSheet>

        {/* WATER GOAL MODAL */}
        <KbSheet visible={showGoalModal} onClose={() => setShowGoalModal(false)} title="Set Water Goal" insets={insets}>
          <View style={styles.goalInputRow}>
            <TextInput style={[styles.goalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border, borderWidth: 1 }]} value={goalInput} onChangeText={setGoalInput} keyboardType="decimal-pad" />
            <View style={[styles.toggleGroup, { borderColor: colors.border, borderWidth: 1, marginLeft: 10 }]}>
              <TouchableOpacity style={[styles.toggleBtn, goalUnit === "gal" && { backgroundColor: colors.purple }]} onPress={() => { setGoalUnit("gal"); const v = parseFloat(goalInput); if (!isNaN(v) && goalUnit === "ml") setGoalInput(mlToGallons(v)); }}>
                <Text style={[styles.toggleBtnText, { color: goalUnit === "gal" ? "#fff" : colors.textSecondary }]}>gal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toggleBtn, goalUnit === "ml" && { backgroundColor: colors.purple }]} onPress={() => { setGoalUnit("ml"); const v = parseFloat(goalInput); if (!isNaN(v) && goalUnit === "gal") setGoalInput(String(Math.round(v * 3785.41))); }}>
                <Text style={[styles.toggleBtnText, { color: goalUnit === "ml" ? "#fff" : colors.textSecondary }]}>ml</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.presetsRow}>
            {GAL_PRESETS.map((p) => (
              <TouchableOpacity key={p.label} style={[styles.presetChip, { backgroundColor: colors.sectionBg, borderColor: colors.border, borderWidth: 1 }]} onPress={() => { setGoalUnit("gal"); setGoalInput(mlToGallons(p.ml)); }}>
                <Text style={[styles.presetChipText, { color: colors.text }]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.sectionBg }]} onPress={() => setShowGoalModal(false)}><Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.purple }]} onPress={handleSaveWaterGoal}><Text style={styles.saveText}>Save Goal</Text></TouchableOpacity>
          </View>
        </KbSheet>

        {/* SLEEP SHEET */}
        <Modal visible={showSleepSheet} animationType="slide" transparent>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View style={shStyles.overlay}>
              <TouchableWithoutFeedback onPress={() => setShowSleepSheet(false)}><View style={StyleSheet.absoluteFill} /></TouchableWithoutFeedback>
              <View style={[shStyles.sheet, { paddingBottom: insets.bottom + 16, backgroundColor: colors.surface }]}>
                <View style={[shStyles.handle, { backgroundColor: colors.border }]} />
                <Text style={[shStyles.title, { color: colors.text }]}>Sleep Log</Text>
                <View style={styles.formatToggleRow}>
                  <Text style={[styles.sleepPickerLabel, { color: colors.textSecondary, flex: 1 }]}>Time Format</Text>
                  <View style={[styles.toggleGroup, { borderColor: colors.border, borderWidth: 1 }]}>
                    <TouchableOpacity style={[styles.toggleBtn, sleepTimeFormat === "12h" && { backgroundColor: colors.teal }]} onPress={() => setSleepTimeFormat("12h")}>
                      <Text style={[styles.toggleBtnText, { color: sleepTimeFormat === "12h" ? "#fff" : colors.textSecondary }]}>12 HR</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.toggleBtn, sleepTimeFormat === "24h" && { backgroundColor: colors.teal }]} onPress={() => setSleepTimeFormat("24h")}>
                      <Text style={[styles.toggleBtnText, { color: sleepTimeFormat === "24h" ? "#fff" : colors.textSecondary }]}>24 HR</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.sleepPickerSection}>
                  <Text style={[styles.sleepPickerLabel, { color: colors.textSecondary }]}>Bedtime</Text>
                  {sleepTimeFormat === "12h" ? <SimpleTimeInput value={bedtime} onChange={setBedtime} colors={colors} /> : <Simple24hInput value={bedtime} onChange={setBedtime} colors={colors} />}
                </View>
                <View style={[styles.sleepPickerSection, { marginTop: 12 }]}>
                  <Text style={[styles.sleepPickerLabel, { color: colors.textSecondary }]}>Wake Time</Text>
                  {sleepTimeFormat === "12h" ? <SimpleTimeInput value={wakeTime} onChange={setWakeTime} colors={colors} /> : <Simple24hInput value={wakeTime} onChange={setWakeTime} colors={colors} />}
                </View>
                <View style={[styles.sleepTotalBox, { backgroundColor: colors.tealLight, marginTop: 12 }]}>
                  <Feather name="moon" size={18} color={colors.gold} />
                  <Text style={[styles.sleepTotalText, { color: colors.gold }]}>Total: {calcSleepHours(bedtime, wakeTime)}</Text>
                </View>
                <TextInput style={[styles.sleepNotesInput, { backgroundColor: colors.inputBg, color: colors.text, marginTop: 10 }]} value={sleepNotes} onChangeText={setSleepNotes} placeholder="Optional notes…" placeholderTextColor={colors.placeholder} multiline numberOfLines={2} />
                <View style={styles.modalButtons}>
                  <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.sectionBg }]} onPress={() => setShowSleepSheet(false)}><Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.gold }]} onPress={handleSaveSleep}><Text style={styles.saveText}>Save</Text></TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* SLEEP GOAL MODAL */}
        <KbSheet visible={showSleepGoalModal} onClose={() => setShowSleepGoalModal(false)} title="Set Sleep Goal" insets={insets}>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>Recommended: 7-9 hours for adults</Text>
          <TextInput style={[styles.goalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border, borderWidth: 1, width: "100%" }]} value={sleepGoalInput} onChangeText={setSleepGoalInput} keyboardType="decimal-pad" placeholder="Hours" placeholderTextColor={colors.placeholder} />
          <View style={[styles.presetsRow, { marginTop: 12 }]}>
            {SLEEP_PRESETS.map((h) => (
              <TouchableOpacity key={h} style={[styles.presetChip, { backgroundColor: colors.sectionBg, borderColor: colors.border, borderWidth: 1 }]} onPress={() => setSleepGoalInput(String(h))}>
                <Text style={[styles.presetChipText, { color: colors.text }]}>{h}h</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.sectionBg }]} onPress={() => setShowSleepGoalModal(false)}><Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.gold }]} onPress={handleSaveSleepGoal}><Text style={styles.saveText}>Save Goal</Text></TouchableOpacity>
          </View>
        </KbSheet>

        {/* EXERCISE SHEET */}
        <Modal visible={showExerciseSheet} animationType="slide" transparent>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View style={shStyles.overlay}>
              <TouchableWithoutFeedback onPress={() => setShowExerciseSheet(false)}><View style={StyleSheet.absoluteFill} /></TouchableWithoutFeedback>
              <View style={[shStyles.sheet, { paddingBottom: insets.bottom + 16, backgroundColor: colors.surface }]}>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <View style={[shStyles.handle, { backgroundColor: colors.border }]} />
                  <Text style={[shStyles.title, { color: colors.text }]}>Log Exercise</Text>
                  <Text style={[styles.hint, { color: colors.textSecondary }]}>Enter duration in minutes for each activity</Text>
                  <ActivityInput icon="activity" label="Running" value={exRunning} onChange={setExRunning} colors={colors} />
                  <ActivityInput icon="navigation" label="Walking" value={exWalking} onChange={setExWalking} colors={colors} />
                  <ActivityInput icon="zap" label="Strength Training" value={exStrength} onChange={setExStrength} colors={colors} />
                  <ActivityInput icon="heart" label="Cardio" value={exCardio} onChange={setExCardio} colors={colors} />

                  {/* Custom activities */}
                  {customActivities.length > 0 && (
                    <View style={{ marginTop: 4 }}>
                      {customActivities.map((a, i) => (
                        <View key={i} style={styles.activityRow}>
                          <View style={[styles.activityIconBox, { backgroundColor: colors.sectionBg }]}>
                            <Feather name="plus-circle" size={18} color={colors.gold} />
                          </View>
                          <Text style={[styles.activityLabel, { color: colors.text }]}>{a.name}</Text>
                          <View style={[styles.activityInput, { backgroundColor: colors.inputBg, alignItems: "center", justifyContent: "center" }]}>
                            <Text style={[styles.activityUnit, { color: colors.text, fontSize: 20, fontWeight: "600", width: "auto" }]}>{a.minutes}</Text>
                          </View>
                          <Text style={[styles.activityUnit, { color: colors.textSecondary }]}>min</Text>
                          <TouchableOpacity onPress={() => setCustomActivities((prev) => prev.filter((_, j) => j !== i))}>
                            <Feather name="x" size={16} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Add custom activity */}
                  <View style={[styles.customActivitySection, { backgroundColor: colors.sectionBg, borderRadius: 12 }]}>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginBottom: 8 }]}>Add Custom Activity</Text>
                    <View style={styles.customActivityRow}>
                      <TextInput style={[styles.customActivityInput, { backgroundColor: colors.inputBg, color: colors.text, flex: 1 }]} value={newActivityName} onChangeText={setNewActivityName} placeholder="e.g. Swimming, Cycling…" placeholderTextColor={colors.placeholder} />
                      <TextInput style={[styles.customActivityMins, { backgroundColor: colors.inputBg, color: colors.text }]} value={newActivityMins} onChangeText={setNewActivityMins} placeholder="Min" placeholderTextColor={colors.placeholder} keyboardType="number-pad" />
                      <TouchableOpacity style={[styles.manualAddBtn, { backgroundColor: colors.gold, height: 44, width: 44 }]} onPress={handleAddCustomActivity}>
                        <Feather name="plus" size={18} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={[styles.exTotalRow, { backgroundColor: colors.sectionBg, marginTop: 12 }]}>
                    <Text style={[styles.exTotalLabel, { color: colors.textSecondary }]}>Total Active Time</Text>
                    <Text style={[styles.exTotalValue, { color: colors.gold }]}>{exTotalSheet} min</Text>
                  </View>
                  <View style={styles.modalButtons}>
                    <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.sectionBg }]} onPress={() => setShowExerciseSheet(false)}><Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.gold }]} onPress={handleSaveExercise}><Text style={styles.saveText}>Save</Text></TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* EXERCISE GOAL MODAL */}
        <KbSheet visible={showExerciseGoalModal} onClose={() => setShowExerciseGoalModal(false)} title="Set Exercise Goal" insets={insets}>
          <View style={[styles.presetsRow, { marginBottom: 12, flexWrap: "wrap" }]}>
            {EXERCISE_PRESETS.map((m) => (
              <TouchableOpacity key={m} style={[styles.presetChip, { backgroundColor: exerciseGoalMinutes === m ? colors.gold : colors.sectionBg, borderColor: exerciseGoalMinutes === m ? colors.gold : colors.border, borderWidth: 1 }]} onPress={() => handleQuickExerciseGoal(m)}>
                <Text style={[styles.presetChipText, { color: exerciseGoalMinutes === m ? "#fff" : colors.text }]}>{m} min</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={[styles.goalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border, borderWidth: 1, width: "100%" }]} value={exerciseGoalInput} onChangeText={setExerciseGoalInput} keyboardType="number-pad" placeholder="Minutes" placeholderTextColor={colors.placeholder} />
          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.sectionBg }]} onPress={() => setShowExerciseGoalModal(false)}><Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.gold }]} onPress={handleSaveExerciseGoal}><Text style={styles.saveText}>Save Goal</Text></TouchableOpacity>
          </View>
        </KbSheet>

        {/* WEIGHT SHEET */}
        <KbSheet visible={showWeightSheet} onClose={() => setShowWeightSheet(false)} title={todayWeight ? "Edit Weight" : "Log Weight"} insets={insets}>
          <View style={styles.goalInputRow}>
            <TextInput style={[styles.goalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border, borderWidth: 1, flex: 1 }]} value={weightInput} onChangeText={setWeightInput} keyboardType="decimal-pad" placeholder={weightUnit === "kg" ? "e.g. 72.5" : "e.g. 159.8"} placeholderTextColor={colors.placeholder} />
            <View style={[styles.toggleGroup, { borderColor: colors.border, borderWidth: 1, marginLeft: 10 }]}>
              <TouchableOpacity style={[styles.toggleBtn, weightUnit === "kg" && { backgroundColor: colors.purple }]} onPress={() => setWeightUnit("kg")}><Text style={[styles.toggleBtnText, { color: weightUnit === "kg" ? "#fff" : colors.textSecondary }]}>kg</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.toggleBtn, weightUnit === "lbs" && { backgroundColor: colors.purple }]} onPress={() => setWeightUnit("lbs")}><Text style={[styles.toggleBtnText, { color: weightUnit === "lbs" ? "#fff" : colors.textSecondary }]}>lbs</Text></TouchableOpacity>
            </View>
          </View>
          <View style={[styles.presetsRow, { flexWrap: "wrap", marginBottom: 12 }]}>
            {WEIGHT_KG_PRESETS.map((kg) => (
              <TouchableOpacity key={kg} style={[styles.presetChip, { backgroundColor: colors.sectionBg, borderColor: colors.border, borderWidth: 1 }]} onPress={() => setWeightInput(weightUnit === "kg" ? String(kg) : kgToLbs(kg))}>
                <Text style={[styles.presetChipText, { color: colors.text }]}>{weightUnit === "kg" ? `${kg}kg` : `${kgToLbs(kg)}lbs`}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={[styles.sleepNotesInput, { backgroundColor: colors.inputBg, color: colors.text }]} value={weightNotes} onChangeText={setWeightNotes} placeholder="Optional notes…" placeholderTextColor={colors.placeholder} multiline numberOfLines={2} />
          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.sectionBg }]} onPress={() => setShowWeightSheet(false)}><Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.purple }]} onPress={handleSaveWeight}><Text style={styles.saveText}>Save</Text></TouchableOpacity>
          </View>
        </KbSheet>

        {/* WEIGHT GOAL MODAL */}
        <KbSheet visible={showWeightGoalModal} onClose={() => setShowWeightGoalModal(false)} title="Set Weight Goal" insets={insets}>
          <View style={styles.goalInputRow}>
            <TextInput style={[styles.goalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border, borderWidth: 1, flex: 1 }]} value={weightGoalInput} onChangeText={setWeightGoalInput} keyboardType="decimal-pad" placeholder={weightGoalUnit === "kg" ? "e.g. 70" : "e.g. 154"} placeholderTextColor={colors.placeholder} />
            <View style={[styles.toggleGroup, { borderColor: colors.border, borderWidth: 1, marginLeft: 10 }]}>
              <TouchableOpacity style={[styles.toggleBtn, weightGoalUnit === "kg" && { backgroundColor: colors.purple }]} onPress={() => setWeightGoalUnit("kg")}><Text style={[styles.toggleBtnText, { color: weightGoalUnit === "kg" ? "#fff" : colors.textSecondary }]}>kg</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.toggleBtn, weightGoalUnit === "lbs" && { backgroundColor: colors.purple }]} onPress={() => setWeightGoalUnit("lbs")}><Text style={[styles.toggleBtnText, { color: weightGoalUnit === "lbs" ? "#fff" : colors.textSecondary }]}>lbs</Text></TouchableOpacity>
            </View>
          </View>
          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.sectionBg }]} onPress={() => setShowWeightGoalModal(false)}><Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.purple }]} onPress={handleSaveWeightGoal}><Text style={styles.saveText}>Save Goal</Text></TouchableOpacity>
          </View>
        </KbSheet>

        {/* NUTRITION GOAL MODAL */}
        <KbSheet visible={showNutritionGoalModal} onClose={() => setShowNutritionGoalModal(false)} title="Set Nutrition Goals" insets={insets} scrollable>
          <View style={styles.nutGrid}>
            <NutInput label="Calories" unit="cal" value={nutCalGoal} onChange={setNutCalGoal} colors={colors} />
            <NutInput label="Protein" unit="g" value={nutProGoal} onChange={setNutProGoal} colors={colors} />
            <NutInput label="Carbs" unit="g" value={nutCarbGoal} onChange={setNutCarbGoal} colors={colors} />
            <NutInput label="Fats" unit="g" value={nutFatGoal} onChange={setNutFatGoal} colors={colors} />
            <NutInput label="Fiber" unit="g" value={nutFibGoal} onChange={setNutFibGoal} colors={colors} />
          </View>
          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.sectionBg }]} onPress={() => setShowNutritionGoalModal(false)}><Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.purple }]} onPress={handleSaveNutritionGoals}><Text style={styles.saveText}>Save Goals</Text></TouchableOpacity>
          </View>
        </KbSheet>

        {/* IMAGE VIEWER */}
        <Modal visible={!!showImageViewer} animationType="fade" transparent>
          <View style={styles.imageViewerOverlay}>
            {showImageViewer && <Image source={{ uri: showImageViewer }} style={styles.fullImage} resizeMode="contain" />}
            {viewerImages.length > 1 && (
              <View style={styles.viewerNav}>
                {viewerIndex > 0 && (
                  <TouchableOpacity style={styles.viewerNavBtn} onPress={() => { const i = viewerIndex - 1; setViewerIndex(i); setShowImageViewer(viewerImages[i]); }}>
                    <Feather name="chevron-left" size={28} color="#fff" />
                  </TouchableOpacity>
                )}
                <Text style={styles.viewerCounter}>{viewerIndex + 1} / {viewerImages.length}</Text>
                {viewerIndex < viewerImages.length - 1 && (
                  <TouchableOpacity style={styles.viewerNavBtn} onPress={() => { const i = viewerIndex + 1; setViewerIndex(i); setShowImageViewer(viewerImages[i]); }}>
                    <Feather name="chevron-right" size={28} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            )}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowImageViewer(null)}>
              <Feather name="x" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </Modal>
      </View>
  );
}

function NutProgressRow({ label, current, goal, unit, color, colors }: { label: string; current: number; goal: number; unit: string; color: string; colors: any }) {
  const pct = Math.min((current / goal) * 100, 100);
  const barColor = getProgressColor(pct);
  return (
    <View style={styles.nutProgressRow}>
      <View style={styles.nutProgressLabelRow}>
        <Text style={[styles.nutProgressLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.nutProgressVal, { color: colors.textSecondary }]}>{current}{unit} / {goal}{unit}</Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: "rgba(0,0,0,0.08)" }]}>
        <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

function NutInput({ label, unit, value, onChange, colors }: { label: string; unit: string; value: string; onChange: (v: string) => void; colors: any }) {
  return (
    <View style={styles.nutInputItem}>
      <Text style={[styles.nutInputLabel, { color: colors.textSecondary }]}>{label} ({unit})</Text>
      <TextInput style={[styles.nutInputField, { backgroundColor: colors.inputBg, color: colors.text }]} value={value} onChangeText={onChange} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.placeholder} />
    </View>
  );
}

function SleepStat({ label, value, colors, highlight }: { label: string; value: string; colors: any; highlight?: boolean }) {
  return (
    <View style={styles.sleepStat}>
      <Text style={[styles.sleepStatLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.sleepStatValue, { color: highlight ? colors.gold : colors.text }]}>{value}</Text>
    </View>
  );
}

function ExerciseTile({ icon, label, value, colors }: { icon: string; label: string; value: number; colors: any }) {
  return (
    <View style={[styles.exTile, { backgroundColor: colors.sectionBg }]}>
      <Feather name={icon as any} size={18} color={colors.gold} style={{ marginBottom: 4 }} />
      <Text style={[styles.exTileValue, { color: colors.text }]}>{value} min</Text>
      <Text style={[styles.exTileLabel, { color: colors.textSecondary }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function ActivityInput({ icon, label, value, onChange, colors }: { icon: string; label: string; value: string; onChange: (v: string) => void; colors: any }) {
  return (
    <View style={styles.activityRow}>
      <View style={[styles.activityIconBox, { backgroundColor: colors.sectionBg }]}><Feather name={icon as any} size={18} color={colors.gold} /></View>
      <Text style={[styles.activityLabel, { color: colors.text }]}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.placeholder} style={[styles.activityInput, { backgroundColor: colors.inputBg, color: colors.text }]} />
      <Text style={[styles.activityUnit, { color: colors.textSecondary }]}>min</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerIconBtn: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 28, fontWeight: "700" as const },
  headerDate: { fontSize: 13, marginTop: 2 },
  card: { borderRadius: 16, padding: 16, marginBottom: 14, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardTitle: { fontSize: 17, fontWeight: "600" as const },
  addBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  emptyState: { alignItems: "center", paddingVertical: 20, gap: 8 },
  emptyText: { fontSize: 14 },
  tableHeader: { flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1, alignItems: "center", gap: 6 },
  tableHeaderLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  tableHeaderRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  thTime: { width: 52, fontSize: 11, fontWeight: "600" as const },
  thFood: { flex: 1, fontSize: 11, fontWeight: "600" as const },
  thNut: { width: 0 },
  thPhoto: { fontSize: 11, fontWeight: "600" as const },
  fmtToggle: { flexDirection: "row", borderRadius: 6, overflow: "hidden" },
  fmtBtn: { paddingHorizontal: 6, paddingVertical: 3 },
  fmtBtnText: { fontSize: 10, fontWeight: "600" as const },
  modalTimeRow: { flexDirection: "row", alignItems: "center", marginBottom: 0 },
  mealRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 10, borderTopWidth: 0.5, gap: 6 },
  tdTime: { width: 60, fontSize: 11, paddingTop: 2 },
  tdFoodCol: { flex: 1 },
  foodName: { fontSize: 13 },
  nutTagRow: { flexDirection: "row", flexWrap: "wrap", gap: 3, marginTop: 4 },
  nutBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  nutBadgeText: { fontSize: 10, fontWeight: "600" as const },
  tdNutCol: { width: 0 },
  nutEmpty: { fontSize: 12 },
  tdPhotoCol: { width: 46, alignItems: "center", paddingTop: 2 },
  thumbnail: { width: 40, height: 40, borderRadius: 6 },
  noPhoto: { width: 40, height: 40, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  photoCountBadge: { position: "absolute", bottom: 2, right: 2, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 6, minWidth: 16, alignItems: "center" },
  photoCountText: { color: "#fff", fontSize: 9, fontWeight: "700" as const },
  mealActions: { flexDirection: "column", gap: 4, paddingTop: 2 },
  mealActionBtn: { width: 26, height: 26, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  nutProgressSection: { borderTopWidth: 0.5, marginTop: 12, paddingTop: 12 },
  nutProgressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  nutProgressTitle: { fontSize: 12, fontWeight: "600" as const, letterSpacing: 0.4 },
  nutGoalBtn: { fontSize: 12, fontWeight: "600" as const },
  nutProgressRow: { marginBottom: 8 },
  nutProgressLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  nutProgressLabel: { fontSize: 12, fontWeight: "500" as const },
  nutProgressVal: { fontSize: 11 },
  nutGoalHint: { flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: 0.5, paddingTop: 12, marginTop: 8 },
  nutGoalHintText: { fontSize: 12 },
  sectionLabel: { fontSize: 12, fontWeight: "600" as const, letterSpacing: 0.5, marginBottom: 6 },
  nutGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  nutInputItem: { width: "47%" },
  nutInputLabel: { fontSize: 11, fontWeight: "500" as const, marginBottom: 4 },
  nutInputField: { height: 44, borderRadius: 10, paddingHorizontal: 10, fontSize: 15 },
  imageSection: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  cameraBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  cameraBtnText: { fontSize: 14, fontWeight: "500" as const },
  previewImage: { width: 72, height: 72, borderRadius: 8 },
  removePhotoBtn: { position: "absolute", top: 3, right: 3, backgroundColor: "rgba(0,0,0,0.65)", width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  waterHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  waterTitleRow: { flexDirection: "row", alignItems: "center" },
  waterHeaderRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  toggleGroup: { flexDirection: "row", borderRadius: 8, overflow: "hidden" },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  toggleBtnText: { fontSize: 13, fontWeight: "600" as const },
  addWaterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  addWaterBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" as const },
  amountCard: { borderRadius: 12, padding: 14, marginBottom: 10 },
  amountBig: { fontSize: 32, fontWeight: "700" as const },
  goalChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  goalChipText: { fontSize: 12 },
  progressTrack: { height: 7, borderRadius: 4, overflow: "hidden", marginBottom: 6 },
  progressFill: { height: 7, borderRadius: 4 },
  progressLabel: { fontSize: 12 },
  sleepRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  sleepStat: { alignItems: "center", flex: 1 },
  sleepStatLabel: { fontSize: 11, marginBottom: 4 },
  sleepStatValue: { fontSize: 18, fontWeight: "600" as const },
  formatToggleRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  sleepPickerSection: {},
  sleepPickerLabel: { fontSize: 12, fontWeight: "600" as const, letterSpacing: 0.5, marginBottom: 6 },
  sleepTotalBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10 },
  sleepTotalText: { fontSize: 16, fontWeight: "600" as const },
  sleepNotesInput: { borderRadius: 10, padding: 12, fontSize: 14, minHeight: 60, textAlignVertical: "top" },
  exerciseGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  exTile: { width: "48%", paddingVertical: 8, paddingHorizontal: 8, borderRadius: 10, alignItems: "center" },
  exTileValue: { fontSize: 14, fontWeight: "700" as const, marginBottom: 1 },
  exTileLabel: { fontSize: 10 },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  activityIconBox: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  activityLabel: { flex: 1, fontSize: 14, fontWeight: "500" as const },
  activityInput: { width: 90, height: 48, borderRadius: 10, textAlign: "center", fontSize: 20, fontWeight: "600" as const },
  activityUnit: { fontSize: 13, width: 30 },
  customActivitySection: { padding: 12, marginTop: 8, marginBottom: 8 },
  customActivityRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  customActivityInput: { height: 44, borderRadius: 10, paddingHorizontal: 12, fontSize: 14 },
  customActivityMins: { width: 60, height: 44, borderRadius: 10, textAlign: "center", fontSize: 16, fontWeight: "600" as const },
  exTotalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12, borderRadius: 10 },
  exTotalLabel: { fontSize: 14 },
  exTotalValue: { fontSize: 18, fontWeight: "700" as const },
  waterEntryList: { paddingTop: 8 },
  waterEntryRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  waterEntryTime: { fontSize: 12, minWidth: 50 },
  waterEntryAmt: { flex: 1, fontSize: 13, fontWeight: "500" as const },
  timeRow: { flexDirection: "row", alignItems: "center", height: 48 },
  timeInput: { flex: 1, paddingHorizontal: 12, fontSize: 16 },
  foodInputRow: { flexDirection: "row", alignItems: "flex-start", minHeight: 80, padding: 12 },
  foodInput: { flex: 1, fontSize: 15, lineHeight: 22 },
  micBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginLeft: 8, marginTop: 2 },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: "center" },
  cancelText: { fontSize: 15, fontWeight: "600" as const },
  saveBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: "center" },
  saveText: { color: "#fff", fontSize: 15, fontWeight: "600" as const },
  hint: { fontSize: 13, marginBottom: 12 },
  manualRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  manualInput: { flex: 1, height: 48, borderRadius: 10, paddingHorizontal: 14, fontSize: 15 },
  manualAddBtn: { width: 48, height: 48, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  goalInputRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  goalInput: { height: 52, borderRadius: 10, paddingHorizontal: 14, fontSize: 22, fontWeight: "600" as const },
  presetsRow: { flexDirection: "row", gap: 8 },
  presetChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  presetChipText: { fontSize: 13, fontWeight: "500" as const },
  imageViewerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" },
  fullImage: { width: "100%", height: "80%" },
  closeBtn: { position: "absolute", top: 60, right: 20, width: 44, height: 44, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 22, alignItems: "center", justifyContent: "center" },
  viewerNav: { flexDirection: "row", alignItems: "center", gap: 20, marginTop: 16 },
  viewerNavBtn: { padding: 8 },
  viewerCounter: { color: "rgba(255,255,255,0.7)", fontSize: 14 },
  deleteWeightBtn: { flexDirection: "row", alignItems: "center", gap: 6, padding: 12, borderRadius: 10, borderWidth: 1, borderStyle: "dashed", marginTop: 8, justifyContent: "center" },
  deleteWeightText: { color: "#EF4444", fontSize: 13, fontWeight: "600" as const },
});
