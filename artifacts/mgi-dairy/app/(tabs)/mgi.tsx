import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
  useColorScheme,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { useDateString, formatDisplayDate } from "@/hooks/useDateString";

const BRISTOL_SCALE = [
  { type: 1, label: "Type 1", desc: "Separate hard lumps, like nuts" },
  { type: 2, label: "Type 2", desc: "Sausage-shaped, lumpy" },
  { type: 3, label: "Type 3", desc: "Like a sausage with cracks" },
  { type: 4, label: "Type 4", desc: "Like a sausage, smooth" },
  { type: 5, label: "Type 5", desc: "Soft blobs with clear edges" },
  { type: 6, label: "Type 6", desc: "Fluffy pieces, mushy edges" },
  { type: 7, label: "Type 7", desc: "Entirely liquid, watery" },
];

export default function MGIScreen() {
  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const today = useDateString();

  const { symptomLogs, addSymptomLog, updateSymptomLog, triggers } = useApp();

  const todayLog = symptomLogs.find((s) => s.date === today);
  const [showModal, setShowModal] = useState(false);

  const [pain, setPain] = useState(todayLog?.pain ?? 0);
  const [urgency, setUrgency] = useState(todayLog?.urgency ?? 0);
  const [bloating, setBloating] = useState(todayLog?.bloating ?? 0);
  const [fatigue, setFatigue] = useState(todayLog?.fatigue ?? 0);
  const [stoolType, setStoolType] = useState(todayLog?.stoolType ?? 4);

  const openModal = () => {
    if (todayLog) {
      setPain(todayLog.pain);
      setUrgency(todayLog.urgency);
      setBloating(todayLog.bloating);
      setFatigue(todayLog.fatigue);
      setStoolType(todayLog.stoolType);
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    const data = { date: today, pain, urgency, bloating, fatigue, stoolType, notes: "" };
    if (todayLog) {
      await updateSymptomLog(todayLog.id, data);
    } else {
      await addSymptomLog(data);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowModal(false);
  };

  const mgiScore = useMemo(() => {
    if (!todayLog) return null;
    const avg = (todayLog.pain + todayLog.urgency + todayLog.bloating + todayLog.fatigue) / 4;
    return Math.round(avg * 10) / 10;
  }, [todayLog]);

  const recentTriggers = triggers.slice(-5).reverse();

  const topPad = Platform.OS === "web" ? 67 + insets.top : 0;
  const tabBarHeight = Platform.OS === "web" ? 84 : 83;
  const bottomPad = insets.bottom + tabBarHeight + 16;

  const scoreColor = mgiScore === null ? colors.placeholder : mgiScore >= 7 ? colors.destructive : mgiScore >= 4 ? colors.warning : colors.success;
  const scoreLabel = mgiScore === null ? "Not logged" : mgiScore >= 7 ? "High Activity" : mgiScore >= 4 ? "Moderate" : "Low Activity";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: topPad + 16 }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>MGI Score</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {/* Today's MGI Score */}
        <TouchableOpacity
          style={[styles.scoreCard, { backgroundColor: colors.card }]}
          onPress={openModal}
        >
          <Text style={[styles.scoreCardLabel, { color: colors.textSecondary }]}>{formatDisplayDate(today)}</Text>
          <View style={styles.scoreCircle}>
            <Text style={[styles.scoreNumber, { color: scoreColor }]}>{mgiScore ?? "–"}</Text>
            <Text style={[styles.scoreOutOf, { color: colors.textSecondary }]}>/10</Text>
          </View>
          <Text style={[styles.scoreLabel, { color: scoreColor }]}>{scoreLabel}</Text>
          <TouchableOpacity style={[styles.logBtn, { backgroundColor: colors.tint }]} onPress={openModal}>
            <Text style={styles.logBtnText}>{todayLog ? "Update Today" : "Log Today"}</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Today's Breakdown */}
        {todayLog && (
          <View style={[styles.breakdownCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Today's Breakdown</Text>
            <MetricRow label="Abdominal Pain" value={todayLog.pain} colors={colors} />
            <MetricRow label="Urgency" value={todayLog.urgency} colors={colors} />
            <MetricRow label="Bloating" value={todayLog.bloating} colors={colors} />
            <MetricRow label="Fatigue" value={todayLog.fatigue} colors={colors} />
            <View style={styles.bristolRow}>
              <Text style={[styles.bristolLabel, { color: colors.textSecondary }]}>Bristol Stool Type</Text>
              <View style={[styles.bristolBadge, { backgroundColor: colors.sectionBg }]}>
                <Text style={[styles.bristolType, { color: colors.tint }]}>Type {todayLog.stoolType}</Text>
              </View>
            </View>
          </View>
        )}

        {/* 7-day history */}
        {symptomLogs.length > 0 && (
          <View style={[styles.historyCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent History</Text>
            <View style={styles.historyChart}>
              {[...symptomLogs]
                .sort((a, b) => a.date.localeCompare(b.date))
                .slice(-7)
                .map((log) => {
                  const avg = (log.pain + log.urgency + log.bloating + log.fatigue) / 4;
                  const pct = (avg / 10) * 100;
                  const barColor = avg >= 7 ? colors.destructive : avg >= 4 ? colors.warning : colors.success;
                  return (
                    <View key={log.id} style={styles.barContainer}>
                      <View style={[styles.barTrack, { backgroundColor: colors.progressTrack }]}>
                        <View style={[styles.barFill, { height: `${pct}%` as any, backgroundColor: barColor }]} />
                      </View>
                      <Text style={[styles.barDate, { color: colors.textSecondary }]}>
                        {log.date.slice(8)}
                      </Text>
                    </View>
                  );
                })}
            </View>
          </View>
        )}

        {/* IBD Info */}
        <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
          <View style={styles.infoHeader}>
            <Feather name="info" size={16} color={colors.tint} />
            <Text style={[styles.infoTitle, { color: colors.text }]}>About MGI Score</Text>
          </View>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            The Modified Global Index (MGI) is a composite symptom severity score for IBD patients.
            It combines pain, urgency, bloating, and fatigue to track disease activity over time.
          </Text>
          <View style={styles.infoLegend}>
            <LegendItem color={colors.success} label="0–3: Remission" />
            <LegendItem color={colors.warning} label="4–6: Mild-Moderate" />
            <LegendItem color={colors.destructive} label="7–10: High Activity" />
          </View>
        </View>

        {/* Recent triggers */}
        {recentTriggers.length > 0 && (
          <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Triggers</Text>
            {recentTriggers.map((t) => (
              <View key={t.id} style={[styles.triggerRow, { borderBottomColor: colors.borderLight }]}>
                <View style={[styles.catDot, { backgroundColor: colors.tint }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.triggerCat, { color: colors.tint }]}>{t.category}</Text>
                  <Text style={[styles.triggerDesc, { color: colors.text }]} numberOfLines={1}>{t.description}</Text>
                </View>
                <Text style={[styles.triggerSev, { color: t.severity >= 7 ? colors.destructive : t.severity >= 4 ? colors.warning : colors.success }]}>
                  {t.severity}/10
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Log Symptoms Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.bottomSheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 16 }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Log Symptoms</Text>

              <SliderField label="Abdominal Pain" value={pain} onChange={setPain} colors={colors} />
              <SliderField label="Urgency" value={urgency} onChange={setUrgency} colors={colors} />
              <SliderField label="Bloating" value={bloating} onChange={setBloating} colors={colors} />
              <SliderField label="Fatigue" value={fatigue} onChange={setFatigue} colors={colors} />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Bristol Stool Scale</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {BRISTOL_SCALE.map((item) => (
                  <TouchableOpacity
                    key={item.type}
                    style={[
                      styles.bristolOption,
                      { backgroundColor: stoolType === item.type ? colors.tint : colors.sectionBg },
                    ]}
                    onPress={() => setStoolType(item.type)}
                  >
                    <Text style={[styles.bristolOptionType, { color: stoolType === item.type ? "#fff" : colors.text }]}>
                      {item.label}
                    </Text>
                    <Text style={[styles.bristolOptionDesc, { color: stoolType === item.type ? "rgba(255,255,255,0.8)" : colors.textSecondary }]} numberOfLines={2}>
                      {item.desc}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { backgroundColor: colors.sectionBg }]}
                  onPress={() => setShowModal(false)}
                >
                  <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.tint }]} onPress={handleSave}>
                  <Text style={styles.saveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SliderField({ label, value, onChange, colors }: { label: string; value: number; onChange: (v: number) => void; colors: typeof Colors.light }) {
  const barColor = value >= 7 ? colors.destructive : value >= 4 ? colors.warning : colors.success;
  return (
    <View style={styles.sliderField}>
      <View style={styles.sliderHeader}>
        <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 0 }]}>{label}</Text>
        <Text style={[styles.sliderValue, { color: barColor }]}>{value}/10</Text>
      </View>
      <View style={styles.sliderDots}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.sliderDot, { backgroundColor: n <= value ? barColor : colors.borderLight }]}
            onPress={() => onChange(n)}
          />
        ))}
      </View>
    </View>
  );
}

function MetricRow({ label, value, colors }: { label: string; value: number; colors: typeof Colors.light }) {
  const barColor = value >= 7 ? colors.destructive : value >= 4 ? colors.warning : colors.success;
  return (
    <View style={styles.metricRow}>
      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={[styles.metricTrack, { backgroundColor: colors.progressTrack }]}>
        <View style={[styles.metricFill, { width: `${value * 10}%` as any, backgroundColor: barColor }]} />
      </View>
      <Text style={[styles.metricValue, { color: barColor }]}>{value}</Text>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={{ fontSize: 13, color: "#6B7280" }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: "700" as const },
  scoreCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "rgba(0,0,0,0.06)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  scoreCardLabel: { fontSize: 14, marginBottom: 16 },
  scoreCircle: { flexDirection: "row", alignItems: "flex-end", marginBottom: 8 },
  scoreNumber: { fontSize: 72, fontWeight: "700" as const, lineHeight: 80 },
  scoreOutOf: { fontSize: 22, marginBottom: 12 },
  scoreLabel: { fontSize: 16, fontWeight: "600" as const, marginBottom: 20 },
  logBtn: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24 },
  logBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" as const },
  breakdownCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "rgba(0,0,0,0.05)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: { fontSize: 16, fontWeight: "600" as const, marginBottom: 14 },
  metricRow: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 10 },
  metricLabel: { width: 120, fontSize: 13 },
  metricTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  metricFill: { height: 6, borderRadius: 3 },
  metricValue: { width: 20, textAlign: "right", fontSize: 13, fontWeight: "600" as const },
  bristolRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  bristolLabel: { fontSize: 13 },
  bristolBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  bristolType: { fontSize: 13, fontWeight: "600" as const },
  historyCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "rgba(0,0,0,0.05)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
  },
  historyChart: { flexDirection: "row", alignItems: "flex-end", height: 80, gap: 6 },
  barContainer: { flex: 1, alignItems: "center" },
  barTrack: { flex: 1, width: "100%", borderRadius: 4, overflow: "hidden", justifyContent: "flex-end" },
  barFill: { width: "100%", borderRadius: 4 },
  barDate: { fontSize: 10, marginTop: 4 },
  infoCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "rgba(0,0,0,0.05)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
  },
  infoHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  infoTitle: { fontSize: 16, fontWeight: "600" as const },
  infoText: { fontSize: 13, lineHeight: 20, marginBottom: 12 },
  infoLegend: { gap: 6 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  triggerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    gap: 10,
  },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  triggerCat: { fontSize: 11, fontWeight: "600" as const },
  triggerDesc: { fontSize: 13 },
  triggerSev: { fontSize: 13, fontWeight: "600" as const },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  bottomSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "90%" },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: "700" as const, marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: "600" as const, marginBottom: 8 },
  sliderField: { marginBottom: 16 },
  sliderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  sliderValue: { fontSize: 14, fontWeight: "600" as const },
  sliderDots: { flexDirection: "row", gap: 4 },
  sliderDot: { flex: 1, height: 8, borderRadius: 4 },
  bristolOption: { width: 120, marginRight: 10, padding: 12, borderRadius: 12 },
  bristolOptionType: { fontSize: 13, fontWeight: "600" as const, marginBottom: 4 },
  bristolOptionDesc: { fontSize: 11, lineHeight: 16 },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: "center" },
  cancelText: { fontSize: 15, fontWeight: "600" as const },
  saveBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: "center" },
  saveText: { color: "#fff", fontSize: 15, fontWeight: "600" as const },
});
