import React, { useState } from "react";
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
import { useApp } from "@/context/AppContext";
import {
  useDateString, formatTimeFromDate, formatDisplayDate,
  mlToGallons, parseWaterInput, calcSleepHours, calcSleepHoursNum,
  getProgressColor,
} from "@/hooks/useDateString";
import { SimpleTimeInput, parse24h, to24h } from "@/components/WheelPicker";

const GAL_PRESETS = [
  { label: "0.5 gal", ml: 1893 },
  { label: "1 gal", ml: 3785 },
  { label: "1.5 gal", ml: 5678 },
  { label: "2 gal", ml: 7571 },
];
const SLEEP_PRESETS = [6, 7, 8, 9];
const EXERCISE_PRESETS = [20, 30, 45, 60];
const WEIGHT_KG_PRESETS = [50, 60, 70, 80, 90, 100];

function KbSheet({ visible, onClose, title, children, insets }: {
  visible: boolean; onClose: () => void; title: string; children: React.ReactNode;
  insets: { bottom: number };
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={shStyles.overlay}>
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={[shStyles.sheet, { paddingBottom: insets.bottom + 16 }]}>
              <View style={shStyles.handle} />
              <Text style={shStyles.title}>{title}</Text>
              {children}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const shStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E0D8F0", alignSelf: "center", marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "700" as const, marginBottom: 16, color: "#1A1A2E" },
});

function Simple24hInput({ value, onChange, colors }: { value: string; onChange: (v: string) => void; colors: any }) {
  const [text, setText] = React.useState(value || "22:00");
  React.useEffect(() => { setText(value); }, [value]);
  const tryEmit = (t: string) => {
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (m) {
      const h = parseInt(m[1], 10);
      const mn = parseInt(m[2], 10);
      if (h >= 0 && h <= 23 && mn >= 0 && mn <= 59) {
        onChange(`${String(h).padStart(2, "0")}:${String(mn).padStart(2, "0")}`);
      }
    }
  };
  return (
    <TextInput
      value={text}
      onChangeText={(t) => { setText(t); tryEmit(t); }}
      placeholder="22:00"
      keyboardType="numbers-and-punctuation"
      maxLength={5}
      style={{
        flex: 1, height: 52, borderRadius: 10, paddingHorizontal: 16,
        fontSize: 24, fontWeight: "600" as const,
        backgroundColor: colors.inputBg, color: colors.text,
      }}
    />
  );
}

export default function DiaryScreen() {
  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const today = useDateString();

  const {
    meals, waterEntries, sleepLogs, weightLogs,
    addMeal, deleteMeal, addWaterEntry, deleteWaterEntry, updateWaterEntry, addSleepLog, updateSleepLog,
    saveExerciseLog, getTodayExercise,
    saveWeightEntry, deleteWeightEntry, getWeightEntry,
    waterGoalMl, setWaterGoalMl,
    sleepGoalHours, setSleepGoalHours,
    exerciseGoalMinutes, setExerciseGoalMinutes,
    weightGoalKg, setWeightGoalKg,
  } = useApp();

  const todayMeals = meals.filter((m) => m.date === today).sort((a, b) => a.time.localeCompare(b.time));
  const todayWaterTotal = waterEntries.filter((w) => w.date === today).reduce((sum, w) => sum + w.amountMl, 0);
  const todaySleep = sleepLogs.find((s) => s.date === today);
  const todayExercise = getTodayExercise(today);
  const todayWeight = getWeightEntry(today);

  const [showMealModal, setShowMealModal] = useState(false);
  const [showWaterModal, setShowWaterModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showSleepSheet, setShowSleepSheet] = useState(false);
  const [showSleepGoalModal, setShowSleepGoalModal] = useState(false);
  const [showExerciseSheet, setShowExerciseSheet] = useState(false);
  const [showExerciseGoalModal, setShowExerciseGoalModal] = useState(false);
  const [showWeightSheet, setShowWeightSheet] = useState(false);
  const [showWeightGoalModal, setShowWeightGoalModal] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState<string | null>(null);
  const [waterUnit, setWaterUnit] = useState<"ml" | "gal">("ml");
  const [sleepTimeFormat, setSleepTimeFormat] = useState<"12h" | "24h">("12h");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">("kg");

  const [mealTime, setMealTime] = useState(formatTimeFromDate(new Date()));
  const [mealFood, setMealFood] = useState("");
  const [mealImage, setMealImage] = useState<string | undefined>(undefined);

  const [waterManual, setWaterManual] = useState("");
  const [waterText, setWaterText] = useState("");
  const [editingWaterId, setEditingWaterId] = useState<string | null>(null);
  const [editWaterAmount, setEditWaterAmount] = useState("");

  const [bedtime, setBedtime] = useState(todaySleep?.bedtime ?? "22:00");
  const [wakeTime, setWakeTime] = useState(todaySleep?.wakeTime ?? "07:00");
  const [sleepNotes, setSleepNotes] = useState(todaySleep?.notes ?? "");

  const [exRunning, setExRunning] = useState("0");
  const [exWalking, setExWalking] = useState("0");
  const [exStrength, setExStrength] = useState("0");
  const [exCardio, setExCardio] = useState("0");

  const [weightInput, setWeightInput] = useState("");
  const [weightNotes, setWeightNotes] = useState("");

  const [goalInput, setGoalInput] = useState(mlToGallons(waterGoalMl));
  const [goalUnit, setGoalUnit] = useState<"gal" | "ml">("gal");
  const [sleepGoalInput, setSleepGoalInput] = useState(String(sleepGoalHours));
  const [exerciseGoalInput, setExerciseGoalInput] = useState(String(exerciseGoalMinutes));
  const [weightGoalInput, setWeightGoalInput] = useState(String(weightGoalKg));
  const [weightGoalUnit, setWeightGoalUnit] = useState<"kg" | "lbs">("kg");

  const waterPct = Math.min((todayWaterTotal / waterGoalMl) * 100, 100);
  const topPad = Platform.OS === "web" ? 67 + insets.top : insets.top;
  const tabBarHeight = Platform.OS === "web" ? 60 : 50;
  const bottomPad = insets.bottom + tabBarHeight + 16;

  const sleepHoursToday = calcSleepHoursNum(todaySleep?.bedtime ?? "", todaySleep?.wakeTime ?? "");
  const sleepPct = Math.min((sleepHoursToday / sleepGoalHours) * 100, 100);

  const exMinRunning = parseInt(exRunning || "0", 10);
  const exMinWalking = parseInt(exWalking || "0", 10);
  const exMinStrength = parseInt(exStrength || "0", 10);
  const exMinCardio = parseInt(exCardio || "0", 10);
  const exTotalSheet = exMinRunning + exMinWalking + exMinStrength + exMinCardio;

  const totalExerciseMin = (todayExercise?.running ?? 0) + (todayExercise?.walking ?? 0) +
    (todayExercise?.strengthTraining ?? 0) + (todayExercise?.cardio ?? 0);
  const exercisePct = Math.min((totalExerciseMin / exerciseGoalMinutes) * 100, 100);

  const goalDisplayStr = waterUnit === "gal" ? `${mlToGallons(waterGoalMl)} gal` : `${waterGoalMl} ml`;
  const waterAmountDisplay = waterUnit === "ml" ? `${todayWaterTotal} ml` : `${mlToGallons(todayWaterTotal)} gal`;

  const kgToLbs = (kg: number) => (kg * 2.20462).toFixed(1);
  const lbsToKg = (lbs: number) => lbs / 2.20462;
  const weightDisplayStr = todayWeight
    ? (weightUnit === "kg" ? `${todayWeight.weightKg.toFixed(1)} kg` : `${kgToLbs(todayWeight.weightKg)} lbs`)
    : "—";
  const weightGoalDisplay = weightUnit === "kg" ? `${weightGoalKg.toFixed(1)} kg` : `${kgToLbs(weightGoalKg)} lbs`;

  const handlePickImage = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== "granted") {
      const gp = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (gp.status !== "granted") { Alert.alert("Permission needed", "Camera or photo library access required."); return; }
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
      if (!r.canceled && r.assets[0]) setMealImage(r.assets[0].uri);
      return;
    }
    Alert.alert("Add Photo", "Choose source", [
      { text: "Camera", onPress: async () => { const r = await ImagePicker.launchCameraAsync({ quality: 0.8 }); if (!r.canceled && r.assets[0]) setMealImage(r.assets[0].uri); } },
      { text: "Photo Library", onPress: async () => { const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 }); if (!r.canceled && r.assets[0]) setMealImage(r.assets[0].uri); } },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleSaveMeal = async () => {
    if (!mealFood.trim()) { Alert.alert("Required", "Please enter food details."); return; }
    await addMeal({ date: today, time: mealTime, foodDetails: mealFood.trim(), imagePath: mealImage });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowMealModal(false); setMealFood(""); setMealImage(undefined);
  };

  const handleManualWater = async () => {
    const amount = parseFloat(waterManual);
    if (isNaN(amount) || amount <= 0) { Alert.alert("Invalid", "Enter a number > 0."); return; }
    const ml = waterUnit === "gal" ? Math.round(amount * 3785.41) : Math.round(amount);
    await addWaterEntry({ date: today, amountMl: ml, time: formatTimeFromDate(new Date()) });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWaterManual(""); setShowWaterModal(false);
  };

  const handleSaveSleep = async () => {
    if (todaySleep) await updateSleepLog(todaySleep.id, { bedtime, wakeTime, notes: sleepNotes });
    else await addSleepLog({ date: today, bedtime, wakeTime, notes: sleepNotes });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowSleepSheet(false);
  };

  const handleSaveExercise = async () => {
    await saveExerciseLog({
      date: today,
      running: exMinRunning,
      walking: exMinWalking,
      strengthTraining: exMinStrength,
      cardio: exMinCardio,
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

  const handleSaveExerciseGoal = async () => {
    const val = parseInt(exerciseGoalInput, 10);
    if (isNaN(val) || val <= 0) { Alert.alert("Invalid", "Enter a valid exercise goal."); return; }
    await setExerciseGoalMinutes(val);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowExerciseGoalModal(false);
  };

  const handleQuickExerciseGoal = async (minutes: number) => {
    await setExerciseGoalMinutes(minutes);
    setExerciseGoalInput(String(minutes));
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

  const openExercise = () => {
    setExRunning(String(todayExercise?.running ?? 0));
    setExWalking(String(todayExercise?.walking ?? 0));
    setExStrength(String(todayExercise?.strengthTraining ?? 0));
    setExCardio(String(todayExercise?.cardio ?? 0));
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
      const display = weightUnit === "kg" ? todayWeight.weightKg.toFixed(1) : kgToLbs(todayWeight.weightKg);
      setWeightInput(display);
      setWeightNotes(todayWeight.notes ?? "");
    } else {
      setWeightInput("");
      setWeightNotes("");
    }
    setShowWeightSheet(true);
  };

  const totalHoursStr = calcSleepHours(todaySleep?.bedtime ?? "", todaySleep?.wakeTime ?? "");

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: topPad + 16 }]}>
          <Text style={[styles.headerTitle, { color: colors.headerText }]}>Diary</Text>
          <Text style={[styles.headerDate, { color: colors.headerTextSecondary }]}>{formatDisplayDate(today)}</Text>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* FOOD LOG */}
          <SectionCard title="Food Log" colors={colors} onAdd={() => { setShowMealModal(true); setMealTime(formatTimeFromDate(new Date())); }}>
            {todayMeals.length === 0 ? <EmptyState icon="coffee" text="No food logged today" colors={colors} /> : (
              <View>
                <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.thTime, { color: colors.textSecondary }]}>Time</Text>
                  <Text style={[styles.thFood, { color: colors.textSecondary }]}>Food</Text>
                  <Text style={[styles.thPhoto, { color: colors.textSecondary }]}>Photo</Text>
                </View>
                {todayMeals.map((meal) => (
                  <TouchableOpacity key={meal.id} style={[styles.tableRow, { borderBottomColor: colors.borderLight }]}
                    onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); Alert.alert("Delete?", meal.foodDetails, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => deleteMeal(meal.id) }]); }}>
                    <Text style={[styles.tdTime, { color: colors.text }]}>{meal.time}</Text>
                    <Text style={[styles.tdFood, { color: colors.text }]} numberOfLines={2}>{meal.foodDetails}</Text>
                    <View style={styles.tdPhoto}>
                      {meal.imagePath ? (
                        <TouchableOpacity onPress={() => setShowImageViewer(meal.imagePath!)}>
                          <Image source={{ uri: meal.imagePath }} style={styles.thumbnail} />
                        </TouchableOpacity>
                      ) : (
                        <View style={[styles.noPhoto, { backgroundColor: colors.borderLight }]}><Feather name="image" size={14} color={colors.placeholder} /></View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </SectionCard>

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
            <View style={[styles.amountCard, { backgroundColor: colors.tealLight }]}>
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
          <SectionCard title="Sleep" colors={colors} onAdd={openSleep}>
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
                <EmptyState icon="moon" text="Tap to log your sleep" colors={colors} />
                <TouchableOpacity style={[styles.goalChip, { backgroundColor: colors.sectionBg, borderColor: colors.border, borderWidth: 1, alignSelf: "flex-end", marginTop: 8 }]}
                  onPress={() => { setSleepGoalInput(String(sleepGoalHours)); setShowSleepGoalModal(true); }}>
                  <Text style={[styles.goalChipText, { color: colors.textSecondary }]}>Goal: {sleepGoalHours}h</Text>
                  <Feather name="chevron-down" size={12} color={colors.textSecondary} style={{ marginLeft: 2 }} />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          </SectionCard>

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
                <EmptyState icon="trending-up" text="Tap to log your weight" colors={colors} />
                <TouchableOpacity style={[styles.goalChip, { backgroundColor: colors.sectionBg, borderColor: colors.border, borderWidth: 1, alignSelf: "flex-end", marginTop: 8 }]}
                  onPress={() => { setWeightGoalInput(weightUnit === "kg" ? String(weightGoalKg) : kgToLbs(weightGoalKg)); setWeightGoalUnit(weightUnit); setShowWeightGoalModal(true); }}>
                  <Text style={[styles.goalChipText, { color: colors.textSecondary }]}>Goal: {weightGoalDisplay}</Text>
                  <Feather name="chevron-down" size={12} color={colors.textSecondary} style={{ marginLeft: 2 }} />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          </View>

          {/* EXERCISE */}
          <SectionCard title="Exercise" colors={colors} onAdd={openExercise}>
            {todayExercise && totalExerciseMin > 0 ? (
              <TouchableOpacity onPress={openExercise}>
                <View style={styles.exerciseGrid}>
                  <ExerciseTile icon="activity" label="Running" value={todayExercise.running} colors={colors} />
                  <ExerciseTile icon="navigation" label="Walking" value={todayExercise.walking} colors={colors} />
                  <ExerciseTile icon="zap" label="Strength Training" value={todayExercise.strengthTraining} colors={colors} />
                  <ExerciseTile icon="heart" label="Cardio" value={todayExercise.cardio} colors={colors} />
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
                <EmptyState icon="trending-up" text="Tap to log exercise" colors={colors} />
                <TouchableOpacity style={[styles.goalChip, { backgroundColor: colors.sectionBg, borderColor: colors.border, borderWidth: 1, alignSelf: "flex-end", marginTop: 8 }]}
                  onPress={() => { setExerciseGoalInput(String(exerciseGoalMinutes)); setShowExerciseGoalModal(true); }}>
                  <Text style={[styles.goalChipText, { color: colors.textSecondary }]}>Goal: {exerciseGoalMinutes}min</Text>
                  <Feather name="chevron-down" size={12} color={colors.textSecondary} style={{ marginLeft: 2 }} />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          </SectionCard>
        </ScrollView>

        {/* MEAL MODAL */}
        <KbSheet visible={showMealModal} onClose={() => { setShowMealModal(false); setMealFood(""); setMealImage(undefined); }} title="Add Food" insets={insets}>
          <View style={[styles.timeRow, { backgroundColor: colors.inputBg, borderRadius: 10 }]}>
            <Feather name="clock" size={16} color={colors.textSecondary} style={{ marginLeft: 12 }} />
            <TextInput style={[styles.timeInput, { color: colors.text }]} value={mealTime} onChangeText={setMealTime} placeholder="HH:MM" placeholderTextColor={colors.placeholder} />
          </View>
          <View style={[styles.foodInputRow, { backgroundColor: colors.inputBg, borderRadius: 10, marginTop: 10 }]}>
            <TextInput style={[styles.foodInput, { color: colors.text }]} value={mealFood} onChangeText={setMealFood} placeholder="Food details…" placeholderTextColor={colors.placeholder} multiline numberOfLines={3} />
            <TouchableOpacity style={[styles.micBtn, { backgroundColor: colors.borderLight }]} onPress={() => Alert.alert("Voice Input", "Type food details manually or take a photo.")}>
              <Feather name="mic" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.imageRow}>
            <TouchableOpacity style={[styles.cameraBtn, { backgroundColor: colors.sectionBg }]} onPress={handlePickImage}>
              <Feather name="camera" size={18} color={colors.gold} />
              <Text style={[styles.cameraBtnText, { color: colors.gold }]}>Add Photo</Text>
            </TouchableOpacity>
            {mealImage && <TouchableOpacity onPress={() => setMealImage(undefined)}><Image source={{ uri: mealImage }} style={styles.previewImage} /></TouchableOpacity>}
          </View>
          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.sectionBg }]} onPress={() => { setShowMealModal(false); setMealFood(""); setMealImage(undefined); }}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.gold }]} onPress={handleSaveMeal}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </KbSheet>

        {/* WATER MODAL */}
        <KbSheet visible={showWaterModal} onClose={() => { setShowWaterModal(false); setWaterManual(""); setEditingWaterId(null); }} title="Log Water" insets={insets}>
          <View style={[styles.manualRow, { marginBottom: 0 }]}>
            <TextInput
              style={[styles.manualInput, { backgroundColor: colors.inputBg, color: colors.text }]}
              value={waterManual}
              onChangeText={setWaterManual}
              placeholder={`Amount in ${waterUnit}`}
              placeholderTextColor={colors.placeholder}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity style={[styles.manualAddBtn, { backgroundColor: colors.teal }]} onPress={handleManualWater}>
              <Feather name="plus" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          {/* Today's entries */}
          {waterEntries.filter((w) => w.date === today).length > 0 && (
            <View style={[styles.waterEntryList, { borderTopColor: colors.border, borderTopWidth: 1, marginTop: 14 }]}>
              <Text style={[styles.hint, { color: colors.textSecondary, marginBottom: 6, marginTop: 2 }]}>Today's entries</Text>
              {waterEntries.filter((w) => w.date === today).sort((a, b) => a.id.localeCompare(b.id)).map((w) => (
                <View key={w.id}>
                  {editingWaterId === w.id ? (
                    <View style={styles.waterEntryRow}>
                      <TextInput
                        style={[styles.manualInput, { flex: 1, backgroundColor: colors.inputBg, color: colors.text, height: 38 }]}
                        value={editWaterAmount}
                        onChangeText={setEditWaterAmount}
                        keyboardType="decimal-pad"
                        autoFocus
                      />
                      <TouchableOpacity style={[styles.manualAddBtn, { backgroundColor: colors.teal, height: 38, width: 38 }]} onPress={async () => {
                        const amt = waterUnit === "gal" ? Math.round(parseFloat(editWaterAmount) * 3785.41) : Math.round(parseFloat(editWaterAmount));
                        if (!isNaN(amt) && amt > 0) { await updateWaterEntry(w.id, amt); }
                        setEditingWaterId(null);
                      }}>
                        <Feather name="check" size={16} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.manualAddBtn, { backgroundColor: colors.sectionBg, height: 38, width: 38 }]} onPress={() => setEditingWaterId(null)}>
                        <Feather name="x" size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.waterEntryRow}>
                      <Feather name="clock" size={12} color={colors.placeholder} />
                      <Text style={[styles.waterEntryTime, { color: colors.textSecondary }]}>{w.time ?? "—"}</Text>
                      <Text style={[styles.waterEntryAmt, { color: colors.text }]}>
                        {waterUnit === "gal" ? `${mlToGallons(w.amountMl)} gal` : `${w.amountMl} ml`}
                      </Text>
                      <TouchableOpacity onPress={() => { setEditingWaterId(w.id); setEditWaterAmount(waterUnit === "gal" ? mlToGallons(w.amountMl) : String(w.amountMl)); }}>
                        <Feather name="edit-2" size={14} color={colors.tint} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); deleteWaterEntry(w.id); }}>
                        <Feather name="trash-2" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
          <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.sectionBg, marginTop: 14 }]} onPress={() => { setShowWaterModal(false); setWaterManual(""); setEditingWaterId(null); }}>
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
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
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.sectionBg }]} onPress={() => setShowGoalModal(false)}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.purple }]} onPress={handleSaveWaterGoal}>
              <Text style={styles.saveText}>Save Goal</Text>
            </TouchableOpacity>
          </View>
        </KbSheet>

        {/* SLEEP SHEET */}
        <Modal visible={showSleepSheet} animationType="slide" transparent>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View style={shStyles.overlay}>
              <TouchableWithoutFeedback onPress={() => setShowSleepSheet(false)}>
                <View style={StyleSheet.absoluteFill} />
              </TouchableWithoutFeedback>
              <View style={[shStyles.sheet, { paddingBottom: insets.bottom + 16, backgroundColor: colors.surface }]}>
                <View style={[shStyles.handle, { backgroundColor: colors.border }]} />
                <Text style={[shStyles.title, { color: colors.text }]}>Sleep Log</Text>

                {/* Time format toggle */}
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
                  {sleepTimeFormat === "12h" ? (
                    <SimpleTimeInput value={bedtime} onChange={setBedtime} colors={colors} />
                  ) : (
                    <Simple24hInput value={bedtime} onChange={setBedtime} colors={colors} />
                  )}
                </View>
                <View style={[styles.sleepPickerSection, { marginTop: 12 }]}>
                  <Text style={[styles.sleepPickerLabel, { color: colors.textSecondary }]}>Wake Time</Text>
                  {sleepTimeFormat === "12h" ? (
                    <SimpleTimeInput value={wakeTime} onChange={setWakeTime} colors={colors} />
                  ) : (
                    <Simple24hInput value={wakeTime} onChange={setWakeTime} colors={colors} />
                  )}
                </View>
                <View style={[styles.sleepTotalBox, { backgroundColor: colors.tealLight, marginTop: 12 }]}>
                  <Feather name="moon" size={18} color={colors.gold} />
                  <Text style={[styles.sleepTotalText, { color: colors.gold }]}>Total: {calcSleepHours(bedtime, wakeTime)}</Text>
                </View>
                <TextInput
                  style={[styles.sleepNotesInput, { backgroundColor: colors.inputBg, color: colors.text, marginTop: 10 }]}
                  value={sleepNotes} onChangeText={setSleepNotes}
                  placeholder="Optional notes…" placeholderTextColor={colors.placeholder}
                  multiline numberOfLines={2}
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.sectionBg }]} onPress={() => setShowSleepSheet(false)}>
                    <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.gold }]} onPress={handleSaveSleep}>
                    <Text style={styles.saveText}>Save</Text>
                  </TouchableOpacity>
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
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.sectionBg }]} onPress={() => setShowSleepGoalModal(false)}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.gold }]} onPress={handleSaveSleepGoal}>
              <Text style={styles.saveText}>Save Goal</Text>
            </TouchableOpacity>
          </View>
        </KbSheet>

        {/* EXERCISE SHEET */}
        <Modal visible={showExerciseSheet} animationType="slide" transparent>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View style={shStyles.overlay}>
              <TouchableWithoutFeedback onPress={() => setShowExerciseSheet(false)}>
                <View style={StyleSheet.absoluteFill} />
              </TouchableWithoutFeedback>
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={[shStyles.sheet, { paddingBottom: insets.bottom + 16, backgroundColor: colors.surface }]}>
                  <View style={[shStyles.handle, { backgroundColor: colors.border }]} />
                  <Text style={[shStyles.title, { color: colors.text }]}>Log Exercise</Text>
                  <Text style={[styles.hint, { color: colors.textSecondary }]}>Enter duration in minutes for each activity</Text>
                  <View style={{ marginBottom: 4 }}>
                    <ActivityInput icon="activity" label="Running" value={exRunning} onChange={setExRunning} colors={colors} />
                    <ActivityInput icon="navigation" label="Walking" value={exWalking} onChange={setExWalking} colors={colors} />
                    <ActivityInput icon="zap" label="Strength Training" value={exStrength} onChange={setExStrength} colors={colors} />
                    <ActivityInput icon="heart" label="Cardio" value={exCardio} onChange={setExCardio} colors={colors} />
                  </View>
                  <View style={[styles.exTotalRow, { backgroundColor: colors.sectionBg }]}>
                    <Text style={[styles.exTotalLabel, { color: colors.textSecondary }]}>Total Active Time</Text>
                    <Text style={[styles.exTotalValue, { color: colors.gold }]}>{exTotalSheet} min</Text>
                  </View>
                  <View style={styles.modalButtons}>
                    <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.sectionBg }]} onPress={() => setShowExerciseSheet(false)}>
                      <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.gold }]} onPress={handleSaveExercise}>
                      <Text style={styles.saveText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* EXERCISE GOAL MODAL */}
        <KbSheet visible={showExerciseGoalModal} onClose={() => setShowExerciseGoalModal(false)} title="Set Exercise Goal" insets={insets}>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>Recommended: 30+ minutes per day</Text>
          <Text style={[styles.hint, { color: colors.textSecondary, marginBottom: 4 }]}>Tap a preset to apply instantly, or type a custom value:</Text>
          <View style={[styles.presetsRow, { marginBottom: 12, flexWrap: "wrap" }]}>
            {EXERCISE_PRESETS.map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.presetChip, { backgroundColor: exerciseGoalMinutes === m ? colors.gold : colors.sectionBg, borderColor: exerciseGoalMinutes === m ? colors.gold : colors.border, borderWidth: 1 }]}
                onPress={() => handleQuickExerciseGoal(m)}
              >
                <Text style={[styles.presetChipText, { color: exerciseGoalMinutes === m ? "#fff" : colors.text }]}>{m} min</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={[styles.manualRow, { marginBottom: 8 }]}>
            <TextInput
              style={[styles.goalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border, borderWidth: 1, flex: 1 }]}
              value={exerciseGoalInput}
              onChangeText={setExerciseGoalInput}
              keyboardType="number-pad"
              placeholder="Minutes"
              placeholderTextColor={colors.placeholder}
            />
            <Text style={[styles.activityUnit, { color: colors.textSecondary, marginLeft: 8, alignSelf: "center" }]}>min</Text>
          </View>
          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.sectionBg }]} onPress={() => setShowExerciseGoalModal(false)}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.gold }]} onPress={handleSaveExerciseGoal}>
              <Text style={styles.saveText}>Save Goal</Text>
            </TouchableOpacity>
          </View>
        </KbSheet>

        {/* WEIGHT SHEET */}
        <KbSheet visible={showWeightSheet} onClose={() => setShowWeightSheet(false)} title={todayWeight ? "Edit Weight" : "Log Weight"} insets={insets}>
          <View style={styles.goalInputRow}>
            <TextInput
              style={[styles.goalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border, borderWidth: 1, flex: 1 }]}
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="decimal-pad"
              placeholder={weightUnit === "kg" ? "e.g. 72.5" : "e.g. 159.8"}
              placeholderTextColor={colors.placeholder}
            />
            <View style={[styles.toggleGroup, { borderColor: colors.border, borderWidth: 1, marginLeft: 10 }]}>
              <TouchableOpacity style={[styles.toggleBtn, weightUnit === "kg" && { backgroundColor: colors.purple }]} onPress={() => setWeightUnit("kg")}>
                <Text style={[styles.toggleBtnText, { color: weightUnit === "kg" ? "#fff" : colors.textSecondary }]}>kg</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toggleBtn, weightUnit === "lbs" && { backgroundColor: colors.purple }]} onPress={() => setWeightUnit("lbs")}>
                <Text style={[styles.toggleBtnText, { color: weightUnit === "lbs" ? "#fff" : colors.textSecondary }]}>lbs</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={[styles.presetsRow, { marginBottom: 12, flexWrap: "wrap" }]}>
            {WEIGHT_KG_PRESETS.map((kg) => {
              const display = weightUnit === "kg" ? `${kg}kg` : `${kgToLbs(kg)}lbs`;
              return (
                <TouchableOpacity key={kg} style={[styles.presetChip, { backgroundColor: colors.sectionBg, borderColor: colors.border, borderWidth: 1 }]}
                  onPress={() => setWeightInput(weightUnit === "kg" ? String(kg) : kgToLbs(kg))}>
                  <Text style={[styles.presetChipText, { color: colors.text }]}>{display}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TextInput
            style={[styles.sleepNotesInput, { backgroundColor: colors.inputBg, color: colors.text }]}
            value={weightNotes}
            onChangeText={setWeightNotes}
            placeholder="Optional notes…"
            placeholderTextColor={colors.placeholder}
            multiline
            numberOfLines={2}
          />
          {todayWeight && (
            <TouchableOpacity style={[styles.deleteWeightBtn, { borderColor: "#EF4444" }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); Alert.alert("Delete entry?", undefined, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => { deleteWeightEntry(todayWeight.id); setShowWeightSheet(false); } }]); }}>
              <Feather name="trash-2" size={14} color="#EF4444" />
              <Text style={[styles.deleteWeightText]}>Delete today's entry</Text>
            </TouchableOpacity>
          )}
          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.sectionBg }]} onPress={() => setShowWeightSheet(false)}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.purple }]} onPress={handleSaveWeight}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </KbSheet>

        {/* WEIGHT GOAL MODAL */}
        <KbSheet visible={showWeightGoalModal} onClose={() => setShowWeightGoalModal(false)} title="Set Weight Goal" insets={insets}>
          <View style={styles.goalInputRow}>
            <TextInput
              style={[styles.goalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border, borderWidth: 1, flex: 1 }]}
              value={weightGoalInput}
              onChangeText={setWeightGoalInput}
              keyboardType="decimal-pad"
              placeholder={weightGoalUnit === "kg" ? "e.g. 70" : "e.g. 154"}
              placeholderTextColor={colors.placeholder}
            />
            <View style={[styles.toggleGroup, { borderColor: colors.border, borderWidth: 1, marginLeft: 10 }]}>
              <TouchableOpacity style={[styles.toggleBtn, weightGoalUnit === "kg" && { backgroundColor: colors.purple }]} onPress={() => setWeightGoalUnit("kg")}>
                <Text style={[styles.toggleBtnText, { color: weightGoalUnit === "kg" ? "#fff" : colors.textSecondary }]}>kg</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toggleBtn, weightGoalUnit === "lbs" && { backgroundColor: colors.purple }]} onPress={() => setWeightGoalUnit("lbs")}>
                <Text style={[styles.toggleBtnText, { color: weightGoalUnit === "lbs" ? "#fff" : colors.textSecondary }]}>lbs</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={[styles.presetsRow, { flexWrap: "wrap", marginBottom: 12 }]}>
            {WEIGHT_KG_PRESETS.map((kg) => {
              const display = weightGoalUnit === "kg" ? `${kg}kg` : `${kgToLbs(kg)}lbs`;
              return (
                <TouchableOpacity key={kg} style={[styles.presetChip, { backgroundColor: colors.sectionBg, borderColor: colors.border, borderWidth: 1 }]}
                  onPress={() => setWeightGoalInput(weightGoalUnit === "kg" ? String(kg) : kgToLbs(kg))}>
                  <Text style={[styles.presetChipText, { color: colors.text }]}>{display}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.sectionBg }]} onPress={() => setShowWeightGoalModal(false)}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.purple }]} onPress={handleSaveWeightGoal}>
              <Text style={styles.saveText}>Save Goal</Text>
            </TouchableOpacity>
          </View>
        </KbSheet>

        {/* IMAGE VIEWER */}
        <Modal visible={!!showImageViewer} animationType="fade" transparent>
          <TouchableOpacity style={styles.imageViewerOverlay} activeOpacity={1} onPress={() => setShowImageViewer(null)}>
            {showImageViewer && <Image source={{ uri: showImageViewer }} style={styles.fullImage} resizeMode="contain" />}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowImageViewer(null)}>
              <Feather name="x" size={24} color="#fff" />
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

function GoalProgressBar({ pct }: { pct: number }) {
  const color = getProgressColor(pct);
  return (
    <View style={[styles.progressTrack, { backgroundColor: "rgba(0,0,0,0.08)" }]}>
      <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: color }]} />
    </View>
  );
}

function SectionCard({ title, colors, onAdd, children }: { title: string; colors: typeof Colors.light; onAdd: () => void; children: React.ReactNode }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.gold }]} onPress={onAdd}>
          <Feather name="plus" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
      {children}
    </View>
  );
}

function EmptyState({ icon, text, colors }: { icon: string; text: string; colors: typeof Colors.light }) {
  return (
    <View style={styles.emptyState}>
      <Feather name={icon as any} size={24} color={colors.placeholder} />
      <Text style={[styles.emptyText, { color: colors.placeholder }]}>{text}</Text>
    </View>
  );
}

function SleepStat({ label, value, colors, highlight }: { label: string; value: string; colors: typeof Colors.light; highlight?: boolean }) {
  return (
    <View style={styles.sleepStat}>
      <Text style={[styles.sleepStatLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.sleepStatValue, { color: highlight ? colors.gold : colors.text }]}>{value}</Text>
    </View>
  );
}

function ExerciseTile({ icon, label, value, colors }: { icon: string; label: string; value: number; colors: typeof Colors.light }) {
  return (
    <View style={[styles.exTile, { backgroundColor: colors.sectionBg }]}>
      <Feather name={icon as any} size={18} color={colors.gold} style={{ marginBottom: 4 }} />
      <Text style={[styles.exTileValue, { color: colors.text }]}>{value} min</Text>
      <Text style={[styles.exTileLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function ActivityInput({ icon, label, value, onChange, colors }: { icon: string; label: string; value: string; onChange: (v: string) => void; colors: any }) {
  return (
    <View style={styles.activityRow}>
      <View style={[styles.activityIconBox, { backgroundColor: colors.sectionBg }]}>
        <Feather name={icon as any} size={18} color={colors.gold} />
      </View>
      <Text style={[styles.activityLabel, { color: colors.text }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={colors.placeholder}
        style={[styles.activityInput, { backgroundColor: colors.inputBg, color: colors.text }]}
      />
      <Text style={[styles.activityUnit, { color: colors.textSecondary }]}>min</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: "700" as const },
  headerDate: { fontSize: 13, marginTop: 2 },
  card: { borderRadius: 16, padding: 16, marginBottom: 14, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardTitle: { fontSize: 17, fontWeight: "600" as const },
  addBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  emptyState: { alignItems: "center", paddingVertical: 20, gap: 8 },
  emptyText: { fontSize: 14 },
  tableHeader: { flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1 },
  thTime: { width: 60, fontSize: 12, fontWeight: "600" as const },
  thFood: { flex: 1, fontSize: 12, fontWeight: "600" as const },
  thPhoto: { width: 50, fontSize: 12, fontWeight: "600" as const, textAlign: "center" },
  tableRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 0.5 },
  tdTime: { width: 60, fontSize: 13 },
  tdFood: { flex: 1, fontSize: 13, paddingRight: 8 },
  tdPhoto: { width: 50, alignItems: "center" },
  thumbnail: { width: 40, height: 40, borderRadius: 6 },
  noPhoto: { width: 40, height: 40, borderRadius: 6, alignItems: "center", justifyContent: "center" },
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
  activityLabel: { flex: 1, fontSize: 15, fontWeight: "500" as const },
  activityInput: { width: 100, height: 48, borderRadius: 10, textAlign: "center", fontSize: 20, fontWeight: "600" as const },
  activityUnit: { fontSize: 13, width: 30 },
  waterEntryList: { paddingTop: 8 },
  waterEntryRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  waterEntryTime: { fontSize: 12, minWidth: 50 },
  waterEntryAmt: { flex: 1, fontSize: 13, fontWeight: "500" as const },
  exTotalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12, marginTop: 4, borderRadius: 10 },
  exTotalLabel: { fontSize: 14 },
  exTotalValue: { fontSize: 18, fontWeight: "700" as const },
  timeRow: { flexDirection: "row", alignItems: "center", height: 48 },
  timeInput: { flex: 1, paddingHorizontal: 12, fontSize: 16 },
  foodInputRow: { flexDirection: "row", alignItems: "flex-start", minHeight: 80, padding: 12 },
  foodInput: { flex: 1, fontSize: 15, lineHeight: 22 },
  micBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginLeft: 8, marginTop: 2 },
  imageRow: { flexDirection: "row", alignItems: "center", marginTop: 12, gap: 12 },
  cameraBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  cameraBtnText: { fontSize: 14, fontWeight: "500" as const },
  previewImage: { width: 64, height: 64, borderRadius: 8 },
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
  deleteWeightBtn: { flexDirection: "row", alignItems: "center", gap: 6, padding: 12, borderRadius: 10, borderWidth: 1, borderStyle: "dashed", marginTop: 8, justifyContent: "center" },
  deleteWeightText: { color: "#EF4444", fontSize: 13, fontWeight: "600" as const },
});
