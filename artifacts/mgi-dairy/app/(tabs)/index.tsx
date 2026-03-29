import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Modal,
  Alert,
  Platform,
  useColorScheme,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import {
  useDateString,
  formatTimeFromDate,
  formatDisplayDate,
  mlToGallons,
  parseWaterInput,
  calcSleepHours,
} from "@/hooks/useDateString";

const WATER_GOAL_ML = 2000;

export default function DiaryScreen() {
  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const today = useDateString();

  const { meals, waterEntries, sleepLogs, addMeal, deleteMeal, addWaterEntry, addSleepLog, updateSleepLog } = useApp();

  const todayMeals = meals.filter((m) => m.date === today).sort((a, b) => a.time.localeCompare(b.time));
  const todayWaterTotal = waterEntries.filter((w) => w.date === today).reduce((sum, w) => sum + w.amountMl, 0);
  const todaySleep = sleepLogs.find((s) => s.date === today);

  const [showMealModal, setShowMealModal] = useState(false);
  const [showWaterModal, setShowWaterModal] = useState(false);
  const [showSleepSheet, setShowSleepSheet] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState<string | null>(null);
  const [waterUnit, setWaterUnit] = useState<"ml" | "gal">("ml");

  const [mealTime, setMealTime] = useState(formatTimeFromDate(new Date()));
  const [mealFood, setMealFood] = useState("");
  const [mealImage, setMealImage] = useState<string | undefined>(undefined);
  const [isListening, setIsListening] = useState(false);
  const [isMealListening, setIsMealListening] = useState(false);

  const [waterText, setWaterText] = useState("");
  const [waterManual, setWaterManual] = useState("");

  const [bedtime, setBedtime] = useState(todaySleep?.bedtime ?? "22:00");
  const [wakeTime, setWakeTime] = useState(todaySleep?.wakeTime ?? "07:00");
  const [sleepNotes, setSleepNotes] = useState(todaySleep?.notes ?? "");

  const progressPct = Math.min((todayWaterTotal / WATER_GOAL_ML) * 100, 100);

  const handlePickImage = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== "granted") {
      const galleryPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (galleryPerm.status !== "granted") {
        Alert.alert("Permission needed", "Camera or photo library access is required.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setMealImage(result.assets[0].uri);
      }
      return;
    }
    Alert.alert("Add Photo", "Choose source", [
      {
        text: "Camera",
        onPress: async () => {
          const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
          if (!result.canceled && result.assets[0]) setMealImage(result.assets[0].uri);
        },
      },
      {
        text: "Photo Library",
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
          });
          if (!result.canceled && result.assets[0]) setMealImage(result.assets[0].uri);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleSaveMeal = async () => {
    if (!mealFood.trim()) {
      Alert.alert("Required", "Please enter food details.");
      return;
    }
    await addMeal({ date: today, time: mealTime, foodDetails: mealFood.trim(), imagePath: mealImage });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowMealModal(false);
    setMealFood("");
    setMealImage(undefined);
    setMealTime(formatTimeFromDate(new Date()));
  };

  const handleAddWater = async () => {
    const parsed = parseWaterInput(waterText);
    if (parsed === null || parsed <= 0) {
      Alert.alert("Could not parse", "Try '250 ml' or '2 cups'.");
      return;
    }
    await addWaterEntry({ date: today, amountMl: Math.round(parsed) });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWaterText("");
    setShowWaterModal(false);
  };

  const handleManualWater = async () => {
    const amount = parseFloat(waterManual);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Invalid amount", "Enter a number greater than 0.");
      return;
    }
    await addWaterEntry({ date: today, amountMl: Math.round(amount) });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWaterManual("");
    setShowWaterModal(false);
  };

  const handleSaveSleep = async () => {
    if (todaySleep) {
      await updateSleepLog(todaySleep.id, { bedtime, wakeTime, notes: sleepNotes });
    } else {
      await addSleepLog({ date: today, bedtime, wakeTime, notes: sleepNotes });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowSleepSheet(false);
  };

  const totalHours = calcSleepHours(todaySleep?.bedtime ?? "", todaySleep?.wakeTime ?? "");

  const waterDisplay = waterUnit === "ml" ? `${todayWaterTotal} ml` : `${mlToGallons(todayWaterTotal)} gal`;

  const tabBarHeight = Platform.OS === "web" ? 84 : 83;
  const bottomPad = insets.bottom + tabBarHeight + 16;
  const topPad = Platform.OS === "web" ? 67 + insets.top : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: topPad + 16 }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Diary</Text>
        <Text style={[styles.headerDate, { color: colors.textSecondary }]}>{formatDisplayDate(today)}</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        {/* Meal Log */}
        <SectionCard title="Meal Log" colors={colors} onAdd={() => { setShowMealModal(true); setMealTime(formatTimeFromDate(new Date())); }}>
          {todayMeals.length === 0 ? (
            <EmptyState icon="coffee" text="No meals logged today" colors={colors} />
          ) : (
            <View style={styles.tableWrapper}>
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
                    Alert.alert("Delete meal?", meal.foodDetails, [
                      { text: "Cancel", style: "cancel" },
                      { text: "Delete", style: "destructive", onPress: () => deleteMeal(meal.id) },
                    ]);
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

        {/* Water Intake */}
        <SectionCard title="Water Intake" colors={colors} onAdd={() => setShowWaterModal(true)}>
          <View style={styles.waterRow}>
            <Text style={[styles.waterAmount, { color: colors.tint }]}>{waterDisplay}</Text>
            <TouchableOpacity
              style={[styles.unitToggle, { backgroundColor: colors.sectionBg }]}
              onPress={() => setWaterUnit((u) => (u === "ml" ? "gal" : "ml"))}
            >
              <Text style={[styles.unitToggleText, { color: colors.tint }]}>{waterUnit === "ml" ? "ml" : "gal"}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.progressContainer}>
            <View style={[styles.progressTrack, { backgroundColor: colors.progressTrack }]}>
              <View style={[styles.progressFill, { width: `${progressPct}%` as any, backgroundColor: colors.progressFill }]} />
            </View>
            <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
              {Math.round(progressPct)}% of {waterUnit === "ml" ? "2000 ml" : "0.528 gal"} goal
            </Text>
          </View>
        </SectionCard>

        {/* Sleep */}
        <SectionCard title="Sleep" colors={colors} onAdd={() => setShowSleepSheet(true)}>
          {todaySleep ? (
            <TouchableOpacity onPress={() => setShowSleepSheet(true)}>
              <View style={styles.sleepRow}>
                <SleepStat label="Bedtime" value={todaySleep.bedtime} colors={colors} />
                <SleepStat label="Wake" value={todaySleep.wakeTime} colors={colors} />
                <SleepStat label="Total" value={totalHours} colors={colors} highlight />
              </View>
              {todaySleep.notes ? (
                <Text style={[styles.sleepNoteText, { color: colors.textSecondary }]} numberOfLines={2}>
                  {todaySleep.notes}
                </Text>
              ) : null}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setShowSleepSheet(true)}>
              <EmptyState icon="moon" text="Tap to log your sleep" colors={colors} />
            </TouchableOpacity>
          )}
        </SectionCard>
      </ScrollView>

      {/* Add Meal Modal */}
      <Modal visible={showMealModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.bottomSheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Add Meal</Text>

            <View style={[styles.timeRow, { backgroundColor: colors.inputBg, borderRadius: 10 }]}>
              <Feather name="clock" size={16} color={colors.textSecondary} style={{ marginLeft: 12 }} />
              <TextInput
                style={[styles.timeInput, { color: colors.text }]}
                value={mealTime}
                onChangeText={setMealTime}
                placeholder="HH:MM"
                placeholderTextColor={colors.placeholder}
              />
            </View>

            <View style={[styles.foodInputRow, { backgroundColor: colors.inputBg, borderRadius: 10, marginTop: 10 }]}>
              <TextInput
                style={[styles.foodInput, { color: colors.text }]}
                value={mealFood}
                onChangeText={setMealFood}
                placeholder="Food details…"
                placeholderTextColor={colors.placeholder}
                multiline
                numberOfLines={3}
              />
              <TouchableOpacity
                style={[styles.micBtn, { backgroundColor: isMealListening ? colors.tint : colors.borderLight }]}
                onPress={() => {
                  if (Platform.OS !== "web") {
                    Alert.alert("Voice Input", "Speech recognition is available on device. Use the keyboard for now on web.");
                  } else {
                    Alert.alert("Voice Input", "Type your food details manually or take a photo.");
                  }
                }}
              >
                <Feather name="mic" size={18} color={isMealListening ? "#fff" : colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.imageRow}>
              <TouchableOpacity style={[styles.cameraBtn, { backgroundColor: colors.sectionBg }]} onPress={handlePickImage}>
                <Feather name="camera" size={18} color={colors.tint} />
                <Text style={[styles.cameraBtnText, { color: colors.tint }]}>Add Photo</Text>
              </TouchableOpacity>
              {mealImage && (
                <TouchableOpacity onPress={() => setMealImage(undefined)}>
                  <Image source={{ uri: mealImage }} style={styles.previewImage} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: colors.sectionBg }]}
                onPress={() => { setShowMealModal(false); setMealFood(""); setMealImage(undefined); }}
              >
                <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.tint }]} onPress={handleSaveMeal}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Water Modal */}
      <Modal visible={showWaterModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.bottomSheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Log Water</Text>

            <Text style={[styles.waterHint, { color: colors.textSecondary }]}>
              Say or type: "250 ml", "2 cups", "8 oz", "1 liter"
            </Text>

            <View style={[styles.foodInputRow, { backgroundColor: colors.inputBg, borderRadius: 10 }]}>
              <TextInput
                style={[styles.foodInput, { color: colors.text }]}
                value={waterText}
                onChangeText={setWaterText}
                placeholder="e.g. 250 ml, 2 cups"
                placeholderTextColor={colors.placeholder}
                keyboardType="default"
              />
              <TouchableOpacity
                style={[styles.micBtn, { backgroundColor: isListening ? colors.tint : colors.borderLight }]}
                onPress={() => {
                  Alert.alert("Voice Input", "Type the amount manually e.g. '250 ml' or '2 cups'.");
                }}
              >
                <Feather name="mic" size={18} color={isListening ? "#fff" : colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.tint, marginTop: 12, marginHorizontal: 0 }]} onPress={handleAddWater}>
              <Text style={styles.saveText}>Add</Text>
            </TouchableOpacity>

            <View style={[styles.dividerRow, { borderColor: colors.border }]}>
              <Text style={[styles.dividerText, { color: colors.placeholder }]}>or enter manually (ml)</Text>
            </View>

            <View style={styles.manualRow}>
              <TextInput
                style={[styles.manualInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                value={waterManual}
                onChangeText={setWaterManual}
                placeholder="Amount in ml"
                placeholderTextColor={colors.placeholder}
                keyboardType="numeric"
              />
              <TouchableOpacity style={[styles.manualAddBtn, { backgroundColor: colors.tint }]} onPress={handleManualWater}>
                <Feather name="plus" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.cancelBtn, { backgroundColor: colors.sectionBg, marginTop: 12 }]}
              onPress={() => { setShowWaterModal(false); setWaterText(""); setWaterManual(""); }}
            >
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Sleep Sheet */}
      <Modal visible={showSleepSheet} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.bottomSheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Sleep Log</Text>

            <View style={styles.sleepTimeRow}>
              <View style={styles.sleepTimeItem}>
                <Text style={[styles.sleepLabel, { color: colors.textSecondary }]}>Bedtime</Text>
                <TextInput
                  style={[styles.sleepTimeInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                  value={bedtime}
                  onChangeText={setBedtime}
                  placeholder="22:00"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={styles.sleepArrow}>
                <Feather name="arrow-right" size={20} color={colors.placeholder} />
              </View>
              <View style={styles.sleepTimeItem}>
                <Text style={[styles.sleepLabel, { color: colors.textSecondary }]}>Wake time</Text>
                <TextInput
                  style={[styles.sleepTimeInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                  value={wakeTime}
                  onChangeText={setWakeTime}
                  placeholder="07:00"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            <View style={[styles.sleepTotalBox, { backgroundColor: colors.sectionBg, borderRadius: 10 }]}>
              <Feather name="moon" size={18} color={colors.tint} />
              <Text style={[styles.sleepTotalText, { color: colors.tint }]}>
                Total: {calcSleepHours(bedtime, wakeTime)}
              </Text>
            </View>

            <TextInput
              style={[styles.sleepNotesInput, { backgroundColor: colors.inputBg, color: colors.text }]}
              value={sleepNotes}
              onChangeText={setSleepNotes}
              placeholder="Optional notes (e.g. restless, vivid dreams…)"
              placeholderTextColor={colors.placeholder}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: colors.sectionBg }]}
                onPress={() => setShowSleepSheet(false)}
              >
                <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.tint }]} onPress={handleSaveSleep}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Viewer */}
      <Modal visible={!!showImageViewer} animationType="fade" transparent>
        <TouchableOpacity
          style={styles.imageViewerOverlay}
          activeOpacity={1}
          onPress={() => setShowImageViewer(null)}
        >
          {showImageViewer && (
            <Image
              source={{ uri: showImageViewer }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
          <TouchableOpacity style={styles.closeBtn} onPress={() => setShowImageViewer(null)}>
            <Feather name="x" size={24} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function SectionCard({
  title,
  colors,
  onAdd,
  children,
}: {
  title: string;
  colors: typeof Colors.light;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.tint }]} onPress={onAdd}>
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
      <Text style={[styles.sleepStatValue, { color: highlight ? colors.tint : colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: "700" as const },
  headerDate: { fontSize: 13, marginTop: 2 },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: { fontSize: 17, fontWeight: "600" as const },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 8,
  },
  emptyText: { fontSize: 14 },
  tableWrapper: {},
  tableHeader: {
    flexDirection: "row",
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  thTime: { width: 60, fontSize: 12, fontWeight: "600" as const },
  thFood: { flex: 1, fontSize: 12, fontWeight: "600" as const },
  thPhoto: { width: 50, fontSize: 12, fontWeight: "600" as const, textAlign: "center" },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  tdTime: { width: 60, fontSize: 13 },
  tdFood: { flex: 1, fontSize: 13, paddingRight: 8 },
  tdPhoto: { width: 50, alignItems: "center" },
  thumbnail: { width: 40, height: 40, borderRadius: 6 },
  noPhoto: { width: 40, height: 40, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  waterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  waterAmount: { fontSize: 32, fontWeight: "700" as const },
  unitToggle: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  unitToggleText: { fontSize: 14, fontWeight: "600" as const },
  progressContainer: { gap: 6 },
  progressTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4 },
  progressLabel: { fontSize: 12 },
  sleepRow: { flexDirection: "row", justifyContent: "space-between" },
  sleepStat: { alignItems: "center", flex: 1 },
  sleepStatLabel: { fontSize: 11, marginBottom: 4 },
  sleepStatValue: { fontSize: 18, fontWeight: "600" as const },
  sleepNoteText: { fontSize: 13, marginTop: 10 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 20, fontWeight: "700" as const, marginBottom: 16 },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
  },
  timeInput: { flex: 1, paddingHorizontal: 12, fontSize: 16 },
  foodInputRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: 80,
    padding: 12,
  },
  foodInput: { flex: 1, fontSize: 15, lineHeight: 22 },
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    marginTop: 2,
  },
  imageRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 12,
  },
  cameraBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  cameraBtnText: { fontSize: 14, fontWeight: "500" as const },
  previewImage: { width: 64, height: 64, borderRadius: 8 },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: "center" },
  cancelText: { fontSize: 15, fontWeight: "600" as const },
  saveBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: "center" },
  saveText: { color: "#fff", fontSize: 15, fontWeight: "600" as const },
  waterHint: { fontSize: 13, marginBottom: 12 },
  dividerRow: {
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 8,
    alignItems: "center",
  },
  dividerText: { fontSize: 12 },
  manualRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  manualInput: { flex: 1, height: 48, borderRadius: 10, paddingHorizontal: 14, fontSize: 15 },
  manualAddBtn: { width: 48, height: 48, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sleepTimeRow: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 8 },
  sleepTimeItem: { flex: 1 },
  sleepLabel: { fontSize: 12, marginBottom: 6 },
  sleepTimeInput: { height: 48, borderRadius: 10, paddingHorizontal: 14, fontSize: 18, fontWeight: "600" as const },
  sleepArrow: { alignItems: "center", paddingTop: 22 },
  sleepTotalBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, marginBottom: 12 },
  sleepTotalText: { fontSize: 16, fontWeight: "600" as const },
  sleepNotesInput: { borderRadius: 10, padding: 12, fontSize: 14, minHeight: 80, textAlignVertical: "top" },
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: { width: "100%", height: "80%" },
  closeBtn: {
    position: "absolute",
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
