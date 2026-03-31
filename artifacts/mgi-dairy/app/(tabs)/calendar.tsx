import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Image, Alert, Platform, useColorScheme,
  KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, TextInput,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useApp, BowelLog } from "@/context/AppContext";
import { calcSleepHours } from "@/hooks/useDateString";

type ViewMode = "monthly" | "weekly" | "yearly";
type BowelColor = "red" | "yellow" | "green";

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
  if (color === "yellow") return "#F59E0B";
  if (color === "green") return "#10B981";
  return "transparent";
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

  const {
    meals, waterEntries, sleepLogs, bowelLogs,
    saveBowelLog, deleteBowelPhoto, getBowelLog,
  } = useApp();

  const bowelMap = useMemo(() => {
    const map: Record<string, BowelLog> = {};
    bowelLogs.forEach((b) => { map[b.date] = b; });
    return map;
  }, [bowelLogs]);

  const openDaySheet = (date: string) => {
    setSheetDate(date);
    const existing = bowelMap[date];
    setBowelColor(existing?.color ?? "green");
    setBowelCount(String(existing?.count ?? 0));
    setShowDaySheet(true);
  };

  const handleDayTap = (date: string) => {
    setSelectedDate(date);
    openDaySheet(date);
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
  const tabBarHeight = Platform.OS === "web" ? 84 : 64;
  const bottomPad = insets.bottom + tabBarHeight + 16;

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); } else setViewMonth((m) => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); } else setViewMonth((m) => m + 1); };

  const sheetLog = bowelMap[sheetDate];
  const sheetPhotos = sheetLog?.photos ?? [];

  const selectedMeals = meals.filter((m) => m.date === selectedDate);
  const selectedWater = waterEntries.filter((w) => w.date === selectedDate).reduce((s, w) => s + w.amountMl, 0);
  const selectedSleep = sleepLogs.find((s) => s.date === selectedDate);

  // Recent photos from all bowel logs for the current month
  const monthPhotos = bowelLogs
    .filter((b) => b.date.startsWith(`${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`))
    .flatMap((b) => b.photos.map((uri) => ({ uri, date: b.date, color: b.color })))
    .slice(0, 10);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: topPad + 16 }]}>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Calendar</Text>
      </View>

      {/* View mode tabs */}
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

        {/* Photo thumbnails below calendar (current month) */}
        {viewMode === "monthly" && monthPhotos.length > 0 && (
          <View style={styles.photoStrip}>
            <Text style={[styles.photoStripTitle, { color: colors.textSecondary }]}>Photos this month</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {monthPhotos.map((p, idx) => (
                <TouchableOpacity key={`${p.uri}-${idx}`} style={styles.photoThumbWrap} onPress={() => openPhotoViewer(monthPhotos.map((x) => x.uri), idx)}>
                  <Image source={{ uri: p.uri }} style={styles.photoThumb} />
                  <View style={[styles.photoThumbDot, { backgroundColor: bowelDotColor(p.color as BowelColor) }]} />
                  <Text style={[styles.photoThumbDate, { color: colors.placeholder }]}>{p.date.slice(5).replace("-", "/")}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Selected day summary */}
        {viewMode === "monthly" && (
          <View style={styles.summaryContainer}>
            <Text style={[styles.summaryDate, { color: colors.text }]}>
              {new Date(selectedDate + "T12:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </Text>
            {bowelMap[selectedDate] && (
              <TouchableOpacity style={[styles.summaryCard, { backgroundColor: colors.card }]} onPress={() => handleDayTap(selectedDate)}>
                <View style={[styles.bowelDot, { backgroundColor: bowelDotColor(bowelMap[selectedDate].color) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.summaryTitle, { color: colors.text }]}>
                    {bowelMap[selectedDate].color === "green" ? "Stool - Normal" : bowelMap[selectedDate].color === "yellow" ? "Stool - Moderate" : "Stool - Severe"}
                  </Text>
                  {(bowelMap[selectedDate].count ?? 0) > 0 && (
                    <Text style={[styles.summarySubtitle, { color: colors.textSecondary }]}>
                      {bowelMap[selectedDate].count} movement{bowelMap[selectedDate].count !== 1 ? "s" : ""}
                    </Text>
                  )}
                </View>
                {bowelMap[selectedDate].photos.length > 0 && (
                  <View style={styles.thumbRow}>
                    {bowelMap[selectedDate].photos.slice(0, 3).map((uri, i) => (
                      <Image key={i} source={{ uri }} style={styles.summaryThumb} />
                    ))}
                  </View>
                )}
                <Feather name="chevron-right" size={16} color={colors.placeholder} />
              </TouchableOpacity>
            )}
            {selectedMeals.length > 0 && (
              <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
                <Feather name="coffee" size={16} color={colors.tint} />
                <Text style={[styles.summaryTitle, { color: colors.text, marginLeft: 6 }]}>Meals: {selectedMeals.length}</Text>
              </View>
            )}
            {selectedWater > 0 && (
              <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
                <Feather name="droplet" size={16} color={colors.teal} />
                <Text style={[styles.summaryTitle, { color: colors.text, marginLeft: 6 }]}>Water: {selectedWater} ml</Text>
              </View>
            )}
            {selectedSleep && (
              <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
                <Feather name="moon" size={16} color={colors.gold} />
                <Text style={[styles.summaryTitle, { color: colors.text, marginLeft: 6 }]}>
                  Sleep: {calcSleepHours(selectedSleep.bedtime, selectedSleep.wakeTime)}
                </Text>
              </View>
            )}
          </View>
        )}
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

                  {/* Bowel Color */}
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

                  {/* Bowel Count */}
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>Bowel Movement Count</Text>
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
                      selectTextOnFocus
                    />
                    <TouchableOpacity
                      style={[styles.countBtn, { backgroundColor: colors.teal }]}
                      onPress={() => setBowelCount((v) => String(Math.min(30, (parseInt(v, 10) || 0) + 1)))}
                    >
                      <Feather name="plus" size={18} color="#fff" />
                    </TouchableOpacity>
                    <Text style={[styles.countLabel, { color: colors.textSecondary }]}>movements today</Text>
                  </View>

                  <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.purple, marginBottom: 16 }]} onPress={handleSaveBowelLog}>
                    <Text style={styles.saveText}>Save Log</Text>
                  </TouchableOpacity>

                  {/* Photos */}
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
  photoStrip: { marginHorizontal: 16, marginBottom: 8 },
  photoStripTitle: { fontSize: 12, fontWeight: "600" as const, marginBottom: 8 },
  photoThumbWrap: { marginRight: 10, alignItems: "center" },
  photoThumb: { width: 60, height: 60, borderRadius: 10 },
  photoThumbDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  photoThumbDate: { fontSize: 10, marginTop: 2 },
  summaryContainer: { paddingHorizontal: 16 },
  summaryDate: { fontSize: 15, fontWeight: "600" as const, marginBottom: 10 },
  summaryCard: { flexDirection: "row", alignItems: "center", borderRadius: 12, padding: 12, marginBottom: 8 },
  summaryTitle: { fontSize: 14, fontWeight: "500" as const },
  summarySubtitle: { fontSize: 12, marginTop: 1 },
  thumbRow: { flexDirection: "row", gap: 4, marginRight: 8 },
  summaryThumb: { width: 32, height: 32, borderRadius: 6 },
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
