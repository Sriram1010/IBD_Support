import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Image, Alert, Platform, useColorScheme,
  KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, TextInput,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Svg, { Polyline, Circle, Line, Text as SvgText } from "react-native-svg";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useApp, BowelLog, MealEntry } from "@/context/AppContext";
import { calcSleepHours, calcSleepHoursNum } from "@/hooks/useDateString";
import { SimpleTimeInput, parse24h, to24h } from "@/components/WheelPicker";

function CalSimple24hInput({ value, onChange, colors }: { value: string; onChange: (v: string) => void; colors: any }) {
  const [text, setText] = React.useState(value || "07:00");
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

type ViewMode = "monthly" | "weekly" | "yearly";
type BowelColor = "red" | "yellow" | "green";
type TrendMetric = "water" | "sleep" | "stoolType" | "weight";
type TrendPeriod = "weekly" | "monthly" | "yearly";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON_SUN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MON_SUN_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function getMonthDays(year: number, month: number) {
  return { firstDay: new Date(year, month, 1).getDay(), daysInMonth: new Date(year, month + 1, 0).getDate() };
}
function bowelDotColor(color: BowelColor | undefined): string {
  if (color === "red") return "#EF4444";
  if (color === "yellow") return "#F97316";
  if (color === "green") return "#10B981";
  return "transparent";
}
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00");
  d.setDate(d.getDate() + days);
  return toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
}
function getMondayOfWeek(todayStr: string): string {
  const d = new Date(todayStr + "T12:00");
  const dayOfWeek = d.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  d.setDate(d.getDate() - daysFromMonday);
  return toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
}

function getStoolTypeColor(bColor: BowelColor | undefined): string {
  if (!bColor) return "#9CA3AF";
  if (bColor === "green") return "#10B981";
  if (bColor === "yellow") return "#F97316";
  return "#EF4444";
}

function getProgressColor(pct: number): string {
  if (pct < 35) return "#EF4444";
  if (pct < 65) return "#F97316";
  if (pct < 85) return "#FBBF24";
  return "#10B981";
}

export default function CalendarScreen() {
  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [showDaySheet, setShowDaySheet] = useState(false);
  const [sheetDate, setSheetDate] = useState(todayStr);
  const [bowelColor, setBowelColor] = useState<BowelColor>("green");
  const [bowelCount, setBowelCount] = useState("0");
  const [showImageViewer, setShowImageViewer] = useState<string | null>(null);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("water");
  const trendPeriod: TrendPeriod = viewMode;

  const [activeEditSheet, setActiveEditSheet] = useState<"water" | "sleep" | "weight" | "meals" | null>(null);
  const [editWaterAmount, setEditWaterAmount] = useState("250");
  const [editingWaterId, setEditingWaterId] = useState<string | null>(null);
  const [editSleepBed, setEditSleepBed] = useState("22:00");
  const [editSleepWake, setEditSleepWake] = useState("07:00");
  const [calSleepFmt, setCalSleepFmt] = useState<"12h" | "24h">("12h");
  const [editWeightKg, setEditWeightKg] = useState("");
  const [mealFormTime, setMealFormTime] = useState("08:00");
  const [mealFormFood, setMealFormFood] = useState("");
  const [calMealFmt, setCalMealFmt] = useState<"12h" | "24h">("12h");
  const [mealFormImages, setMealFormImages] = useState<string[]>([]);
  const [showMealAddForm, setShowMealAddForm] = useState(false);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);

  const {
    meals, waterEntries, sleepLogs, bowelLogs, weightLogs,
    saveBowelLog, deleteBowelPhoto,
    waterGoalMl, sleepGoalHours, weightGoalKg,
    addWaterEntry, deleteWaterEntry, updateWaterEntry,
    addSleepLog, updateSleepLog,
    saveWeightEntry,
    addMeal, updateMeal, deleteMeal,
  } = useApp();

  const bowelMap = useMemo(() => {
    const map: Record<string, BowelLog> = {};
    bowelLogs.forEach((b) => { map[b.date] = b; });
    return map;
  }, [bowelLogs]);

  const weightMap = useMemo(() => {
    const map: Record<string, number> = {};
    weightLogs.forEach((w) => { map[w.date] = w.weightKg; });
    return map;
  }, [weightLogs]);

  const openDaySheet = (date: string) => {
    setSheetDate(date);
    const existing = bowelMap[date];
    setBowelColor(existing?.color ?? "green");
    setBowelCount(String(existing?.count ?? 0));
    setShowDaySheet(true);
  };

  const handleDayTap = (date: string) => { setSelectedDate(date); };

  const openEditSheet = (type: "water" | "sleep" | "weight" | "meals") => {
    if (type === "sleep") {
      const sl = sleepLogs.find((s) => s.date === selectedDate);
      setEditSleepBed(sl?.bedtime ?? "22:00");
      setEditSleepWake(sl?.wakeTime ?? "07:00");
    } else if (type === "weight") {
      const wt = weightMap[selectedDate];
      setEditWeightKg(wt ? wt.toFixed(1) : "");
    } else if (type === "water") {
      setEditWaterAmount("250");
    } else if (type === "meals") {
      setShowMealAddForm(false);
      setEditingMealId(null);
      setMealFormTime("08:00");
      setMealFormFood("");
    }
    setActiveEditSheet(type);
  };

  const handleAddWater = async () => {
    const ml = parseFloat(editWaterAmount) || 0;
    if (ml <= 0) return;
    if (editingWaterId) {
      await updateWaterEntry(editingWaterId, ml);
      setEditingWaterId(null);
    } else {
      await addWaterEntry({ date: selectedDate, amountMl: ml, time: new Date().toTimeString().slice(0, 5) });
    }
    setEditWaterAmount("250");
  };

  const startEditWater = (id: string, amountMl: number) => {
    setEditingWaterId(id);
    setEditWaterAmount(String(amountMl));
  };

  const handleSaveSleep = async () => {
    if (!editSleepBed || !editSleepWake) return;
    const existing = sleepLogs.find((s) => s.date === selectedDate);
    if (existing) {
      await updateSleepLog(existing.id, { bedtime: editSleepBed, wakeTime: editSleepWake });
    } else {
      await addSleepLog({ date: selectedDate, bedtime: editSleepBed, wakeTime: editSleepWake, notes: "" });
    }
    setActiveEditSheet(null);
  };

  const handleSaveWeight = async () => {
    const kg = parseFloat(editWeightKg);
    if (!kg || kg <= 0) return;
    await saveWeightEntry({ date: selectedDate, weightKg: kg });
    setActiveEditSheet(null);
  };

  const handleSaveMeal = async () => {
    if (!mealFormFood.trim()) return;
    if (editingMealId) {
      await updateMeal(editingMealId, { time: mealFormTime, foodDetails: mealFormFood, images: mealFormImages.length > 0 ? mealFormImages : undefined });
    } else {
      await addMeal({ date: selectedDate, time: mealFormTime, foodDetails: mealFormFood, images: mealFormImages.length > 0 ? mealFormImages : undefined });
    }
    setMealFormFood("");
    setMealFormTime("08:00");
    setMealFormImages([]);
    setEditingMealId(null);
    setShowMealAddForm(false);
  };

  const openEditMeal = (meal: MealEntry) => {
    setEditingMealId(meal.id);
    setMealFormTime(meal.time);
    setMealFormFood(meal.foodDetails);
    setMealFormImages(meal.images ?? (meal.imagePath ? [meal.imagePath] : []));
    setShowMealAddForm(true);
  };

  const handleAddMealPhoto = () => {
    Alert.alert("Add Photo", "Choose source", [
      {
        text: "Camera", onPress: async () => {
          const cp = await ImagePicker.requestCameraPermissionsAsync();
          if (cp.status !== "granted") { Alert.alert("Permission needed", "Camera access required."); return; }
          const r = await ImagePicker.launchCameraAsync({ quality: 0.8 });
          if (!r.canceled && r.assets[0]) setMealFormImages((p) => [...p, r.assets[0].uri]);
        },
      },
      {
        text: "Photo Library", onPress: async () => {
          const gp = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (gp.status !== "granted") { Alert.alert("Permission needed", "Library access required."); return; }
          const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsMultipleSelection: true });
          if (!r.canceled) setMealFormImages((p) => [...p, ...r.assets.map((a) => a.uri)]);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleSaveBowelLog = async () => {
    const existing = bowelMap[sheetDate];
    await saveBowelLog({ date: sheetDate, color: bowelColor, count: Math.max(0, parseInt(bowelCount, 10) || 0), photos: existing?.photos ?? [] });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleAddPhoto = async () => {
    Alert.alert("Add Photo", "Choose source", [
      {
        text: "Camera", onPress: async () => {
          const cp = await ImagePicker.requestCameraPermissionsAsync();
          if (cp.status !== "granted") { Alert.alert("Permission needed", "Camera access required."); return; }
          const r = await ImagePicker.launchCameraAsync({ quality: 0.8 });
          if (!r.canceled && r.assets[0]) {
            const ex = bowelMap[sheetDate];
            await saveBowelLog({ date: sheetDate, color: ex?.color ?? bowelColor, count: parseInt(bowelCount, 10) || 0, photos: [...(ex?.photos ?? []), r.assets[0].uri] });
          }
        },
      },
      {
        text: "Photo Library", onPress: async () => {
          const gp = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (gp.status !== "granted") { Alert.alert("Permission needed", "Library access required."); return; }
          const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsMultipleSelection: true });
          if (!r.canceled) {
            const ex = bowelMap[sheetDate];
            await saveBowelLog({ date: sheetDate, color: ex?.color ?? bowelColor, count: parseInt(bowelCount, 10) || 0, photos: [...(ex?.photos ?? []), ...r.assets.map((a) => a.uri)] });
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleDeletePhoto = (uri: string) => {
    Alert.alert("Delete photo?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteBowelPhoto(sheetDate, uri) },
    ]);
  };

  const openPhotoViewer = (photos: string[], startIdx: number) => {
    setViewerImages(photos); setViewerIndex(startIdx); setShowImageViewer(photos[startIdx]);
  };

  const topPad = Platform.OS === "web" ? 67 + insets.top : insets.top;
  const tabBarHeight = Platform.OS === "web" ? 60 : 50;
  const bottomPad = insets.bottom + tabBarHeight + 16;

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); } else setViewMonth((m) => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); } else setViewMonth((m) => m + 1); };

  const sheetLog = bowelMap[sheetDate];
  const sheetPhotos = sheetLog?.photos ?? [];
  const selectedMeals = meals.filter((m) => m.date === selectedDate);
  const selectedWater = waterEntries.filter((w) => w.date === selectedDate).reduce((s, w) => s + w.amountMl, 0);
  const selectedSleep = sleepLogs.find((s) => s.date === selectedDate);
  const selectedBowel = bowelMap[selectedDate];
  const selectedWeight = weightMap[selectedDate];
  const selectedDayPhotos = bowelMap[selectedDate]?.photos ?? [];

  const getTrendData = (): { label: string; value: number; pointColor: string }[] => {
    if (trendPeriod === "weekly") {
      const monday = getMondayOfWeek(todayStr);
      const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
      return days.map((d, i) => {
        let value = 0;
        let pointColor = "#9CA3AF";
        if (trendMetric === "water") {
          const ml = waterEntries.filter((w) => w.date === d).reduce((s, w) => s + w.amountMl, 0);
          value = ml;
          const pct = Math.min((ml / waterGoalMl) * 100, 100);
          pointColor = ml > 0 ? getProgressColor(pct) : "#9CA3AF";
        } else if (trendMetric === "sleep") {
          const sl = sleepLogs.find((s) => s.date === d);
          value = sl ? calcSleepHoursNum(sl.bedtime, sl.wakeTime) : 0;
          const pct = Math.min((value / sleepGoalHours) * 100, 100);
          pointColor = value > 0 ? getProgressColor(pct) : "#9CA3AF";
        } else if (trendMetric === "stoolType") {
          const b = bowelMap[d];
          value = b ? (b.color === "green" ? 1 : b.color === "yellow" ? 2 : 3) : 0;
          pointColor = getStoolTypeColor(b?.color);
        } else if (trendMetric === "weight") {
          value = weightMap[d] ?? 0;
          if (value > 0 && weightGoalKg > 0) {
            const diff = Math.abs(value - weightGoalKg) / weightGoalKg;
            pointColor = getProgressColor(Math.max(0, 100 - diff * 200));
          } else { pointColor = value > 0 ? "#7C5CBF" : "#9CA3AF"; }
        }
        return { label: MON_SUN_LABELS[i], value, pointColor };
      });
    } else if (trendPeriod === "monthly") {
      const { daysInMonth } = getMonthDays(viewYear, viewMonth);
      const allDays = Array.from({ length: daysInMonth }, (_, i) => toDateStr(viewYear, viewMonth, i + 1));
      return allDays.map((d) => {
        let value = 0;
        let pointColor = "#9CA3AF";
        const dayNum = parseInt(d.slice(-2), 10);
        if (trendMetric === "water") {
          const ml = waterEntries.filter((w) => w.date === d).reduce((s, w) => s + w.amountMl, 0);
          value = ml;
          pointColor = ml > 0 ? getProgressColor(Math.min((ml / waterGoalMl) * 100, 100)) : "#9CA3AF";
        } else if (trendMetric === "sleep") {
          const sl = sleepLogs.find((s) => s.date === d);
          value = sl ? calcSleepHoursNum(sl.bedtime, sl.wakeTime) : 0;
          pointColor = value > 0 ? getProgressColor(Math.min((value / sleepGoalHours) * 100, 100)) : "#9CA3AF";
        } else if (trendMetric === "stoolType") {
          const b = bowelMap[d];
          value = b ? (b.color === "green" ? 1 : b.color === "yellow" ? 2 : 3) : 0;
          pointColor = getStoolTypeColor(b?.color);
        } else if (trendMetric === "weight") {
          value = weightMap[d] ?? 0;
          pointColor = value > 0 ? "#7C5CBF" : "#9CA3AF";
        }
        return { label: String(dayNum), value, pointColor };
      });
    } else {
      return Array.from({ length: 12 }, (_, m) => {
        const monthStr = `${viewYear}-${String(m + 1).padStart(2, "0")}`;
        let value = 0;
        let pointColor = "#9CA3AF";
        if (trendMetric === "water") {
          const dayEntries = waterEntries.filter((w) => w.date.startsWith(monthStr));
          const total = dayEntries.reduce((s, w) => s + w.amountMl, 0);
          const daysCount = new Set(dayEntries.map((w) => w.date)).size;
          value = daysCount > 0 ? total / daysCount : 0;
          pointColor = value > 0 ? getProgressColor(Math.min((value / waterGoalMl) * 100, 100)) : "#9CA3AF";
        } else if (trendMetric === "sleep") {
          const monthSleeps = sleepLogs.filter((s) => s.date.startsWith(monthStr));
          const avg = monthSleeps.reduce((s, sl) => s + calcSleepHoursNum(sl.bedtime, sl.wakeTime), 0) / (monthSleeps.length || 1);
          value = monthSleeps.length > 0 ? avg : 0;
          pointColor = value > 0 ? getProgressColor(Math.min((value / sleepGoalHours) * 100, 100)) : "#9CA3AF";
        } else if (trendMetric === "stoolType") {
          const monthBowels = bowelLogs.filter((b) => b.date.startsWith(monthStr));
          if (monthBowels.length > 0) {
            const avg = monthBowels.reduce((s, b) => s + (b.color === "green" ? 1 : b.color === "yellow" ? 2 : 3), 0) / monthBowels.length;
            value = avg;
            const avgColor: BowelColor = avg <= 1.5 ? "green" : avg <= 2.5 ? "yellow" : "red";
            pointColor = getStoolTypeColor(avgColor);
          }
        } else if (trendMetric === "weight") {
          const monthWeights = weightLogs.filter((w) => w.date.startsWith(monthStr));
          value = monthWeights.length > 0 ? monthWeights.reduce((s, w) => s + w.weightKg, 0) / monthWeights.length : 0;
          pointColor = value > 0 ? "#7C5CBF" : "#9CA3AF";
        }
        return { label: MONTHS_SHORT[m], value, pointColor };
      });
    }
  };

  const trendData = useMemo(() => getTrendData(), [trendMetric, trendPeriod, waterEntries, sleepLogs, bowelLogs, weightLogs, viewYear, viewMonth, waterGoalMl, sleepGoalHours, weightGoalKg]);

  const metricColor = trendMetric === "water" ? "#1B8A7B"
    : trendMetric === "sleep" ? "#C4881A"
    : trendMetric === "stoolType" ? "#10B981"
    : "#7C5CBF";

  const metricUnit = trendMetric === "water" ? "ml"
    : trendMetric === "sleep" ? "hrs"
    : trendMetric === "stoolType" ? "level"
    : "kg";

  const METRIC_LABELS: Record<TrendMetric, string> = {
    water: "Water",
    sleep: "Sleep",
    stoolType: "BM",
    weight: "Weight",
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: topPad + 16 }]}>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Calendar</Text>
      </View>

      <View style={[styles.viewTabsRow, { backgroundColor: colors.headerBg }]}>
        <View style={[styles.viewTabs, { backgroundColor: colors.surface }]}>
          {(["monthly", "weekly", "yearly"] as ViewMode[]).map((mode) => (
            <TouchableOpacity key={mode} style={[styles.viewTab, viewMode === mode && { backgroundColor: colors.purple }]} onPress={() => setViewMode(mode)}>
              <Text style={[styles.viewTabText, { color: viewMode === mode ? "#fff" : colors.textSecondary }]}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {viewMode === "monthly" && (
          <MonthlyView viewYear={viewYear} viewMonth={viewMonth} todayStr={todayStr} selectedDate={selectedDate} bowelMap={bowelMap} colors={colors} onPrev={prevMonth} onNext={nextMonth} onDayTap={handleDayTap} />
        )}
        {viewMode === "weekly" && (
          <WeeklyView todayStr={todayStr} selectedDate={selectedDate} bowelMap={bowelMap} colors={colors} onDayTap={handleDayTap} />
        )}
        {viewMode === "yearly" && (
          <YearlyView year={viewYear} bowelMap={bowelMap} todayStr={todayStr} selectedDate={selectedDate} colors={colors} onYearChange={(y) => setViewYear(y)} onDayTap={handleDayTap} />
        )}

        <TouchableOpacity style={[styles.logEntryBtn, { backgroundColor: colors.purple }]} onPress={() => openDaySheet(selectedDate)}>
          <Feather name="plus" size={18} color="#fff" />
          <Text style={styles.logEntryBtnText}>Log Entry for {selectedDate === todayStr ? "Today" : selectedDate.slice(5).replace("-", "/")}</Text>
        </TouchableOpacity>

        {/* WELLNESS TREND */}
        <View style={[styles.trendCard, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
          <Text style={[styles.trendTitle, { color: colors.text }]}>Wellness Trend</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            <View style={styles.chipRow}>
              {(["water", "sleep", "stoolType", "weight"] as TrendMetric[]).map((m) => {
                const metColors: Record<TrendMetric, string> = { water: "#1B8A7B", sleep: "#C4881A", stoolType: "#10B981", weight: "#7C5CBF" };
                const active = trendMetric === m;
                return (
                  <TouchableOpacity key={m} style={[styles.chip, { backgroundColor: active ? metColors[m] : colors.sectionBg }]} onPress={() => setTrendMetric(m)}>
                    <Text style={[styles.chipText, { color: active ? "#fff" : colors.textSecondary }]}>{METRIC_LABELS[m]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
          <LineChart data={trendData} color={metricColor} unit={metricUnit} colors={colors} scrollable={trendPeriod === "monthly"} />
          {trendMetric === "stoolType" && (
            <View style={styles.legendRow}>
              <LegendDot color="#10B981" label="Normal" />
              <LegendDot color="#F97316" label="Moderate" />
              <LegendDot color="#EF4444" label="Severe" />
            </View>
          )}
        </View>

        {/* Stool Photos for selected day */}
        {selectedDayPhotos.length > 0 && (
          <View style={[styles.photoStrip, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
            <Text style={[styles.photoStripTitle, { color: colors.text }]}>
              Stool Photos · {selectedDate === todayStr ? "Today" : selectedDate.slice(5).replace("-", "/")}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              {selectedDayPhotos.map((uri, idx) => (
                <TouchableOpacity key={`${uri}-${idx}`} style={styles.photoThumbWrap} onPress={() => openPhotoViewer(selectedDayPhotos, idx)}>
                  <Image source={{ uri }} style={styles.photoThumb} />
                  {selectedBowel && <View style={[styles.photoThumbDot, { backgroundColor: bowelDotColor(selectedBowel.color as BowelColor) }]} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* DAILY LOG */}
        <View style={[styles.dailyLogCard, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
          <Text style={[styles.trendTitle, { color: colors.text }]}>
            {selectedDate === todayStr ? "Today's Log" : new Date(selectedDate + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </Text>

          {selectedBowel ? (
            <TouchableOpacity style={[styles.dailyRow, { backgroundColor: colors.sectionBg }]} onPress={() => openDaySheet(selectedDate)}>
              <View style={[styles.bowelDot, { backgroundColor: bowelDotColor(selectedBowel.color) }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.dailyLabel, { color: colors.text }]}>BM — {selectedBowel.color === "green" ? "Normal" : selectedBowel.color === "yellow" ? "Moderate" : "Severe"}</Text>
                {(selectedBowel.count ?? 0) > 0 && <Text style={[styles.dailySub, { color: colors.textSecondary }]}>{selectedBowel.count} movement{selectedBowel.count !== 1 ? "s" : ""}</Text>}
              </View>
              <Feather name="chevron-right" size={15} color={colors.placeholder} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.dailyRowEmpty, { borderColor: colors.border }]} onPress={() => openDaySheet(selectedDate)}>
              <Feather name="plus-circle" size={14} color={colors.placeholder} />
              <Text style={[styles.dailyEmptyText, { color: colors.placeholder }]}>Log bowel movement</Text>
            </TouchableOpacity>
          )}

          {selectedMeals.length > 0 ? (
            <TouchableOpacity style={[styles.dailyRow, { backgroundColor: colors.sectionBg }]} onPress={() => openEditSheet("meals")}>
              <Feather name="coffee" size={16} color={colors.tint} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.dailyLabel, { color: colors.text }]}>Meals — {selectedMeals.length} logged</Text>
                <Text style={[styles.dailySub, { color: colors.textSecondary }]} numberOfLines={1}>{selectedMeals.map((m) => m.foodDetails).join(" · ")}</Text>
              </View>
              <Feather name="chevron-right" size={15} color={colors.placeholder} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.dailyRowEmpty, { borderColor: colors.border }]} onPress={() => openEditSheet("meals")}>
              <Feather name="coffee" size={14} color={colors.placeholder} />
              <Text style={[styles.dailyEmptyText, { color: colors.placeholder }]}>No meals logged — tap to add</Text>
            </TouchableOpacity>
          )}

          {selectedWater > 0 ? (
            <TouchableOpacity style={[styles.dailyRow, { backgroundColor: colors.sectionBg }]} onPress={() => openEditSheet("water")}>
              <Feather name="droplet" size={16} color="#1B8A7B" />
              <Text style={[styles.dailyLabel, { color: colors.text, marginLeft: 10, flex: 1 }]}>Water — {selectedWater} ml</Text>
              <Feather name="chevron-right" size={15} color={colors.placeholder} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.dailyRowEmpty, { borderColor: colors.border }]} onPress={() => openEditSheet("water")}>
              <Feather name="droplet" size={14} color={colors.placeholder} />
              <Text style={[styles.dailyEmptyText, { color: colors.placeholder }]}>No water logged — tap to add</Text>
            </TouchableOpacity>
          )}

          {selectedSleep ? (
            <TouchableOpacity style={[styles.dailyRow, { backgroundColor: colors.sectionBg }]} onPress={() => openEditSheet("sleep")}>
              <Feather name="moon" size={16} color="#C4881A" />
              <Text style={[styles.dailyLabel, { color: colors.text, marginLeft: 10, flex: 1 }]}>Sleep — {calcSleepHours(selectedSleep.bedtime, selectedSleep.wakeTime)}</Text>
              <Feather name="chevron-right" size={15} color={colors.placeholder} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.dailyRowEmpty, { borderColor: colors.border }]} onPress={() => openEditSheet("sleep")}>
              <Feather name="moon" size={14} color={colors.placeholder} />
              <Text style={[styles.dailyEmptyText, { color: colors.placeholder }]}>No sleep logged — tap to add</Text>
            </TouchableOpacity>
          )}

          {selectedWeight ? (
            <TouchableOpacity style={[styles.dailyRow, { backgroundColor: colors.sectionBg }]} onPress={() => openEditSheet("weight")}>
              <Feather name="trending-up" size={16} color="#7C5CBF" />
              <Text style={[styles.dailyLabel, { color: colors.text, marginLeft: 10, flex: 1 }]}>Weight — {selectedWeight.toFixed(1)} kg</Text>
              <Feather name="chevron-right" size={15} color={colors.placeholder} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.dailyRowEmpty, { borderColor: colors.border }]} onPress={() => openEditSheet("weight")}>
              <Feather name="trending-up" size={14} color={colors.placeholder} />
              <Text style={[styles.dailyEmptyText, { color: colors.placeholder }]}>No weight logged — tap to add</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* DAY SHEET */}
      <Modal visible={showDaySheet} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={() => setShowDaySheet(false)}><View style={StyleSheet.absoluteFill} /></TouchableWithoutFeedback>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={[styles.bottomSheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 16 }]}>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
                  <Text style={[styles.sheetTitle, { color: colors.text }]}>{new Date(sheetDate + "T12:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</Text>

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Bowel Movement Color</Text>
                  <View style={styles.radioRow}>
                    {([["red", "Severe"], ["yellow", "Moderate"], ["green", "Normal"]] as [BowelColor, string][]).map(([c, label]) => (
                      <TouchableOpacity key={c} style={[styles.radioOption, { backgroundColor: colors.sectionBg, borderColor: bowelColor === c ? bowelDotColor(c) : "transparent", borderWidth: 2 }]} onPress={() => setBowelColor(c)}>
                        <View style={[styles.radioColorDot, { backgroundColor: bowelDotColor(c) }]} />
                        <Text style={[styles.radioLabel, { color: colors.text }]}>{label}</Text>
                        {bowelColor === c && <Feather name="check" size={14} color={bowelDotColor(c)} style={{ marginLeft: "auto" }} />}
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>BM Count</Text>
                  <View style={[styles.countRow, { backgroundColor: colors.sectionBg }]}>
                    <TouchableOpacity style={[styles.countBtn, { backgroundColor: colors.border }]} onPress={() => setBowelCount((v) => String(Math.max(0, (parseInt(v, 10) || 0) - 1)))}>
                      <Feather name="minus" size={18} color={colors.text} />
                    </TouchableOpacity>
                    <TextInput style={[styles.countInput, { color: colors.text }]} value={bowelCount} onChangeText={(v) => setBowelCount(v.replace(/[^0-9]/g, ""))} keyboardType="numeric" maxLength={2} />
                    <TouchableOpacity style={[styles.countBtn, { backgroundColor: colors.teal }]} onPress={() => setBowelCount((v) => String(Math.min(30, (parseInt(v, 10) || 0) + 1)))}>
                      <Feather name="plus" size={18} color="#fff" />
                    </TouchableOpacity>
                    <Text style={[styles.countLabel, { color: colors.textSecondary }]}>bowel movements today</Text>
                  </View>

                  <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.purple, marginBottom: 16 }]} onPress={handleSaveBowelLog}>
                    <Text style={styles.saveText}>Save Log</Text>
                  </TouchableOpacity>

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Stool Photos</Text>
                  <TouchableOpacity style={[styles.photoAddBtn, { backgroundColor: colors.sectionBg, borderColor: colors.border }]} onPress={handleAddPhoto}>
                    <Feather name="camera" size={18} color={colors.gold} />
                    <Text style={[styles.photoAddText, { color: colors.gold }]}>Add Stool Photos</Text>
                  </TouchableOpacity>
                  {sheetPhotos.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                      {sheetPhotos.map((uri, idx) => (
                        <TouchableOpacity key={uri} style={{ marginRight: 10 }} onPress={() => openPhotoViewer(sheetPhotos, idx)}>
                          <Image source={{ uri }} style={styles.bigPhotoThumb} />
                          <TouchableOpacity style={styles.photoDeleteBtn} onPress={() => handleDeletePhoto(uri)}>
                            <Feather name="x" size={12} color="#fff" />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                  <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.sectionBg, marginTop: 16 }]} onPress={() => setShowDaySheet(false)}>
                    <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Close</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* EDIT SHEET — water / sleep / weight / meals */}
      <Modal visible={activeEditSheet !== null} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={() => setActiveEditSheet(null)}><View style={StyleSheet.absoluteFill} /></TouchableWithoutFeedback>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={[styles.bottomSheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 16 }]}>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
                  <Text style={[styles.sheetTitle, { color: colors.text }]}>
                    {activeEditSheet === "water" ? "💧 Water Intake" : activeEditSheet === "sleep" ? "🌙 Sleep" : activeEditSheet === "weight" ? "⚖️ Weight" : "🍽 Meals"}
                    {"  "}
                    <Text style={{ fontSize: 13, fontWeight: "400" as const, color: colors.textSecondary }}>
                      {new Date(selectedDate + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </Text>
                  </Text>

                  {/* WATER */}
                  {activeEditSheet === "water" && (
                    <View>
                      {waterEntries.filter((w) => w.date === selectedDate).length > 0 && (
                        <View style={{ marginBottom: 16 }}>
                          <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 8 }]}>LOGGED ENTRIES</Text>
                          {waterEntries.filter((w) => w.date === selectedDate).map((w) => (
                            <View key={w.id} style={[styles.dailyRow, { backgroundColor: editingWaterId === w.id ? "#1B8A7B22" : colors.sectionBg, marginBottom: 6, borderWidth: editingWaterId === w.id ? 1 : 0, borderColor: "#1B8A7B" }]}>
                              <Feather name="droplet" size={14} color="#1B8A7B" />
                              <Text style={[styles.dailyLabel, { color: colors.text, marginLeft: 8, flex: 1 }]}>{w.amountMl} ml{w.time ? `  ·  ${w.time}` : ""}</Text>
                              <TouchableOpacity onPress={() => startEditWater(w.id, w.amountMl)} style={{ padding: 6 }}>
                                <Feather name="edit-2" size={14} color={colors.tint} />
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => { if (editingWaterId === w.id) setEditingWaterId(null); deleteWaterEntry(w.id); }} style={{ padding: 6 }}>
                                <Feather name="trash-2" size={14} color="#EF4444" />
                              </TouchableOpacity>
                            </View>
                          ))}
                          <Text style={[styles.dailySub, { color: colors.teal, textAlign: "right", marginBottom: 8 }]}>
                            Total: {waterEntries.filter((w) => w.date === selectedDate).reduce((s, w) => s + w.amountMl, 0)} ml
                          </Text>
                        </View>
                      )}
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{editingWaterId ? "EDIT ENTRY (ml)" : "ADD WATER (ml)"}</Text>
                      <View style={[styles.countRow, { backgroundColor: colors.sectionBg }]}>
                        <TouchableOpacity style={[styles.countBtn, { backgroundColor: colors.border }]} onPress={() => setEditWaterAmount((v) => String(Math.max(50, (parseFloat(v) || 0) - 50)))}>
                          <Feather name="minus" size={18} color={colors.text} />
                        </TouchableOpacity>
                        <TextInput style={[styles.countInput, { color: colors.text }]} value={editWaterAmount} onChangeText={setEditWaterAmount} keyboardType="numeric" maxLength={5} />
                        <TouchableOpacity style={[styles.countBtn, { backgroundColor: "#1B8A7B" }]} onPress={() => setEditWaterAmount((v) => String((parseFloat(v) || 0) + 50))}>
                          <Feather name="plus" size={18} color="#fff" />
                        </TouchableOpacity>
                        <Text style={[styles.countLabel, { color: colors.textSecondary }]}>ml</Text>
                      </View>
                      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                        {[150, 200, 250, 350, 500].map((ml) => (
                          <TouchableOpacity key={ml} onPress={() => setEditWaterAmount(String(ml))} style={[styles.chip, { backgroundColor: editWaterAmount === String(ml) ? "#1B8A7B" : colors.sectionBg }]}>
                            <Text style={[styles.chipText, { color: editWaterAmount === String(ml) ? "#fff" : colors.textSecondary }]}>{ml} ml</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {editingWaterId && (
                          <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.sectionBg, flex: 1 }]} onPress={() => { setEditingWaterId(null); setEditWaterAmount("250"); }}>
                            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel Edit</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: "#1B8A7B", flex: 1 }]} onPress={handleAddWater}>
                          <Text style={styles.saveText}>{editingWaterId ? "Update Entry" : "Add Entry"}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* SLEEP */}
                  {activeEditSheet === "sleep" && (
                    <View>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 0 }]}>TIME FORMAT</Text>
                        <View style={[styles.toggleGroup, { borderColor: colors.border, borderWidth: 1 }]}>
                          <TouchableOpacity style={[styles.toggleBtn, calSleepFmt === "12h" && { backgroundColor: colors.teal }]} onPress={() => setCalSleepFmt("12h")}>
                            <Text style={[styles.toggleBtnText, { color: calSleepFmt === "12h" ? "#fff" : colors.textSecondary }]}>12 HR</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.toggleBtn, calSleepFmt === "24h" && { backgroundColor: colors.teal }]} onPress={() => setCalSleepFmt("24h")}>
                            <Text style={[styles.toggleBtnText, { color: calSleepFmt === "24h" ? "#fff" : colors.textSecondary }]}>24 HR</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>BEDTIME</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                        <Feather name="moon" size={16} color="#C4881A" style={{ marginRight: 10 }} />
                        {calSleepFmt === "12h"
                          ? <SimpleTimeInput value={editSleepBed} onChange={setEditSleepBed} colors={colors} />
                          : <CalSimple24hInput value={editSleepBed} onChange={setEditSleepBed} colors={colors} />}
                      </View>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>WAKE TIME</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                        <Feather name="sun" size={16} color="#F97316" style={{ marginRight: 10 }} />
                        {calSleepFmt === "12h"
                          ? <SimpleTimeInput value={editSleepWake} onChange={setEditSleepWake} colors={colors} />
                          : <CalSimple24hInput value={editSleepWake} onChange={setEditSleepWake} colors={colors} />}
                      </View>
                      {editSleepBed && editSleepWake && (
                        <Text style={[styles.dailySub, { color: colors.teal, marginBottom: 12 }]}>
                          Duration: {calcSleepHours(editSleepBed, editSleepWake)}
                        </Text>
                      )}
                      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: "#C4881A" }]} onPress={handleSaveSleep}>
                        <Text style={styles.saveText}>Save Sleep</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* WEIGHT */}
                  {activeEditSheet === "weight" && (
                    <View>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>WEIGHT (kg)</Text>
                      <View style={[styles.countRow, { backgroundColor: colors.sectionBg }]}>
                        <TouchableOpacity style={[styles.countBtn, { backgroundColor: colors.border }]} onPress={() => setEditWeightKg((v) => { const n = parseFloat(v) || 0; return n > 0.1 ? (n - 0.1).toFixed(1) : v; })}>
                          <Feather name="minus" size={18} color={colors.text} />
                        </TouchableOpacity>
                        <TextInput style={[styles.countInput, { color: colors.text }]} value={editWeightKg} onChangeText={setEditWeightKg} keyboardType="decimal-pad" maxLength={6} placeholder="70.0" placeholderTextColor={colors.placeholder} />
                        <TouchableOpacity style={[styles.countBtn, { backgroundColor: "#7C5CBF" }]} onPress={() => setEditWeightKg((v) => { const n = parseFloat(v) || 0; return (n + 0.1).toFixed(1); })}>
                          <Feather name="plus" size={18} color="#fff" />
                        </TouchableOpacity>
                        <Text style={[styles.countLabel, { color: colors.textSecondary }]}>kg</Text>
                      </View>
                      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: "#7C5CBF" }]} onPress={handleSaveWeight}>
                        <Text style={styles.saveText}>Save Weight</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* MEALS */}
                  {activeEditSheet === "meals" && (
                    <View>
                      {meals.filter((m) => m.date === selectedDate).length === 0 && !showMealAddForm && (
                        <View style={{ alignItems: "center", paddingVertical: 16 }}>
                          <Feather name="coffee" size={28} color={colors.placeholder} />
                          <Text style={[styles.dailySub, { color: colors.placeholder, marginTop: 8 }]}>No meals logged for this day</Text>
                        </View>
                      )}
                      {meals.filter((m) => m.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time)).map((meal) => (
                        <View key={meal.id} style={[styles.dailyRow, { backgroundColor: colors.sectionBg, marginBottom: 6, alignItems: "flex-start" }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.dailySub, { color: colors.textSecondary }]}>{meal.time}</Text>
                            <Text style={[styles.dailyLabel, { color: colors.text }]} numberOfLines={2}>{meal.foodDetails}</Text>
                          </View>
                          <TouchableOpacity onPress={() => openEditMeal(meal)} style={{ padding: 6 }}>
                            <Feather name="edit-2" size={14} color={colors.tint} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => Alert.alert("Delete meal?", meal.foodDetails, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => deleteMeal(meal.id) }])} style={{ padding: 6 }}>
                            <Feather name="trash-2" size={14} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      ))}
                      {!showMealAddForm && (
                        <TouchableOpacity style={[styles.photoAddBtn, { backgroundColor: colors.sectionBg, borderColor: colors.border, marginTop: 8 }]} onPress={() => { setShowMealAddForm(true); setEditingMealId(null); setMealFormFood(""); setMealFormTime("08:00"); }}>
                          <Feather name="plus" size={16} color={colors.tint} />
                          <Text style={[styles.photoAddText, { color: colors.tint }]}>Add Meal</Text>
                        </TouchableOpacity>
                      )}
                      {showMealAddForm && (
                        <View style={{ marginTop: 12 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 0 }]}>{editingMealId ? "EDIT MEAL" : "NEW MEAL"}</Text>
                            <View style={[styles.toggleGroup, { borderColor: colors.border, borderWidth: 1 }]}>
                              <TouchableOpacity style={[styles.toggleBtn, calMealFmt === "12h" && { backgroundColor: colors.teal }]} onPress={() => setCalMealFmt("12h")}>
                                <Text style={[styles.toggleBtnText, { color: calMealFmt === "12h" ? "#fff" : colors.textSecondary }]}>12h</Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={[styles.toggleBtn, calMealFmt === "24h" && { backgroundColor: colors.teal }]} onPress={() => setCalMealFmt("24h")}>
                                <Text style={[styles.toggleBtnText, { color: calMealFmt === "24h" ? "#fff" : colors.textSecondary }]}>24h</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>MEAL TIME</Text>
                          <View style={[styles.modalTimeRow, { marginBottom: 10 }]}>
                            {calMealFmt === "12h"
                              ? <SimpleTimeInput value={mealFormTime} onChange={setMealFormTime} colors={colors} />
                              : <CalSimple24hInput value={mealFormTime} onChange={setMealFormTime} colors={colors} />}
                          </View>
                          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>FOOD DETAILS</Text>
                          <View style={[{ backgroundColor: colors.sectionBg, borderRadius: 12, padding: 12, marginBottom: 10 }]}>
                            <TextInput
                              style={[{ color: colors.text, fontSize: 14, minHeight: 60 }]}
                              value={mealFormFood}
                              onChangeText={setMealFormFood}
                              placeholder="Food details…"
                              placeholderTextColor={colors.placeholder}
                              multiline
                            />
                          </View>
                          <TouchableOpacity style={[styles.photoAddBtn, { backgroundColor: colors.sectionBg, borderColor: colors.border, marginBottom: 8 }]} onPress={handleAddMealPhoto}>
                            <Feather name="camera" size={16} color={colors.gold} />
                            <Text style={[styles.photoAddText, { color: colors.gold }]}>Add Food Photo</Text>
                          </TouchableOpacity>
                          {mealFormImages.length > 0 && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                              {mealFormImages.map((uri, idx) => (
                                <View key={`${uri}-${idx}`} style={{ marginRight: 8 }}>
                                  <Image source={{ uri }} style={styles.bigPhotoThumb} />
                                  <TouchableOpacity style={styles.photoDeleteBtn} onPress={() => setMealFormImages((p) => p.filter((_, i) => i !== idx))}>
                                    <Feather name="x" size={12} color="#fff" />
                                  </TouchableOpacity>
                                </View>
                              ))}
                            </ScrollView>
                          )}
                          <View style={{ flexDirection: "row", gap: 8 }}>
                            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.sectionBg, flex: 1 }]} onPress={() => { setShowMealAddForm(false); setEditingMealId(null); setMealFormImages([]); }}>
                              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.tint, flex: 1 }]} onPress={handleSaveMeal}>
                              <Text style={styles.saveText}>{editingMealId ? "Update" : "Add"}</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  )}

                  <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.sectionBg, marginTop: 20 }]} onPress={() => setActiveEditSheet(null)}>
                    <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Close</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* IMAGE VIEWER */}
      <Modal visible={!!showImageViewer} animationType="fade" transparent>
        <View style={styles.imageViewerOverlay}>
          {showImageViewer && <Image source={{ uri: showImageViewer }} style={styles.fullImage} resizeMode="contain" />}
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
          <TouchableOpacity style={styles.closeBtn} onPress={() => setShowImageViewer(null)}>
            <Feather name="x" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ fontSize: 10, color: "#6B7280" }}>{label}</Text>
    </View>
  );
}

function LineChart({ data, color, unit, colors, scrollable }: { data: { label: string; value: number; pointColor: string }[]; color: string; unit: string; colors: any; scrollable?: boolean }) {
  const PT_SPACING = 26;
  const padL = 36; const padR = 16; const padT = 14; const padB = 28;
  const H = 130;
  const plotW = scrollable ? Math.max((data.length - 1) * PT_SPACING, 252) : 252;
  const W = padL + plotW + padR;
  const plotH = H - padT - padB;
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const pts = data.map((d, i) => ({
    x: padL + (scrollable ? i * PT_SPACING : (i / Math.max(data.length - 1, 1)) * plotW),
    y: padT + plotH - (d.value / maxVal) * plotH,
    label: d.label, value: d.value, pointColor: d.pointColor,
  }));
  const polylinePoints = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const yTicks = [0, maxVal / 2, maxVal].map((v) => ({
    y: padT + plotH - (v / maxVal) * plotH,
    label: maxVal > 999 ? `${Math.round(v / 1000)}k` : v.toFixed(maxVal < 5 ? 1 : 0),
  }));
  const chartEl = (
    <Svg width={W} height={H}>
      {yTicks.map((t, i) => (
        <React.Fragment key={i}>
          <Line x1={padL} y1={t.y} x2={W - padR} y2={t.y} stroke={colors.border ?? "#E5E5E5"} strokeWidth={0.5} strokeDasharray="3,3" />
          <SvgText x={padL - 4} y={t.y + 4} fontSize={8} fill={colors.textSecondary ?? "#888"} textAnchor="end">{t.label}</SvgText>
        </React.Fragment>
      ))}
      {pts.length > 1 && <Polyline points={polylinePoints} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
      {pts.map((p, i) => (
        <React.Fragment key={i}>
          <Circle cx={p.x} cy={p.y} r={4} fill={p.value > 0 ? p.pointColor : colors.border ?? "#E5E5E5"} />
          <SvgText x={p.x} y={H - 8} fontSize={8} fill={colors.textSecondary ?? "#888"} textAnchor="middle">{p.label}</SvgText>
        </React.Fragment>
      ))}
    </Svg>
  );
  return (
    <View style={{ marginTop: 8 }}>
      {scrollable ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ paddingRight: 8 }}>
          {chartEl}
        </ScrollView>
      ) : (
        <View style={{ alignItems: "center" }}>{chartEl}</View>
      )}
      <Text style={{ fontSize: 10, color: colors.placeholder, marginTop: 4, textAlign: "center" }}>{unit}{scrollable ? "  ← scroll →" : ""}</Text>
    </View>
  );
}

function MonthlyView({ viewYear, viewMonth, todayStr, selectedDate, bowelMap, colors, onPrev, onNext, onDayTap }: any) {
  const { firstDay, daysInMonth } = getMonthDays(viewYear, viewMonth);
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return (
    <View style={[styles.calCard, { backgroundColor: colors.card }]}>
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={onPrev} style={styles.navBtn}><Feather name="chevron-left" size={22} color={colors.tint} /></TouchableOpacity>
        <Text style={[styles.monthLabel, { color: colors.text }]}>{MONTHS[viewMonth]} {viewYear}</Text>
        <TouchableOpacity onPress={onNext} style={styles.navBtn}><Feather name="chevron-right" size={22} color={colors.tint} /></TouchableOpacity>
      </View>
      <View style={styles.weekdaysRow}>
        {WEEKDAYS.map((d) => <Text key={d} style={[styles.weekday, { color: colors.textSecondary }]}>{d}</Text>)}
      </View>
      <View style={styles.grid}>
        {cells.map((day, idx) => {
          if (day === null) return <View key={`e${idx}`} style={styles.cell} />;
          const dateStr = toDateStr(viewYear, viewMonth, day);
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === todayStr;
          const bowel = bowelMap[dateStr];
          const dotColor = bowelDotColor(bowel?.color);
          return (
            <TouchableOpacity key={dateStr}
              style={[styles.cell,
                isToday && !isSelected && { backgroundColor: colors.tealLight, borderRadius: 20 },
                isSelected && { backgroundColor: colors.teal, borderRadius: 20 }]}
              onPress={() => onDayTap(dateStr)}>
              <Text style={[styles.dayText, { color: isSelected ? "#fff" : isToday ? colors.teal : colors.text }, isToday && { fontWeight: "700" as const }]}>{day}</Text>
              {bowel ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function WeeklyView({ todayStr, selectedDate, bowelMap, colors, onDayTap }: any) {
  const monday = getMondayOfWeek(todayStr);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  return (
    <View style={[styles.calCard, { backgroundColor: colors.card }]}>
      <Text style={[styles.monthLabel, { color: colors.text, marginBottom: 16 }]}>This Week</Text>
      <View style={styles.weekStrip}>
        {days.map((dateStr, i) => {
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const bowel = bowelMap[dateStr];
          const dotColor = bowelDotColor(bowel?.color);
          const day = parseInt(dateStr.slice(-2), 10);
          return (
            <TouchableOpacity key={dateStr}
              style={[styles.weekDay,
                isToday && !isSelected && { backgroundColor: colors.tealLight, borderRadius: 12 },
                isSelected && { backgroundColor: colors.teal, borderRadius: 12 }]}
              onPress={() => onDayTap(dateStr)}>
              <Text style={[styles.weekDayName, { color: isSelected || isToday ? (isSelected ? "#fff" : colors.teal) : colors.textSecondary }]}>{MON_SUN[i].slice(0, 3)}</Text>
              <Text style={[styles.weekDayNum, { color: isSelected ? "#fff" : isToday ? colors.teal : colors.text }, isToday && !isSelected && { fontWeight: "700" as const }]}>{day}</Text>
              <View style={[styles.weekDot, { backgroundColor: bowel ? dotColor : "transparent" }]} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function YearlyView({ year, bowelMap, todayStr, selectedDate, colors, onYearChange, onDayTap }: any) {
  return (
    <View>
      <View style={styles.yearNav}>
        <TouchableOpacity onPress={() => onYearChange(year - 1)} style={styles.navBtn}><Feather name="chevron-left" size={22} color={colors.tint} /></TouchableOpacity>
        <Text style={[styles.monthLabel, { color: colors.text }]}>{year}</Text>
        <TouchableOpacity onPress={() => onYearChange(year + 1)} style={styles.navBtn}><Feather name="chevron-right" size={22} color={colors.tint} /></TouchableOpacity>
      </View>
      {Array.from({ length: 12 }, (_, m) => {
        const { firstDay, daysInMonth } = getMonthDays(year, m);
        const cells: (number | null)[] = Array(firstDay).fill(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);
        return (
          <View key={m} style={[styles.yearMonth, { backgroundColor: colors.card }]}>
            <Text style={[styles.yearMonthLabel, { color: colors.text }]}>{MONTHS_SHORT[m]}</Text>
            <View style={styles.yearGrid}>
              {cells.map((day, idx) => {
                if (day === null) return <View key={`e${m}${idx}`} style={styles.yearCell} />;
                const dateStr = toDateStr(year, m, day);
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;
                const bowel = bowelMap[dateStr];
                const dotColor = bowelDotColor(bowel?.color);
                return (
                  <TouchableOpacity key={dateStr}
                    style={[styles.yearCell,
                      isToday && !isSelected && { backgroundColor: colors.tealLight, borderRadius: 3 },
                      isSelected && { backgroundColor: colors.teal, borderRadius: 3 }]}
                    onPress={() => onDayTap(dateStr)}>
                    {bowel ? <View style={[styles.yearDot, { backgroundColor: dotColor }]} /> : <Text style={[styles.yearDayText, { color: isSelected ? "#fff" : isToday ? colors.teal : colors.textSecondary }, isToday && !isSelected && { fontWeight: "700" as const }]}>{day}</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: "700" as const },
  viewTabsRow: { paddingHorizontal: 16, paddingBottom: 12 },
  viewTabs: { flexDirection: "row", borderRadius: 12, padding: 4 },
  viewTab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center" },
  viewTabText: { fontSize: 13, fontWeight: "600" as const },
  calCard: { margin: 16, borderRadius: 16, padding: 16, shadowColor: "rgba(0,0,0,0.06)", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  navBtn: { padding: 8 },
  monthLabel: { fontSize: 18, fontWeight: "600" as const },
  weekdaysRow: { flexDirection: "row", marginBottom: 8 },
  weekday: { flex: 1, textAlign: "center", fontSize: 12, fontWeight: "500" as const },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  dayText: { fontSize: 14 },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 1 },
  weekStrip: { flexDirection: "row", justifyContent: "space-between" },
  weekDay: { flex: 1, alignItems: "center", padding: 8 },
  weekDayName: { fontSize: 11, fontWeight: "500" as const, marginBottom: 4 },
  weekDayNum: { fontSize: 16, fontWeight: "700" as const },
  weekDot: { width: 6, height: 6, borderRadius: 3, marginTop: 4 },
  yearNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  yearMonth: { marginHorizontal: 16, marginBottom: 10, borderRadius: 12, padding: 12 },
  yearMonthLabel: { fontSize: 12, fontWeight: "700" as const, marginBottom: 8 },
  yearGrid: { flexDirection: "row", flexWrap: "wrap" },
  yearCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  yearDayText: { fontSize: 9 },
  yearDot: { width: 6, height: 6, borderRadius: 3 },
  logEntryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 14 },
  logEntryBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" as const },
  photoStrip: { marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 16, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  photoStripTitle: { fontSize: 14, fontWeight: "700" as const },
  photoThumbWrap: { marginRight: 10, alignItems: "center" },
  photoThumb: { width: 70, height: 70, borderRadius: 12 },
  photoThumbDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  trendCard: { marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 16, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  trendTitle: { fontSize: 17, fontWeight: "700" as const, marginBottom: 12 },
  chipRow: { flexDirection: "row", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  chipText: { fontSize: 13, fontWeight: "600" as const },
  periodRow: { flexDirection: "row", borderRadius: 10, padding: 4, marginBottom: 8 },
  periodBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: "center" },
  periodBtnText: { fontSize: 12, fontWeight: "600" as const },
  legendRow: { flexDirection: "row", gap: 12, marginTop: 8, flexWrap: "wrap", justifyContent: "center" },
  dailyLogCard: { marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 16, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  dailyRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, marginBottom: 8 },
  dailyRowEmpty: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderStyle: "dashed", marginBottom: 8 },
  dailyLabel: { fontSize: 14, fontWeight: "500" as const },
  dailySub: { fontSize: 12, marginTop: 2 },
  dailyEmptyText: { fontSize: 13 },
  bowelDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  bottomSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "85%" },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: "700" as const, marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: "600" as const, letterSpacing: 0.5, marginBottom: 10 },
  radioRow: { gap: 8, marginBottom: 12 },
  radioOption: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12 },
  radioColorDot: { width: 14, height: 14, borderRadius: 7, marginRight: 10 },
  radioLabel: { fontSize: 15, fontWeight: "500" as const },
  countRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, padding: 8, gap: 10, marginBottom: 16 },
  countBtn: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  countInput: { fontSize: 24, fontWeight: "700" as const, minWidth: 50, textAlign: "center" },
  countLabel: { fontSize: 13, flex: 1 },
  saveBtn: { padding: 14, borderRadius: 12, alignItems: "center" },
  saveText: { color: "#fff", fontSize: 15, fontWeight: "600" as const },
  cancelBtn: { padding: 14, borderRadius: 12, alignItems: "center" },
  cancelText: { fontSize: 15, fontWeight: "600" as const },
  photoAddBtn: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed" },
  photoAddText: { fontSize: 14, fontWeight: "500" as const },
  bigPhotoThumb: { width: 90, height: 90, borderRadius: 12 },
  photoDeleteBtn: { position: "absolute", top: 4, right: 4, backgroundColor: "rgba(0,0,0,0.6)", width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  imageViewerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" },
  fullImage: { width: "100%", height: "80%" },
  viewerNav: { flexDirection: "row", alignItems: "center", gap: 20, marginTop: 16 },
  viewerNavBtn: { padding: 8 },
  viewerCounter: { color: "rgba(255,255,255,0.7)", fontSize: 14 },
  closeBtn: { position: "absolute", top: 60, right: 20, width: 44, height: 44, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 22, alignItems: "center", justifyContent: "center" },
  toggleGroup: { flexDirection: "row", borderRadius: 8, overflow: "hidden" },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  toggleBtnText: { fontSize: 13, fontWeight: "600" as const },
  modalTimeRow: { flexDirection: "row", alignItems: "center" },
});
