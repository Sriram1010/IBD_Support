import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, Platform, useColorScheme,
  KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AutoHideScrollView } from "@/components/AutoHideScrollView";
import { ProfileSettingsButton } from "@/components/ProfileSettingsButton";

import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { SimpleTimeInput, parse24h } from "@/components/WheelPicker";

const DAYS = [
  { key: "Mon", label: "M" },
  { key: "Tue", label: "T" },
  { key: "Wed", label: "W" },
  { key: "Thu", label: "T" },
  { key: "Fri", label: "F" },
  { key: "Sat", label: "S" },
  { key: "Sun", label: "S" },
];
const ALL_DAYS = DAYS.map((d) => d.key);

function fmt12(time: string): string {
  if (!time) return "";
  const { h12, min, ampm } = parse24h(time);
  return `${h12}:${String(min).padStart(2, "0")} ${ampm}`;
}

export default function MedsScreen() {
  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const { medications, addMedication, updateMedication, deleteMedication } = useApp();

  const [showSheet, setShowSheet] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [reminderTime, setReminderTime] = useState("08:00");
  const [reminderDays, setReminderDays] = useState<string[]>(ALL_DAYS);

  const sorted = [...medications].sort((a, b) => a.name.localeCompare(b.name));

  const openAdd = () => {
    setEditId(null); setName(""); setNotes(""); setReminderTime("08:00"); setReminderDays(ALL_DAYS);
    setShowSheet(true);
  };

  const openEdit = (m: typeof medications[0]) => {
    setEditId(m.id); setName(m.name); setNotes(m.notes);
    setReminderTime(m.reminderTime || "08:00");
    setReminderDays(m.reminderDays ?? ALL_DAYS);
    setShowSheet(true);
  };

  const toggleDay = (day: string) => {
    setReminderDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert("Required", "Please enter the medication name."); return; }
    const payload: any = { name: name.trim(), notes: notes.trim(), reminderTime, reminderDays };
    if (editId) {
      await updateMedication(editId, payload);
    } else {
      await addMedication({ ...payload, createdAt: new Date().toISOString() });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Saved", `Reminder set for ${fmt12(reminderTime)}.\n\nEnable notifications in device settings to receive alerts.`);
    setShowSheet(false);
  };

  const handleDelete = (id: string, medName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Delete medication?", medName, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMedication(id) },
    ]);
  };

  const topPad = Platform.OS === "web" ? 67 + insets.top : insets.top;
  const tabBarHeight = Platform.OS === "web" ? 60 : 50;
  const bottomPad = insets.bottom + tabBarHeight + 16;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: topPad + 10 }]}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.headerText }]}>Medications</Text>
            <Text style={[styles.headerSub, { color: colors.headerTextSecondary }]}>Daily meds & supplements</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={[styles.headerAddBtn, { backgroundColor: colors.gold }]} onPress={openAdd}>
              <Feather name="plus" size={18} color={colors.onGold} />
            </TouchableOpacity>
            <ProfileSettingsButton color={colors.headerText} />
          </View>
        </View>

        <View style={[styles.banner, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <Feather name="package" size={15} color={colors.goldText} />
          <Text style={[styles.bannerText, { color: colors.textSecondary }]}>{sorted.length} medication{sorted.length !== 1 ? "s" : ""} tracked</Text>
        </View>

        <AutoHideScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }} keyboardShouldPersistTaps="handled">
          {sorted.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="package" size={48} color={colors.placeholder} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No medications added</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Add your daily medications and supplements with reminders.</Text>
              <TouchableOpacity style={[styles.emptyAddBtn, { backgroundColor: colors.gold }]} onPress={openAdd}>
                <Feather name="plus" size={16} color={colors.onGold} />
                <Text style={[styles.emptyAddText, { color: colors.onGold }]}>Add First Medication</Text>
              </TouchableOpacity>
            </View>
          ) : (
            sorted.map((med) => {
              const days: string[] = med.reminderDays ?? ALL_DAYS;
              const isAllDays = days.length === 7;
              return (
                <TouchableOpacity key={med.id} style={[styles.medCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => openEdit(med)} onLongPress={() => handleDelete(med.id, med.name)}>
                  <View style={[styles.medIcon, { backgroundColor: colors.sectionBg }]}>
                    <Feather name="package" size={20} color={colors.goldText} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.medName, { color: colors.text }]}>{med.name}</Text>
                    {med.notes ? <Text style={[styles.medNotes, { color: colors.textSecondary }]} numberOfLines={1}>{med.notes}</Text> : null}
                    <View style={styles.dayChipsRow}>
                      {isAllDays ? (
                        <View style={[styles.dayChip, { backgroundColor: colors.sectionBg }]}>
                          <Text style={[styles.dayChipText, { color: colors.goldText }]}>Daily</Text>
                        </View>
                      ) : (
                        DAYS.map((d) => (
                          <View key={d.key} style={[styles.dayChip, days.includes(d.key) ? { backgroundColor: colors.gold } : { backgroundColor: colors.sectionBg }]}>
                          <Text style={[styles.dayChipText, { color: days.includes(d.key) ? colors.onGold : colors.placeholder }]}>{d.label}</Text>
                          </View>
                        ))
                      )}
                    </View>
                  </View>
                  <View style={styles.medRight}>
                    {med.reminderTime ? (
                      <View style={[styles.reminderChip, { backgroundColor: colors.sectionBg }]}>
                        <Feather name="bell" size={11} color={colors.goldText} />
                        <Text style={[styles.reminderTime, { color: colors.goldText }]}>{fmt12(med.reminderTime)}</Text>
                      </View>
                    ) : null}
                    <View style={styles.medActions}>
                      <TouchableOpacity onPress={() => openEdit(med)} style={[styles.editBtn, { backgroundColor: colors.sectionBg }]}>
                        <Feather name="edit-2" size={13} color={colors.tint} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(med.id, med.name)} style={[styles.deleteBtn, { backgroundColor: colors.sectionBg }]}>
                        <Feather name="trash-2" size={13} color={colors.destructive} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </AutoHideScrollView>

        <Modal visible={showSheet} animationType="slide" transparent>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View style={styles.overlay}>
              <TouchableWithoutFeedback onPress={() => setShowSheet(false)}>
                <View style={StyleSheet.absoluteFill} />
              </TouchableWithoutFeedback>
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <ScrollView style={[styles.bottomSheet, { backgroundColor: colors.surface }]} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
                  <Text style={[styles.sheetTitle, { color: colors.text }]}>{editId ? "Edit Medication" : "Add Medication"}</Text>

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Name / Supplement</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text }]} value={name} onChangeText={setName} placeholder="e.g. Mesalazine 400mg, Vitamin D…" placeholderTextColor={colors.placeholder} autoFocus />

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 14 }]}>Notes / Dosage</Text>
                  <View style={[styles.notesInputRow, { backgroundColor: colors.inputBg }]}>
                    <TextInput style={[styles.notesInput, { color: colors.text }]} value={notes} onChangeText={setNotes} placeholder="e.g. Take with food, 1 tablet twice daily…" placeholderTextColor={colors.placeholder} multiline numberOfLines={3} />
                    <TouchableOpacity style={[styles.micBtn, { backgroundColor: colors.borderLight }]} onPress={() => Alert.alert("Voice Input", "Use your device's dictation feature in the keyboard.")}>
                      <Feather name="mic" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 14 }]}>Reminder Days</Text>
                  <View style={styles.weekdayRow}>
                    {DAYS.map((d) => (
                      <TouchableOpacity
                        key={d.key}
                        style={[styles.weekdayBtn, reminderDays.includes(d.key) ? { backgroundColor: colors.gold } : { backgroundColor: colors.sectionBg, borderColor: colors.border, borderWidth: 1 }]}
                        onPress={() => toggleDay(d.key)}
                      >
                        <Text style={[styles.weekdayBtnText, { color: reminderDays.includes(d.key) ? colors.onGold : colors.textSecondary }]}>{d.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.weekdayShortcuts}>
                    <TouchableOpacity onPress={() => setReminderDays(ALL_DAYS)} style={[styles.shortcutChip, { backgroundColor: colors.sectionBg }]}>
                      <Text style={[styles.shortcutText, { color: colors.goldText }]}>All days</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setReminderDays(["Mon","Tue","Wed","Thu","Fri"])} style={[styles.shortcutChip, { backgroundColor: colors.sectionBg }]}>
                      <Text style={[styles.shortcutText, { color: colors.goldText }]}>Weekdays</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setReminderDays(["Sat","Sun"])} style={[styles.shortcutChip, { backgroundColor: colors.sectionBg }]}>
                      <Text style={[styles.shortcutText, { color: colors.goldText }]}>Weekends</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 14 }]}>Daily Reminder Time</Text>
                  <SimpleTimeInput value={reminderTime} onChange={setReminderTime} colors={colors} />

                  <View style={[styles.alarmNote, { backgroundColor: colors.sectionBg, marginTop: 12 }]}>
                    <Feather name="info" size={14} color={colors.goldText} />
                    <Text style={[styles.alarmNoteText, { color: colors.textSecondary }]}>Enable notifications in device settings to receive daily reminders.</Text>
                  </View>

                  <View style={styles.modalButtons}>
                    <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.sectionBg }]} onPress={() => setShowSheet(false)}>
                      <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.gold }]} onPress={handleSave}>
                      <Text style={[styles.saveText, { color: colors.onGold }]}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </TouchableWithoutFeedback>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 22, paddingBottom: 14, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  headerTitle: { fontSize: 23, fontWeight: "700" as const, letterSpacing: -0.6 },
  headerSub: { fontSize: 12, marginTop: 3 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  headerAddBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  banner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 22, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  bannerText: { color: "#fff", fontSize: 13, fontWeight: "600" as const },
  emptyContainer: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "600" as const },
  emptySub: { fontSize: 14, textAlign: "center", paddingHorizontal: 40 },
  emptyAddBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, marginTop: 8 },
  emptyAddText: { color: "#fff", fontSize: 14, fontWeight: "600" as const },
  medCard: { flexDirection: "row", alignItems: "flex-start", borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 15, marginBottom: 9, gap: 12 },
  medIcon: { width: 38, height: 38, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  medName: { fontSize: 15, fontWeight: "600" as const },
  medNotes: { fontSize: 13, marginTop: 2 },
  dayChipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  dayChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  dayChipText: { fontSize: 10, fontWeight: "600" as const },
  medRight: { alignItems: "flex-end", gap: 6 },
  reminderChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  reminderTime: { fontSize: 12, fontWeight: "600" as const },
  medActions: { flexDirection: "row", gap: 6 },
  editBtn: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  deleteBtn: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  bottomSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "90%" },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: "700" as const, marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: "600" as const, letterSpacing: 0.5, marginBottom: 8 },
  input: { height: 48, borderRadius: 10, paddingHorizontal: 14, fontSize: 15 },
  notesInputRow: { flexDirection: "row", alignItems: "flex-start", borderRadius: 10, padding: 12, minHeight: 90 },
  notesInput: { flex: 1, fontSize: 14, lineHeight: 22, textAlignVertical: "top" },
  micBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  weekdayRow: { flexDirection: "row", gap: 6, marginBottom: 8 },
  weekdayBtn: { flex: 1, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  weekdayBtnText: { fontSize: 13, fontWeight: "700" as const },
  weekdayShortcuts: { flexDirection: "row", gap: 8, marginBottom: 4 },
  shortcutChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  shortcutText: { fontSize: 12, fontWeight: "600" as const },
  timePickerBox: { paddingVertical: 8, paddingHorizontal: 4 },
  alarmNote: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10 },
  alarmNoteText: { flex: 1, fontSize: 12, lineHeight: 18 },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: "center" },
  cancelText: { fontSize: 15, fontWeight: "600" as const },
  saveBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: "center" },
  saveText: { color: "#fff", fontSize: 15, fontWeight: "600" as const },
});
