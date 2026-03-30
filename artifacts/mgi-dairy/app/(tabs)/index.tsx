import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, TextInput, Modal, Alert, Platform, useColorScheme,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import {
  useDateString, formatTimeFromDate, formatDisplayDate,
  mlToGallons, parseWaterInput, calcSleepHours,
} from "@/hooks/useDateString";

const GAL_PRESETS = [
  { label: "0.5 gal", ml: 1893 },
  { label: "1 gal", ml: 3785 },
  { label: "1.5 gal", ml: 5678 },
  { label: "2 gal", ml: 7571 },
];

export default function DiaryScreen() {
  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const today = useDateString();

  const {
    meals, waterEntries, sleepLogs,
    addMeal, deleteMeal, addWaterEntry, addSleepLog, updateSleepLog,
    saveExerciseLog, getTodayExercise, waterGoalMl, setWaterGoalMl,
  } = useApp();

  const todayMeals = meals.filter((m) => m.date === today).sort((a, b) => a.time.localeCompare(b.time));
  const todayWaterTotal = waterEntries.filter((w) => w.date === today).reduce((sum, w) => sum + w.amountMl, 0);
  const todaySleep = sleepLogs.find((s) => s.date === today);
  const todayExercise = getTodayExercise(today);

  const [showMealModal, setShowMealModal] = useState(false);
  const [showWaterModal, setShowWaterModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showSleepSheet, setShowSleepSheet] = useState(false);
  const [showExerciseSheet, setShowExerciseSheet] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState<string | null>(null);
  const [waterUnit, setWaterUnit] = useState<"ml" | "gal">("ml");

  const [mealTime, setMealTime] = useState(formatTimeFromDate(new Date()));
  const [mealFood, setMealFood] = useState("");
  const [mealImage, setMealImage] = useState<string | undefined>(undefined);

  const [waterText, setWaterText] = useState("");
  const [waterManual, setWaterManual] = useState("");

  const [bedtime, setBedtime] = useState(todaySleep?.bedtime ?? "22:00");
  const [wakeTime, setWakeTime] = useState(todaySleep?.wakeTime ?? "07:00");
  const [sleepNotes, setSleepNotes] = useState(todaySleep?.notes ?? "");

  const [exRunning, setExRunning] = useState(String(todayExercise?.running ?? 0));
  const [exWalking, setExWalking] = useState(String(todayExercise?.walking ?? 0));
  const [exStrength, setExStrength] = useState(String(todayExercise?.strengthTraining ?? 0));
  const [exCardio, setExCardio] = useState(String(todayExercise?.cardio ?? 0));

  const [goalInput, setGoalInput] = useState(mlToGallons(waterGoalMl));
  const [goalUnit, setGoalUnit] = useState<"gal" | "ml">("gal");

  const progressPct = Math.min((todayWaterTotal / waterGoalMl) * 100, 100);
  const tabBarHeight = Platform.OS === "web" ? 84 : 83;
  const bottomPad = insets.bottom + tabBarHeight + 16;
  const topPad = Platform.OS === "web" ? 67 + insets.top : 0;

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
    setShowMealModal(false); setMealFood(""); setMealImage(undefined); setMealTime(formatTimeFromDate(new Date()));
  };

  const handleAddWaterFromText = async () => {
    const parsed = parseWaterInput(waterText);
    if (parsed === null || parsed <= 0) { Alert.alert("Could not parse", "Try '250 ml' or '2 cups'."); return; }
    await addWaterEntry({ date: today, amountMl: Math.round(parsed) });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWaterText(""); setShowWaterModal(false);
  };

  const handleManualWater = async () => {
    const amount = parseFloat(waterManual);
    if (isNaN(amount) || amount <= 0) { Alert.alert("Invalid", "Enter a number > 0."); return; }
    await addWaterEntry({ date: today, amountMl: Math.round(amount) });
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
      running: parseFloat(exRunning) || 0,
      walking: parseFloat(exWalking) || 0,
      strengthTraining: parseFloat(exStrength) || 0,
      cardio: parseFloat(exCardio) || 0,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowExerciseSheet(false);
  };

  const handleSaveGoal = async () => {
    const val = parseFloat(goalInput);
    if (isNaN(val) || val <= 0) { Alert.alert("Invalid", "Enter a valid goal."); return; }
    const ml = goalUnit === "gal" ? Math.round(val * 3785.41) : Math.round(val);
    await setWaterGoalMl(ml);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowGoalModal(false);
  };

  const openExercise = () => {
    setExRunning(String(todayExercise?.running ?? 0));
    setExWalking(String(todayExercise?.walking ?? 0));
    setExStrength(String(todayExercise?.strengthTraining ?? 0));
    setExCardio(String(todayExercise?.cardio ?? 0));
    setShowExerciseSheet(true);
  };

  const totalHours = calcSleepHours(todaySleep?.bedtime ?? "", todaySleep?.wakeTime ?? "");
  const totalExerciseMin = (todayExercise?.running ?? 0) + (todayExercise?.walking ?? 0) + (todayExercise?.strengthTraining ?? 0) + (todayExercise?.cardio ?? 0);
  const goalDisplayStr = waterUnit === "gal" ? `${mlToGallons(waterGoalMl).toFixed(2)} gal` : `${waterGoalMl} ml`;
  const waterAmountDisplay = waterUnit === "ml" ? `${todayWaterTotal} ml` : `${mlToGallons(todayWaterTotal)} gal`;
  const exTotal = (parseFloat(exRunning)||0)+(parseFloat(exWalking)||0)+(parseFloat(exStrength)||0)+(parseFloat(exCardio)||0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: topPad + 16 }]}>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Diary</Text>
        <Text style={[styles.headerDate, { color: colors.headerTextSecondary }]}>{formatDisplayDate(today)}</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>

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
                <TouchableOpacity
                  key={meal.id}
                  style={[styles.tableRow, { borderBottomColor: colors.borderLight }]}
                  onLongPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    Alert.alert("Delete?", meal.foodDetails, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => deleteMeal(meal.id) }]);
                  }}
                >
                  <Text style={[styles.tdTime, { color: colors.text }]}>{meal.time}</Text>
                  <Text style={[styles.tdFood, { color: colors.text }]} numberOfLines={2}>{meal.foodDetails}</Text>
                  <View style={styles.tdPhoto}>
                    {meal.imagePath ? (
                      <TouchableOpacity onPress={() => setShowImageViewer(meal.imagePath!)}>
                        <Image source={{ uri: meal.imagePath }} style={styles.thumbnail} />
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.noPhoto, { backgroundColor: colors.borderLight }]}>
                        <Feather name="image" size={14} color={colors.placeholder} />
                      </View>
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

          <View style={[styles.waterAmountCard, { backgroundColor: colors.tealLight }]}>
            <Text style={[styles.waterAmountBig, { color: colors.teal }]}>{waterAmountDisplay}</Text>
            <TouchableOpacity
              style={[styles.goalChip, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
              onPress={() => { setGoalInput(mlToGallons(waterGoalMl)); setGoalUnit("gal"); setShowGoalModal(true); }}
            >
              <Text style={[styles.goalChipText, { color: colors.textSecondary }]}>Goal: {goalDisplayStr}</Text>
              <Feather name="chevron-down" size={12} color={colors.textSecondary} style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          </View>

          <View style={[styles.progressTrack, { backgroundColor: colors.progressTrack }]}>
            <View style={[styles.progressFill, { width: `${progressPct}%` as any, backgroundColor: colors.teal }]} />
          </View>
          <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>{Math.round(progressPct)}% of daily goal</Text>
        </View>

        {/* SLEEP */}
        <SectionCard title="Sleep" colors={colors} onAdd={() => { setBedtime(todaySleep?.bedtime ?? "22:00"); setWakeTime(todaySleep?.wakeTime ?? "07:00"); setSleepNotes(todaySleep?.notes ?? ""); setShowSleepSheet(true); }}>
          {todaySleep ? (
            <TouchableOpacity onPress={() => { setBedtime(todaySleep.bedtime); setWakeTime(todaySleep.wakeTime); setSleepNotes(todaySleep.notes); setShowSleepSheet(true); }}>
              <View style={styles.sleepRow}>
                <SleepStat label="Bedtime" value={todaySleep.bedtime} colors={colors} />
                <SleepStat label="Wake" value={todaySleep.wakeTime} colors={colors} />
                <SleepStat label="Total" value={totalHours} colors={colors} highlight />
              </View>
              {todaySleep.notes ? <Text style={[styles.sleepNoteText, { color: colors.textSecondary }]} numberOfLines={2}>{todaySleep.notes}</Text> : null}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setShowSleepSheet(true)}>
              <EmptyState icon="moon" text="Tap to log your sleep" colors={colors} />
            </TouchableOpacity>
          )}
        </SectionCard>

        {/* EXERCISE */}
        <SectionCard title="Exercise" colors={colors} onAdd={openExercise}>
          {todayExercise && totalExerciseMin > 0 ? (
            <TouchableOpacity onPress={openExercise}>
              <View style={styles.exerciseGrid}>
                <ExerciseTile icon="activity" label="Running" value={todayExercise.running} colors={colors} />
                <ExerciseTile icon="navigation" label="Walking" value={todayExercise.walking} colors={colors} />
                <ExerciseTile icon="zap" label="Strength" value={todayExercise.strengthTraining} colors={colors} />
                <ExerciseTile icon="heart" label="Cardio" value={todayExercise.cardio} colors={colors} />
              </View>
              <View style={[styles.totalExRow, { borderTopColor: colors.borderLight }]}>
                <Text style={[styles.totalExLabel, { color: colors.textSecondary }]}>Total Active Time</Text>
                <Text style={[styles.totalExValue, { color: colors.gold }]}>{totalExerciseMin} min</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={openExercise}>
              <EmptyState icon="trending-up" text="Tap to log exercise" colors={colors} />
            </TouchableOpacity>
          )}
        </SectionCard>
      </ScrollView>

      {/* MEAL MODAL */}
      <Modal visible={showMealModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.bottomSheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Add Food</Text>
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
          </View>
        </View>
      </Modal>

      {/* WATER MODAL */}
      <Modal visible={showWaterModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.bottomSheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Log Water</Text>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>Type: "250 ml", "2 cups", "8 oz", "1 liter"</Text>
            <View style={[styles.foodInputRow, { backgroundColor: colors.inputBg, borderRadius: 10 }]}>
              <TextInput style={[styles.foodInput, { color: colors.text }]} value={waterText} onChangeText={setWaterText} placeholder="e.g. 250 ml, 2 cups" placeholderTextColor={colors.placeholder} />
              <TouchableOpacity style={[styles.micBtn, { backgroundColor: colors.borderLight }]} onPress={() => Alert.alert("Voice Input", "Type the amount manually.")}>
                <Feather name="mic" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.teal, marginTop: 12, marginHorizontal: 0 }]} onPress={handleAddWaterFromText}>
              <Text style={styles.saveText}>Add</Text>
            </TouchableOpacity>
            <View style={[styles.dividerRow, { borderColor: colors.border }]}>
              <Text style={[styles.dividerText, { color: colors.placeholder }]}>or enter manually (ml)</Text>
            </View>
            <View style={styles.manualRow}>
              <TextInput style={[styles.manualInput, { backgroundColor: colors.inputBg, color: colors.text }]} value={waterManual} onChangeText={setWaterManual} placeholder="Amount in ml" placeholderTextColor={colors.placeholder} keyboardType="numeric" />
              <TouchableOpacity style={[styles.manualAddBtn, { backgroundColor: colors.teal }]} onPress={handleManualWater}>
                <Feather name="plus" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.sectionBg, marginTop: 12 }]} onPress={() => { setShowWaterModal(false); setWaterText(""); setWaterManual(""); }}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* GOAL MODAL */}
      <Modal visible={showGoalModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.bottomSheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.goalModalHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text, marginBottom: 0 }]}>Set Daily Water Goal</Text>
              <TouchableOpacity onPress={() => setShowGoalModal(false)}>
                <Feather name="x" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 16 }]}>GOAL ({goalUnit.toUpperCase()})</Text>
            <View style={styles.goalInputRow}>
              <TextInput
                style={[styles.goalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border, borderWidth: 1 }]}
                value={goalInput}
                onChangeText={setGoalInput}
                keyboardType="decimal-pad"
                selectTextOnFocus
              />
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
                <TouchableOpacity
                  key={p.label}
                  style={[styles.presetChip, { backgroundColor: colors.sectionBg, borderColor: colors.border, borderWidth: 1 }]}
                  onPress={() => { setGoalUnit("gal"); setGoalInput(mlToGallons(p.ml)); }}
                >
                  <Text style={[styles.presetChipText, { color: colors.text }]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.sectionBg }]} onPress={() => setShowGoalModal(false)}>
                <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.purple }]} onPress={handleSaveGoal}>
                <Text style={styles.saveText}>Save Goal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* SLEEP SHEET */}
      <Modal visible={showSleepSheet} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.bottomSheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Sleep Log</Text>
            <View style={styles.sleepTimeRow}>
              <View style={styles.sleepTimeItem}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Bedtime</Text>
                <TextInput style={[styles.sleepTimeInput, { backgroundColor: colors.inputBg, color: colors.text }]} value={bedtime} onChangeText={setBedtime} placeholder="22:00" placeholderTextColor={colors.placeholder} keyboardType="numbers-and-punctuation" />
              </View>
              <View style={styles.sleepArrow}><Feather name="arrow-right" size={20} color={colors.placeholder} /></View>
              <View style={styles.sleepTimeItem}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Wake time</Text>
                <TextInput style={[styles.sleepTimeInput, { backgroundColor: colors.inputBg, color: colors.text }]} value={wakeTime} onChangeText={setWakeTime} placeholder="07:00" placeholderTextColor={colors.placeholder} keyboardType="numbers-and-punctuation" />
              </View>
            </View>
            <View style={[styles.sleepTotalBox, { backgroundColor: colors.sectionBg }]}>
              <Feather name="moon" size={18} color={colors.gold} />
              <Text style={[styles.sleepTotalText, { color: colors.gold }]}>Total: {calcSleepHours(bedtime, wakeTime)}</Text>
            </View>
            <TextInput style={[styles.sleepNotesInput, { backgroundColor: colors.inputBg, color: colors.text }]} value={sleepNotes} onChangeText={setSleepNotes} placeholder="Optional notes…" placeholderTextColor={colors.placeholder} multiline numberOfLines={3} />
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
      </Modal>

      {/* EXERCISE SHEET */}
      <Modal visible={showExerciseSheet} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.bottomSheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Log Exercise</Text>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>Enter duration in minutes for each activity</Text>
            <ExerciseInput label="Running" icon="activity" value={exRunning} onChange={setExRunning} colors={colors} />
            <ExerciseInput label="Walking" icon="navigation" value={exWalking} onChange={setExWalking} colors={colors} />
            <ExerciseInput label="Strength Training" icon="zap" value={exStrength} onChange={setExStrength} colors={colors} />
            <ExerciseInput label="Cardio" icon="heart" value={exCardio} onChange={setExCardio} colors={colors} />
            <View style={[styles.exTotalRow, { backgroundColor: colors.sectionBg }]}>
              <Text style={[styles.exTotalLabel, { color: colors.textSecondary }]}>Total Active Time</Text>
              <Text style={[styles.exTotalValue, { color: colors.gold }]}>{exTotal} min</Text>
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
        </View>
      </Modal>

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

function ExerciseInput({ label, icon, value, onChange, colors }: { label: string; icon: string; value: string; onChange: (v: string) => void; colors: typeof Colors.light }) {
  return (
    <View style={[styles.exInputRow, { borderBottomColor: colors.borderLight }]}>
      <View style={[styles.exInputIcon, { backgroundColor: colors.sectionBg }]}>
        <Feather name={icon as any} size={16} color={colors.gold} />
      </View>
      <Text style={[styles.exInputLabel, { color: colors.text }]}>{label}</Text>
      <View style={[styles.exInputBox, { backgroundColor: colors.inputBg }]}>
        <TextInput style={[styles.exInput, { color: colors.text }]} value={value} onChangeText={onChange} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.placeholder} selectTextOnFocus />
        <Text style={[styles.exInputUnit, { color: colors.textSecondary }]}>min</Text>
      </View>
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
  waterAmountCard: { borderRadius: 12, padding: 14, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  waterAmountBig: { fontSize: 32, fontWeight: "700" as const },
  goalChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  goalChipText: { fontSize: 12 },
  progressTrack: { height: 7, borderRadius: 4, overflow: "hidden", marginBottom: 6 },
  progressFill: { height: 7, borderRadius: 4 },
  progressLabel: { fontSize: 12 },
  sleepRow: { flexDirection: "row", justifyContent: "space-between" },
  sleepStat: { alignItems: "center", flex: 1 },
  sleepStatLabel: { fontSize: 11, marginBottom: 4 },
  sleepStatValue: { fontSize: 18, fontWeight: "600" as const },
  sleepNoteText: { fontSize: 13, marginTop: 10 },
  exerciseGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  exTile: { width: "48%", padding: 12, borderRadius: 12, alignItems: "center" },
  exTileValue: { fontSize: 16, fontWeight: "700" as const, marginBottom: 2 },
  exTileLabel: { fontSize: 11 },
  totalExRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 10, borderTopWidth: 1 },
  totalExLabel: { fontSize: 13 },
  totalExValue: { fontSize: 15, fontWeight: "700" as const },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  bottomSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: "700" as const, marginBottom: 16 },
  hint: { fontSize: 13, marginBottom: 12 },
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
  dividerRow: { borderTopWidth: 1, paddingTop: 12, marginTop: 8, alignItems: "center" },
  dividerText: { fontSize: 12 },
  manualRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  manualInput: { flex: 1, height: 48, borderRadius: 10, paddingHorizontal: 14, fontSize: 15 },
  manualAddBtn: { width: 48, height: 48, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  goalModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fieldLabel: { fontSize: 12, fontWeight: "600" as const, letterSpacing: 0.5, marginBottom: 8 },
  goalInputRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  goalInput: { flex: 1, height: 52, borderRadius: 10, paddingHorizontal: 14, fontSize: 22, fontWeight: "600" as const },
  presetsRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  presetChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  presetChipText: { fontSize: 13, fontWeight: "500" as const },
  sleepTimeRow: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 8 },
  sleepTimeItem: { flex: 1 },
  sleepTimeInput: { height: 48, borderRadius: 10, paddingHorizontal: 14, fontSize: 18, fontWeight: "600" as const },
  sleepArrow: { alignItems: "center", paddingTop: 22 },
  sleepTotalBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, marginBottom: 12, borderRadius: 10 },
  sleepTotalText: { fontSize: 16, fontWeight: "600" as const },
  sleepNotesInput: { borderRadius: 10, padding: 12, fontSize: 14, minHeight: 80, textAlignVertical: "top" },
  exInputRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 0.5, gap: 10 },
  exInputIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  exInputLabel: { flex: 1, fontSize: 15 },
  exInputBox: { flexDirection: "row", alignItems: "center", borderRadius: 8, paddingHorizontal: 10, height: 40 },
  exInput: { fontSize: 16, fontWeight: "600" as const, minWidth: 36, textAlign: "right" },
  exInputUnit: { fontSize: 13, marginLeft: 4 },
  exTotalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12, marginTop: 12, borderRadius: 10 },
  exTotalLabel: { fontSize: 14 },
  exTotalValue: { fontSize: 18, fontWeight: "700" as const },
  imageViewerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", alignItems: "center" },
  fullImage: { width: "100%", height: "80%" },
  closeBtn: { position: "absolute", top: 60, right: 20, width: 44, height: 44, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
