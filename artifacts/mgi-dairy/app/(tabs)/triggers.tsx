import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
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

const CATEGORIES = ["Food", "Stress", "Medication", "Activity", "Environment", "Sleep", "Other"];

const COMMON_SYMPTOMS = [
  "Abdominal pain", "Cramping", "Diarrhea", "Constipation",
  "Bloating", "Nausea", "Fatigue", "Blood in stool",
  "Urgency", "Vomiting", "Loss of appetite", "Joint pain",
];

export default function TriggersScreen() {
  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const today = useDateString();

  const { triggers, addTrigger, deleteTrigger } = useApp();

  const [showModal, setShowModal] = useState(false);
  const [category, setCategory] = useState("Food");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState(5);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const filtered = filterCategory
    ? triggers.filter((t) => t.category === filterCategory)
    : triggers;
  const sortedTriggers = [...filtered].sort((a, b) => b.date.localeCompare(a.date));

  const handleSave = async () => {
    if (!description.trim()) {
      Alert.alert("Required", "Please describe the trigger.");
      return;
    }
    await addTrigger({
      date: today,
      category,
      description: description.trim(),
      severity,
      symptoms: selectedSymptoms,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowModal(false);
    setDescription("");
    setSeverity(5);
    setSelectedSymptoms([]);
    setCategory("Food");
  };

  const toggleSymptom = (s: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const topPad = Platform.OS === "web" ? 67 + insets.top : 0;
  const tabBarHeight = Platform.OS === "web" ? 84 : 83;
  const bottomPad = insets.bottom + tabBarHeight + 16;

  const severityColor = severity >= 7 ? colors.destructive : severity >= 4 ? colors.warning : colors.success;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: topPad + 16 }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Triggers</Text>
        <TouchableOpacity
          style={[styles.headerAddBtn, { backgroundColor: colors.tint }]}
          onPress={() => setShowModal(true)}
        >
          <Feather name="plus" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <TouchableOpacity
          style={[
            styles.filterChip,
            { backgroundColor: !filterCategory ? colors.tint : colors.sectionBg },
          ]}
          onPress={() => setFilterCategory(null)}
        >
          <Text style={[styles.filterChipText, { color: !filterCategory ? "#fff" : colors.text }]}>All</Text>
        </TouchableOpacity>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.filterChip,
              { backgroundColor: filterCategory === cat ? colors.tint : colors.sectionBg },
            ]}
            onPress={() => setFilterCategory(filterCategory === cat ? null : cat)}
          >
            <Text style={[styles.filterChipText, { color: filterCategory === cat ? "#fff" : colors.text }]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {sortedTriggers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="alert-triangle" size={48} color={colors.placeholder} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No triggers logged</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Track what triggers your IBD symptoms to find patterns.
            </Text>
          </View>
        ) : (
          sortedTriggers.map((trigger) => (
            <TouchableOpacity
              key={trigger.id}
              style={[styles.triggerCard, { backgroundColor: colors.card }]}
              onLongPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                Alert.alert("Delete trigger?", trigger.description, [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => deleteTrigger(trigger.id) },
                ]);
              }}
            >
              <View style={styles.triggerTop}>
                <View style={[styles.categoryBadge, { backgroundColor: colors.sectionBg }]}>
                  <Text style={[styles.categoryText, { color: colors.tint }]}>{trigger.category}</Text>
                </View>
                <View style={styles.triggerMeta}>
                  <Text style={[styles.triggerDate, { color: colors.textSecondary }]}>{formatDisplayDate(trigger.date)}</Text>
                  <View style={[styles.severityBadge, { backgroundColor: getSeverityBg(trigger.severity) }]}>
                    <Text style={styles.severityText}>{trigger.severity}/10</Text>
                  </View>
                </View>
              </View>
              <Text style={[styles.triggerDesc, { color: colors.text }]}>{trigger.description}</Text>
              {trigger.symptoms.length > 0 && (
                <View style={styles.symptomsRow}>
                  {trigger.symptoms.map((s) => (
                    <View key={s} style={[styles.symptomChip, { backgroundColor: colors.borderLight }]}>
                      <Text style={[styles.symptomChipText, { color: colors.textSecondary }]}>{s}</Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.bottomSheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 16 }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Log a Trigger</Text>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.catChip,
                      { backgroundColor: category === cat ? colors.tint : colors.sectionBg },
                    ]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.catChipText, { color: category === cat ? "#fff" : colors.text }]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Description</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: colors.inputBg, color: colors.text }]}
                value={description}
                onChangeText={setDescription}
                placeholder="What triggered your symptoms?"
                placeholderTextColor={colors.placeholder}
                multiline
                numberOfLines={3}
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                Severity: <Text style={{ color: severityColor, fontWeight: "700" as const }}>{severity}/10</Text>
              </Text>
              <View style={styles.severityRow}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[
                      styles.severityDot,
                      { backgroundColor: n <= severity ? severityColor : colors.borderLight },
                    ]}
                    onPress={() => setSeverity(n)}
                  />
                ))}
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Associated Symptoms</Text>
              <View style={styles.sympGrid}>
                {COMMON_SYMPTOMS.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.sympChipBtn,
                      {
                        backgroundColor: selectedSymptoms.includes(s) ? colors.tint : colors.sectionBg,
                      },
                    ]}
                    onPress={() => toggleSymptom(s)}
                  >
                    <Text style={[styles.sympChipText, { color: selectedSymptoms.includes(s) ? "#fff" : colors.text }]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

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

function getSeverityBg(severity: number): string {
  if (severity >= 7) return "#FEE2E2";
  if (severity >= 4) return "#FEF3C7";
  return "#D1FAE5";
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 28, fontWeight: "700" as const },
  headerAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  filterChipText: { fontSize: 13, fontWeight: "500" as const },
  emptyContainer: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "600" as const },
  emptySubtext: { fontSize: 14, textAlign: "center", paddingHorizontal: 40 },
  triggerCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: "rgba(0,0,0,0.05)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
  },
  triggerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  categoryBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  categoryText: { fontSize: 12, fontWeight: "600" as const },
  triggerMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  triggerDate: { fontSize: 12 },
  severityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  severityText: { fontSize: 12, fontWeight: "600" as const, color: "#374151" },
  triggerDesc: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  symptomsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  symptomChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  symptomChipText: { fontSize: 11 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  bottomSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "85%" },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: "700" as const, marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: "600" as const, marginBottom: 8 },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  catChipText: { fontSize: 13 },
  textArea: { borderRadius: 10, padding: 12, fontSize: 14, minHeight: 80, textAlignVertical: "top", marginBottom: 16 },
  severityRow: { flexDirection: "row", gap: 6, marginBottom: 16 },
  severityDot: { flex: 1, height: 10, borderRadius: 5 },
  sympGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  sympChipBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  sympChipText: { fontSize: 13 },
  modalButtons: { flexDirection: "row", gap: 12 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: "center" },
  cancelText: { fontSize: 15, fontWeight: "600" as const },
  saveBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: "center" },
  saveText: { color: "#fff", fontSize: 15, fontWeight: "600" as const },
});
