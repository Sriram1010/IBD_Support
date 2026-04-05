import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Image, Alert, Platform, useColorScheme,
  KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, TextInput,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Svg, { Polyline, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop } from "react-native-svg";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useApp, BowelLog } from "@/context/AppContext";
import { calcSleepHours, calcSleepHoursNum } from "@/hooks/useDateString";

type ViewMode = "monthly" | "weekly" | "yearly";
type BowelColor = "red" | "yellow" | "green";
type TrendMetric = "water" | "sleep" | "stoolCount" | "stoolType" | "weight";
type TrendPeriod = "weekly" | "monthly" | "yearly";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
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
function getLast7Days(todayStr: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(todayStr, i - 6));
}
function getLast30Days(todayStr: string): string[] {
  return Array.from({ length: 30 }, (_, i) => addDays(todayStr, i - 29));
}

function getStoolCountColor(count: number): string {
  if (count === 0) return "#9CA3AF";
  if (count === 1) return "#10B981";
  if (count <= 3) return "#F97316";
  return "#EF4444";
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
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>("weekly");

  const {
    meals, waterEntries, sleepLogs, bowelLogs, weightLogs,
    saveBowelLog, deleteBowelPhoto, getBowelLog,
    waterGoalMl, sleepGoalHours, weightGoalKg,
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

  const handleDayTap = (date: string) => {
    setSelectedDate(date);
  };

  const handleSaveBowelLog = async () => {
    const existing = bowelMap[sheetDate];
    await saveBowelLog({
      date: sheetDate,
      color: bowelColor,
      count: Math.max(0, parseInt(bowelCount, 10) || 0),
      photos: existing?.photos ?? [],
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleAddPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("Permission needed", "Photo library access is required.");
      return;
    }
    Alert.alert("Add Photo", "Choose source", [
      {
        text: "Camera",
        onPress: async () => {
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
        text: "Photo Library",
        onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
          if (!r.canceled && r.assets[0]) {
            const ex = bowelMap[sheetDate];
            await saveBowelLog({ date: sheetDate, color: ex?.color ?? bowelColor, count: parseInt(bowelCount, 10) || 0, photos: [...(ex?.photos ?? []), r.assets[0].uri] });
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
    setViewerImages(photos);
    setViewerIndex(startIdx);
    setShowImageViewer(photos[startIdx]);
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
      const days = getLast7Days(todayStr);
      return days.map((d) => {
        let value = 0;
        let pointColor = "#9CA3AF";
        if (trendMetric === "water") {
          const ml = waterEntries.filter((w) => w.date === d).reduce((s, w) => s + w.amountMl, 0);
          value = ml / 100;
          const pct = Math.min((ml / waterGoalMl) * 100, 100);
          pointColor = ml > 0 ? getProgressColor(pct) : "#9CA3AF";
        } else if (trendMetric === "sleep") {
          const sl = sleepLogs.find((s) => s.date === d);
          value = sl ? calcSleepHoursNum(sl.bedtime, sl.wakeTime) : 0;
          const pct = Math.min((value / sleepGoalHours) * 100, 100);
          pointColor = value > 0 ? getProgressColor(pct) : "#9CA3AF";
        } else if (trendMetric === "stoolCount") {
          value = bowelMap[d]?.count ?? 0;
          pointColor = getStoolCountColor(value);
        } else if (trendMetric === "stoolType") {
          const b = bowelMap[d];
          value = b ? (b.color === "green" ? 1 : b.color === "yellow" ? 2 : 3) : 0;
          pointColor = getStoolTypeColor(b?.color);
        } else if (trendMetric === "weight") {
          value = weightMap[d] ?? 0;
          if (value > 0 && weightGoalKg > 0) {
            const diff = Math.abs(value - weightGoalKg) / weightGoalKg;
            const pct = Math.max(0, 100 - diff * 200);
            pointColor = getProgressColor(pct);
          } else {
            pointColor = value > 0 ? "#7C5CBF" : "#9CA3AF";
          }
        }
        const dt = new Date(d + "T12:00");
        return { label: WEEKDAYS[dt.getDay()].slice(0, 1), value, pointColor };
      });
    } else if (trendPeriod === "monthly") {
      const days = getLast30Days(todayStr);
      const sampled = days.filter((_, i) => i % 5 === 0 || i === days.length - 1);
      return sampled.map((d) => {
        let value = 0;
        let pointColor = "#9CA3AF";
        if (trendMetric === "water") {
          const ml = waterEntries.filter((w) => w.date === d).reduce((s, w) => s + w.amountMl, 0);
          value = ml / 100;
          pointColor = ml > 0 ? getProgressColor(Math.min((ml / waterGoalMl) * 100, 100)) : "#9CA3AF";
        } else if (trendMetric === "sleep") {
          const sl = sleepLogs.find((s) => s.date === d);
          value = sl ? calcSleepHoursNum(sl.bedtime, sl.wakeTime) : 0;
          pointColor = value > 0 ? getProgressColor(Math.min((value / sleepGoalHours) * 100, 100)) : "#9CA3AF";
        } else if (trendMetric === "stoolCount") {
          value = bowelMap[d]?.count ?? 0;
          pointColor = getStoolCountColor(value);
        } else if (trendMetric === "stoolType") {
          const b = bowelMap[d];
          value = b ? (b.color === "green" ? 1 : b.color === "yellow" ? 2 : 3) : 0;
          pointColor = getStoolTypeColor(b?.color);
        } else if (trendMetric === "weight") {
          value = weightMap[d] ?? 0;
          pointColor = value > 0 ? "#7C5CBF" : "#9CA3AF";
        }
        return { label: d.slice(5).replace("-", "/"), value, pointColor };
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
          value = daysCount > 0 ? (total / daysCount) / 100 : 0;
          pointColor = value > 0 ? getProgressColor(Math.min((value * 100 / waterGoalMl) * 100, 100)) : "#9CA3AF";
        } else if (trendMetric === "sleep") {
          const monthSleeps = sleepLogs.filter((s) => s.date.startsWith(monthStr));
          const avg = monthSleeps.reduce((s, sl) => s + calcSleepHoursNum(sl.bedtime, sl.wakeTime), 0) / (monthSleeps.length || 1);
          value = monthSleeps.length > 0 ? avg : 0;
          pointColor = value > 0 ? getProgressColor(Math.min((value / sleepGoalHours) * 100, 100)) : "#9CA3AF";
        } else if (trendMetric === "stoolCount") {
          const monthBowels = bowelLogs.filter((b) => b.date.startsWith(monthStr));
          value = monthBowels.length > 0 ? monthBowels.reduce((s, b) => s + (b.count ?? 0), 0) / monthBowels.length : 0;
          pointColor = getStoolCountColor(Math.round(value));
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

  const trendData = useMemo(() => getTrendData(), [trendMetric, trendPeriod, waterEntries, sleepLogs, bowelLogs, weightLogs, viewYear, waterGoalMl, sleepGoalHours, weightGoalKg]);

  const metricColor = trendMetric === "water" ? "#1B8A7B"
    : trendMetric === "sleep" ? "#C4881A"
    : trendMetric === "stoolCount" ? "#2E1B5E"
    : trendMetric === "stoolType" ? "#10B981"
    : "#7C5CBF";
  const metricUnit = trendMetric === "water" ? "×100ml"
    : trendMetric === "sleep" ? "hrs"
    : trendMetric === "stoolCount" ? "BMs"
    : trendMetric === "stoolType" ? "level"
    : "kg";

  const METRIC_LABELS: Record<TrendMetric, string> = {
    water: "Water",
    sleep: "Sleep",
    stoolCount: "BM Count",
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
            <TouchableOpacity
              key={mode}
              style={[styles.viewTab, viewMode === mode && { backgroundColor: colors.purple }]}
              onPress={() => setViewMode(mode)}
            >
              <Text style={[styles.viewTabText, { color: viewMode === mode ? "#fff" : colors.textSecondary }]}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {viewMode === "monthly" && (
          <MonthlyView
            viewYear={viewYear} viewMonth={viewMonth} todayStr={todayStr} selectedDate={selectedDate}
            bowelMap={bowelMap} colors={colors}
            onPrev={prevMonth} onNext={nextMonth} onDayTap={handleDayTap}
          />
        )}
        {viewMode === "weekly" && (
          <WeeklyView todayStr={todayStr} bowelMap={bowelMap} colors={colors} onDayTap={handleDayTap} />
        )}
        {viewMode === "yearly" && (
          <YearlyView year={viewYear} bowelMap={bowelMap} todayStr={todayStr} colors={colors} onYearChange={(y) => setViewYear(y)} onDayTap={handleDayTap} />
        )}

        {/* Log Entry button */}
        <TouchableOpacity
          style={[styles.logEntryBtn, { backgroundColor: colors.purple }]}
          onPress={() => openDaySheet(selectedDate)}
        >
          <Feather name="plus" size={18} color="#fff" />
          <Text style={styles.logEntryBtnText}>Log Entry for {selectedDate === todayStr ? "Today" : selectedDate.slice(5).replace("-", "/")}</Text>
        </TouchableOpacity>

        {/* ── WELLNESS TREND ── */}
        <View style={[styles.trendCard, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
          <Text style={[styles.trendTitle, { color: colors.text }]}>Wellness Trend</Text>

          {/* Metric filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            <View style={styles.chipRow}>
              {(["water", "sleep", "stoolCount", "stoolType", "weight"] as TrendMetric[]).map((m) => {
                const metColors: Record<TrendMetric, string> = { water: "#1B8A7B", sleep: "#C4881A", stoolCount: "#2E1B5E", stoolType: "#10B981", weight: "#7C5CBF" };
                const active = trendMetric === m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.chip, { backgroundColor: active ? metColors[m] : colors.sectionBg }]}
                    onPress={() => setTrendMetric(m)}
                  >
                    <Text style={[styles.chipText, { color: active ? "#fff" : colors.textSecondary }]}>{METRIC_LABELS[m]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Period filter */}
          <View style={[styles.periodRow, { backgroundColor: colors.sectionBg }]}>
            {(["weekly", "monthly", "yearly"] as TrendPeriod[]).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.periodBtn, trendPeriod === p && { backgroundColor: colors.purple }]}
                onPress={() => setTrendPeriod(p)}
              >
                <Text style={[styles.periodBtnText, { color: trendPeriod === p ? "#fff" : colors.textSecondary }]}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Line chart */}
          <LineChart data={trendData} color={metricColor} unit={metricUnit} colors={colors} />

          {/* Color legend for stool metrics */}
          {trendMetric === "stoolCount" && (
            <View style={styles.legendRow}>
              <LegendDot color="#10B981" label="1 BM (normal)" />
              <LegendDot color="#F97316" label="2–3 BMs" />
              <LegendDot color="#EF4444" label="4+ BMs" />
            </View>
          )}
          {trendMetric === "stoolType" && (
            <View style={styles.legendRow}>
              <LegendDot color="#10B981" label="Normal" />
              <LegendDot color="#F97316" label="Moderate" />
              <LegendDot color="#EF4444" label="Severe" />
            </View>
          )}
        </View>

        {/* Photos for selected day */}
        {selectedDayPhotos.length > 0 && (
          <View style={[styles.photoStrip, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
            <Text style={[styles.photoStripTitle, { color: colors.text }]}>
              Photos · {selectedDate === todayStr ? "Today" : selectedDate.slice(5).replace("-", "/")}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              {selectedDayPhotos.map((uri, idx) => (
                <TouchableOpacity key={`${uri}-${idx}`} style={styles.photoThumbWrap} onPress={() => openPhotoViewer(selectedDayPhotos, idx)}>
                  <Image source={{ uri }} style={styles.photoThumb} />
                  {selectedBowel && (
                    <View style={[styles.photoThumbDot, { backgroundColor: bowelDotColor(selectedBowel.color as BowelColor) }]} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── DAILY LOG ── */}
        <View style={[styles.dailyLogCard, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
          <Text style={[styles.trendTitle, { color: colors.text }]}>
            {selectedDate === todayStr ? "Today's Log" : new Date(selectedDate + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </Text>

          {selectedBowel ? (
            <TouchableOpacity style={[styles.dailyRow, { backgroundColor: colors.sectionBg }]} onPress={() => openDaySheet(selectedDate)}>
              <View style={[styles.bowelDot, { backgroundColor: bowelDotColor(selectedBowel.color) }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.dailyLabel, { color: colors.text }]}>
                  BM — {selectedBowel.color === "green" ? "Normal" : selectedBowel.color === "yellow" ? "Moderate" : "Severe"}
                </Text>
                {(selectedBowel.count ?? 0) > 0 && (
                  <Text style={[styles.dailySub, { color: colors.textSecondary }]}>{selectedBowel.count} movement{selectedBowel.count !== 1 ? "s" : ""}</Text>
                )}
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
            <View style={[styles.dailyRow, { backgroundColor: colors.sectionBg }]}>
              <Feather name="coffee" size={16} color={colors.tint} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.dailyLabel, { color: colors.text }]}>Meals — {selectedMeals.length} logged</Text>
                <Text style={[styles.dailySub, { color: colors.textSecondary }]} numberOfLines={1}>
                  {selectedMeals.map((m) => m.foodDetails).join(" · ")}
                </Text>
              </View>
            </View>
          ) : (
            <View style={[styles.dailyRowEmpty, { borderColor: colors.border }]}>
              <Feather name="coffee" size={14} color={colors.placeholder} />
              <Text style={[styles.dailyEmptyText, { color: colors.placeholder }]}>No meals logged</Text>
            </View>
          )}

          {selectedWater > 0 ? (
            <View style={[styles.dailyRow, { backgroundColor: colors.sectionBg }]}>
              <Feather name="droplet" size={16} color="#1B8A7B" />
              <Text style={[styles.dailyLabel, { color: colors.text, marginLeft: 10 }]}>Water — {selectedWater} ml</Text>
            </View>
          ) : (
            <View style={[styles.dailyRowEmpty, { borderColor: colors.border }]}>
              <Feather name="droplet" size={14} color={colors.placeholder} />
              <Text style={[styles.dailyEmptyText, { color: colors.placeholder }]}>No water logged</Text>
            </View>
          )}

          {selectedSleep ? (
            <View style={[styles.dailyRow, { backgroundColor: colors.sectionBg }]}>
              <Feather name="moon" size={16} color="#C4881A" />
              <Text style={[styles.dailyLabel, { color: colors.text, marginLeft: 10 }]}>
                Sleep — {calcSleepHours(selectedSleep.bedtime, selectedSleep.wakeTime)}
              </Text>
            </View>
          ) : (
            <View style={[styles.dailyRowEmpty, { borderColor: colors.border }]}>
              <Feather name="moon" size={14} color={colors.placeholder} />
              <Text style={[styles.dailyEmptyText, { color: colors.placeholder }]}>No sleep logged</Text>
            </View>
          )}

          {selectedWeight ? (
            <View style={[styles.dailyRow, { backgroundColor: colors.sectionBg }]}>
              <Feather name="trending-up" size={16} color="#7C5CBF" />
              <Text style={[styles.dailyLabel, { color: colors.text, marginLeft: 10 }]}>
                Weight — {selectedWeight.toFixed(1)} kg
              </Text>
            </View>
          ) : (
            <View style={[styles.dailyRowEmpty, { borderColor: colors.border }]}>
              <Feather name="trending-up" size={14} color={colors.placeholder} />
              <Text style={[styles.dailyEmptyText, { color: colors.placeholder }]}>No weight logged</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* DAY SHEET */}
      <Modal visible={showDaySheet} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={() => setShowDaySheet(false)}>
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={[styles.bottomSheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 16 }]}>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
                  <Text style={[styles.sheetTitle, { color: colors.text }]}>
                    {new Date(sheetDate + "T12:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                  </Text>

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Bowel Movement Color</Text>
                  <View style={styles.radioRow}>
                    {([["red", "Severe"], ["yellow", "Moderate"], ["green", "Normal"]] as [BowelColor, string][]).map(([c, label]) => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.radioOption, { backgroundColor: colors.sectionBg, borderColor: bowelColor === c ? bowelDotColor(c) : "transparent", borderWidth: 2 }]}
                        onPress={() => setBowelColor(c)}
                      >
                        <View style={[styles.radioColorDot, { backgroundColor: bowelDotColor(c) }]} />
                        <Text style={[styles.radioLabel, { color: colors.text }]}>{label}</Text>
                        {bowelColor === c && <Feather name="check" size={14} color={bowelDotColor(c)} style={{ marginLeft: "auto" }} />}
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>BM Count</Text>
                  <View style={[styles.countRow, { backgroundColor: colors.sectionBg }]}>
                    <TouchableOpacity
                      style={[styles.countBtn, { backgroundColor: colors.border }]}
                      onPress={() => setBowelCount((v) => String(Math.max(0, (parseInt(v, 10) || 0) - 1)))}
                    >
                      <Feather name="minus" size={18} color={colors.text} />
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.countInput, { color: colors.text }]}
                      value={bowelCount}
                      onChangeText={(v) => setBowelCount(v.replace(/[^0-9]/g, ""))}
                      keyboardType="numeric"
                      maxLength={2}
                    />
                    <TouchableOpacity
                      style={[styles.countBtn, { backgroundColor: colors.teal }]}
                      onPress={() => setBowelCount((v) => String(Math.min(30, (parseInt(v, 10) || 0) + 1)))}
                    >
                      <Feather name="plus" size={18} color="#fff" />
                    </TouchableOpacity>
                    <Text style={[styles.countLabel, { color: colors.textSecondary }]}>bowel movements today</Text>
                  </View>

                  <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.purple, marginBottom: 16 }]} onPress={handleSaveBowelLog}>
                    <Text style={styles.saveText}>Save Log</Text>
                  </TouchableOpacity>

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Photos</Text>
                  <TouchableOpacity style={[styles.photoAddBtn, { backgroundColor: colors.sectionBg, borderColor: colors.border }]} onPress={handleAddPhoto}>
                    <Feather name="camera" size={18} color={colors.gold} />
                    <Text style={[styles.photoAddText, { color: colors.gold }]}>Add Photo</Text>
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

function LineChart({ data, color, unit, colors }: { data: { label: string; value: number; pointColor: string }[]; color: string; unit: string; colors: any }) {
  const W = 300;
  const H = 120;
  const padL = 28;
  const padR = 12;
  const padT = 12;
  const padB = 24;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const pts = data.map((d, i) => ({
    x: padL + (i / Math.max(data.length - 1, 1)) * plotW,
    y: padT + plotH - (d.value / maxVal) * plotH,
    label: d.label,
    value: d.value,
    pointColor: d.pointColor,
  }));

  const polylinePoints = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const yTicks = [0, maxVal / 2, maxVal].map((v) => ({
    y: padT + plotH - (v / maxVal) * plotH,
    label: v.toFixed(1),
  }));

  return (
    <View style={{ alignItems: "center", marginTop: 8 }}>
      <Svg width={W} height={H}>
        {yTicks.map((t, i) => (
          <React.Fragment key={i}>
            <Line x1={padL} y1={t.y} x2={W - padR} y2={t.y} stroke={colors.border ?? "#E5E5E5"} strokeWidth={0.5} strokeDasharray="3,3" />
            <SvgText x={padL - 4} y={t.y + 4} fontSize={8} fill={colors.textSecondary ?? "#888"} textAnchor="end">{parseFloat(t.label).toFixed(0)}</SvgText>
          </React.Fragment>
        ))}
        {pts.length > 1 && (
          <Polyline points={polylinePoints} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {pts.map((p, i) => (
          <React.Fragment key={i}>
            <Circle cx={p.x} cy={p.y} r={4} fill={p.value > 0 ? p.pointColor : colors.border ?? "#E5E5E5"} />
            <SvgText x={p.x} y={H - 6} fontSize={8} fill={colors.textSecondary ?? "#888"} textAnchor="middle">{p.label}</SvgText>
          </React.Fragment>
        ))}
      </Svg>
      <Text style={{ fontSize: 10, color: colors.placeholder, marginTop: 2 }}>{unit}</Text>
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
          const hasPhotos = (bowel?.photos?.length ?? 0) > 0;
          return (
            <TouchableOpacity
              key={dateStr}
              style={[styles.cell, isToday && !isSelected && { backgroundColor: colors.tealLight, borderRadius: 20 }, isSelected && { backgroundColor: colors.teal, borderRadius: 20 }]}
              onPress={() => onDayTap(dateStr)}
            >
              <Text style={[styles.dayText, { color: isSelected ? "#fff" : isToday ? colors.teal : colors.text }, isToday && { fontWeight: "700" as const }]}>
                {day}
              </Text>
              {bowel ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
              {hasPhotos && !isSelected && <View style={styles.cameraIndicator}><Feather name="camera" size={6} color={colors.placeholder} /></View>}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function WeeklyView({ todayStr, bowelMap, colors, onDayTap }: any) {
  const today = new Date(todayStr + "T12:00");
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
  });

  return (
    <View style={[styles.calCard, { backgroundColor: colors.card }]}>
      <Text style={[styles.monthLabel, { color: colors.text, marginBottom: 16 }]}>This Week</Text>
      <View style={styles.weekStrip}>
        {days.map((dateStr, i) => {
          const isToday = dateStr === todayStr;
          const bowel = bowelMap[dateStr];
          const dotColor = bowelDotColor(bowel?.color);
          const day = parseInt(dateStr.slice(-2), 10);
          return (
            <TouchableOpacity
              key={dateStr}
              style={[styles.weekDay, isToday && { backgroundColor: colors.teal, borderRadius: 12 }]}
              onPress={() => onDayTap(dateStr)}
            >
              <Text style={[styles.weekDayName, { color: isToday ? "#fff" : colors.textSecondary }]}>{WEEKDAYS[i].slice(0, 1)}</Text>
              <Text style={[styles.weekDayNum, { color: isToday ? "#fff" : colors.text }]}>{day}</Text>
              <View style={[styles.weekDot, { backgroundColor: bowel ? dotColor : "transparent" }]} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function YearlyView({ year, bowelMap, todayStr, colors, onYearChange, onDayTap }: any) {
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
                const bowel = bowelMap[dateStr];
                const dotColor = bowelDotColor(bowel?.color);
                return (
                  <TouchableOpacity key={dateStr} style={[styles.yearCell, isToday && { backgroundColor: colors.teal, borderRadius: 3 }]} onPress={() => onDayTap(dateStr)}>
                    {bowel ? <View style={[styles.yearDot, { backgroundColor: dotColor }]} /> : <Text style={[styles.yearDayText, { color: isToday ? "#fff" : colors.textSecondary }]}>{day}</Text>}
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
  cameraIndicator: { position: "absolute", bottom: 2, right: 2 },
  weekStrip: { flexDirection: "row", justifyContent: "space-between" },
  weekDay: { flex: 1, alignItems: "center", padding: 8 },
  weekDayName: { fontSize: 12, fontWeight: "500" as const, marginBottom: 4 },
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
});
