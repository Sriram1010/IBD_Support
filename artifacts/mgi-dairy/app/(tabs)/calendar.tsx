import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  useColorScheme,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { formatDisplayDate, calcSleepHours } from "@/hooks/useDateString";

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return { firstDay, daysInMonth };
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function CalendarScreen() {
  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const { meals, waterEntries, sleepLogs, symptomLogs } = useApp();

  const datesWithData = useMemo(() => {
    const set = new Set<string>();
    meals.forEach((m) => set.add(m.date));
    waterEntries.forEach((w) => set.add(w.date));
    sleepLogs.forEach((s) => set.add(s.date));
    symptomLogs.forEach((s) => set.add(s.date));
    return set;
  }, [meals, waterEntries, sleepLogs, symptomLogs]);

  const { firstDay, daysInMonth } = getMonthDays(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const selectedMeals = meals.filter((m) => m.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time));
  const selectedWater = waterEntries.filter((w) => w.date === selectedDate).reduce((s, w) => s + w.amountMl, 0);
  const selectedSleep = sleepLogs.find((s) => s.date === selectedDate);
  const selectedSymptoms = symptomLogs.find((s) => s.date === selectedDate);

  const topPad = Platform.OS === "web" ? 67 + insets.top : 0;
  const tabBarHeight = Platform.OS === "web" ? 84 : 83;
  const bottomPad = insets.bottom + tabBarHeight + 16;

  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: topPad + 16 }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Calendar</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        {/* Month navigator */}
        <View style={[styles.calCard, { backgroundColor: colors.card }]}>
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
              <Feather name="chevron-left" size={22} color={colors.tint} />
            </TouchableOpacity>
            <Text style={[styles.monthLabel, { color: colors.text }]}>
              {MONTHS[viewMonth]} {viewYear}
            </Text>
            <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
              <Feather name="chevron-right" size={22} color={colors.tint} />
            </TouchableOpacity>
          </View>

          {/* Weekday headers */}
          <View style={styles.weekdaysRow}>
            {WEEKDAYS.map((d) => (
              <Text key={d} style={[styles.weekday, { color: colors.textSecondary }]}>{d}</Text>
            ))}
          </View>

          {/* Day cells */}
          <View style={styles.grid}>
            {cells.map((day, idx) => {
              if (day === null) return <View key={`empty-${idx}`} style={styles.cell} />;
              const dateStr = toDateStr(viewYear, viewMonth, day);
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === todayStr;
              const hasData = datesWithData.has(dateStr);
              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[
                    styles.cell,
                    isSelected && { backgroundColor: colors.tint, borderRadius: 20 },
                  ]}
                  onPress={() => setSelectedDate(dateStr)}
                >
                  <Text
                    style={[
                      styles.dayText,
                      { color: isSelected ? "#fff" : isToday ? colors.tint : colors.text },
                      isToday && !isSelected && { fontWeight: "700" as const },
                    ]}
                  >
                    {day}
                  </Text>
                  {hasData && !isSelected && (
                    <View style={[styles.dot, { backgroundColor: colors.tint }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Selected day summary */}
        <View style={styles.summaryContainer}>
          <Text style={[styles.summaryDate, { color: colors.text }]}>{formatDisplayDate(selectedDate)}</Text>

          {selectedMeals.length > 0 && (
            <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
              <View style={styles.summaryHeader}>
                <Feather name="coffee" size={16} color={colors.tint} />
                <Text style={[styles.summaryTitle, { color: colors.text }]}>Meals ({selectedMeals.length})</Text>
              </View>
              {selectedMeals.map((m) => (
                <View key={m.id} style={styles.summaryRow}>
                  <Text style={[styles.summaryTime, { color: colors.textSecondary }]}>{m.time}</Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]} numberOfLines={1}>{m.foodDetails}</Text>
                </View>
              ))}
            </View>
          )}

          {selectedWater > 0 && (
            <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
              <View style={styles.summaryHeader}>
                <Feather name="droplet" size={16} color={colors.tint} />
                <Text style={[styles.summaryTitle, { color: colors.text }]}>Water</Text>
              </View>
              <Text style={[styles.summaryBig, { color: colors.tint }]}>{selectedWater} ml</Text>
            </View>
          )}

          {selectedSleep && (
            <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
              <View style={styles.summaryHeader}>
                <Feather name="moon" size={16} color={colors.tint} />
                <Text style={[styles.summaryTitle, { color: colors.text }]}>Sleep</Text>
              </View>
              <Text style={[styles.summaryBig, { color: colors.tint }]}>
                {calcSleepHours(selectedSleep.bedtime, selectedSleep.wakeTime)}
              </Text>
              <Text style={[styles.summarySubtext, { color: colors.textSecondary }]}>
                {selectedSleep.bedtime} → {selectedSleep.wakeTime}
              </Text>
            </View>
          )}

          {selectedSymptoms && (
            <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
              <View style={styles.summaryHeader}>
                <Feather name="activity" size={16} color={colors.tint} />
                <Text style={[styles.summaryTitle, { color: colors.text }]}>Symptoms</Text>
              </View>
              <View style={styles.sympRow}>
                <SympBadge label="Pain" value={selectedSymptoms.pain} colors={colors} />
                <SympBadge label="Urgency" value={selectedSymptoms.urgency} colors={colors} />
                <SympBadge label="Bloating" value={selectedSymptoms.bloating} colors={colors} />
                <SympBadge label="Fatigue" value={selectedSymptoms.fatigue} colors={colors} />
              </View>
            </View>
          )}

          {selectedMeals.length === 0 && selectedWater === 0 && !selectedSleep && !selectedSymptoms && (
            <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
              <View style={styles.emptyDay}>
                <Feather name="calendar" size={28} color={colors.placeholder} />
                <Text style={[styles.emptyDayText, { color: colors.placeholder }]}>No data for this day</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function SympBadge({ label, value, colors }: { label: string; value: number; colors: typeof Colors.light }) {
  const intensity = value >= 7 ? colors.destructive : value >= 4 ? colors.warning : colors.success;
  return (
    <View style={styles.sympBadge}>
      <Text style={[styles.sympValue, { color: intensity }]}>{value}</Text>
      <Text style={[styles.sympLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: "700" as const },
  calCard: {
    margin: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: "rgba(0,0,0,0.06)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  navBtn: { padding: 8 },
  monthLabel: { fontSize: 18, fontWeight: "600" as const },
  weekdaysRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekday: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "500" as const,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: { fontSize: 14 },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  summaryContainer: { paddingHorizontal: 16, paddingBottom: 16 },
  summaryDate: { fontSize: 16, fontWeight: "600" as const, marginBottom: 12 },
  summaryCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: "rgba(0,0,0,0.04)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  summaryTitle: { fontSize: 14, fontWeight: "600" as const },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 4,
  },
  summaryTime: { fontSize: 13, width: 50 },
  summaryValue: { fontSize: 13, flex: 1 },
  summaryBig: { fontSize: 24, fontWeight: "700" as const },
  summarySubtext: { fontSize: 13, marginTop: 2 },
  sympRow: { flexDirection: "row", justifyContent: "space-between" },
  sympBadge: { alignItems: "center" },
  sympValue: { fontSize: 20, fontWeight: "700" as const },
  sympLabel: { fontSize: 11 },
  emptyDay: { alignItems: "center", paddingVertical: 24, gap: 8 },
  emptyDayText: { fontSize: 14 },
});
