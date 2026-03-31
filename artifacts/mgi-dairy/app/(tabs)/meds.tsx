import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, Platform, useColorScheme,
  KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

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

  const sorted = [...medications].sort((a, b) => a.name.localeCompare(b.name));

  const openAdd = () => {
    setEditId(null); setName(""); setNotes(""); setReminderTime("08:00");
    setShowSheet(true);
  };

  const openEdit = (m: typeof medications[0]) => {
    setEditId(m.id); setName(m.name); setNotes(m.notes);
    setReminderTime(m.reminderTime || "08:00");
    setShowSheet(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert("Required", "Please enter the medication name."); return; }
    if (editId) {
      await updateMedication(editId, { name: name.trim(), notes: notes.trim(), reminderTime });
    } else {
      await addMedication({ name: name.trim(), notes: notes.trim(), reminderTime, createdAt: new Date().toISOString() });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Saved", `Reminder set for ${reminderTime} daily.\n\nEnable notifications in device settings to receive alerts.`);
    setShowSheet(false);
  };

  const handleDelete = (id: string, medName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Delete medication?", medName, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMedication(id) },
    ]);
  };

  const topPad = Platform.OS === "web" ? 67 + insets.top : 0;
  const tabBarHeight = Platform.OS === "web" ? 84 : 83;
  const bottomPad = insets.bottom + tabBarHeight + 16;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: topPad + 16 }]}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.headerText }]}>Medications</Text>
            <Text style={[styles.headerSub, { color: colors.headerTextSecondary }]}>Daily meds & supplements</Text>
          </View>
          <TouchableOpacity style={[styles.headerAddBtn, { backgroundColor: colors.gold }]} onPress={openAdd}>
            <Feather name="plus" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={[styles.banner, { backgroundColor: colors.teal }]}>
          <Feather name="package" size={16} color="#fff" />
          <Text style={styles.bannerText}>{sorted.length} medication{sorted.length !== 1 ? "s" : ""} tracked</Text>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {sorted.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="package" size={48} color={colors.placeholder} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No medications added</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Add your daily medications and supplements with reminders.</Text>
              <TouchableOpacity style={[styles.emptyAddBtn, { backgroundColor: colors.gold }]} onPress={openAdd}>
                <Feather name="plus" size={16} color="#fff" />
                <Text style={styles.emptyAddText}>Add First Medication</Text>
              </TouchableOpacity>
            </View>
          ) : (
            sorted.map((med) => (
              <TouchableOpacity
                key={med.id}
                style={[styles.medCard, { backgroundColor: colors.card }]}
                onPress={() => openEdit(med)}
                onLongPress={() => handleDelete(med.id, med.name)}
              >
                <View style={[styles.medIcon, { backgroundColor: colors.sectionBg }]}>
                  <Feather name="package" size={20} color={colors.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.medName, { color: colors.text }]}>{med.name}</Text>
                  {med.notes ? <Text style={[styles.medNotes, { color: colors.textSecondary }]} numberOfLines={1}>{med.notes}</Text> : null}
                </View>
                <View style={styles.medRight}>
                  {med.reminderTime ? (
                    <View style={[styles.reminderChip, { backgroundColor: colors.sectionBg }]}>
                      <Feather name="bell" size={11} color={colors.gold} />
                      <Text style={[styles.reminderTime, { color: colors.gold }]}>{med.reminderTime}</Text>
                    </View>
                  ) : null}
                  <View style={styles.medActions}>
                    <TouchableOpacity onPress={() => openEdit(med)} style={[styles.editBtn, { backgroundColor: colors.sectionBg }]}>
                      <Feather name="edit-2" size={13} color={colors.tint} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(med.id, med.name)} style={[styles.deleteBtn, { backgroundColor: "#FEE2E2" }]}>
                      <Feather name="trash-2" size={13} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        <Modal visible={showSheet} animationType="slide" transparent>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View style={styles.overlay}>
              <TouchableWithoutFeedback onPress={() => setShowSheet(false)}>
                <View style={StyleSheet.absoluteFill} />
              </TouchableWithoutFeedback>
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={[styles.bottomSheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 16 }]}>
                  <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
                  <Text style={[styles.sheetTitle, { color: colors.text }]}>{editId ? "Edit Medication" : "Add Medication"}</Text>

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Name / Supplement</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text }]}
                    value={name} onChangeText={setName}
                    placeholder="e.g. Mesalazine 400mg, Vitamin D…"
                    placeholderTextColor={colors.placeholder}
                    autoFocus
                  />

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>Notes / Dosage</Text>
                  <View style={[styles.notesInputRow, { backgroundColor: colors.inputBg }]}>
                    <TextInput
                      style={[styles.notesInput, { color: colors.text }]}
                      value={notes} onChangeText={setNotes}
                      placeholder="e.g. Take with food, 1 tablet twice daily…"
                      placeholderTextColor={colors.placeholder}
                      multiline numberOfLines={3}
                    />
                    <TouchableOpacity
                      style={[styles.micBtn, { backgroundColor: colors.borderLight }]}
                      onPress={() => Alert.alert("Voice Input", "Use your device's dictation feature in the keyboard.")}
                    >
                      <Feather name="mic" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>Daily Reminder Time</Text>
                  <View style={[styles.reminderRow, { backgroundColor: colors.inputBg }]}>
                    <Feather name="bell" size={16} color={colors.gold} style={{ marginLeft: 14 }} />
                    <TextInput
                      style={[styles.reminderInput, { color: colors.text }]}
                      value={reminderTime} onChangeText={setReminderTime}
                      placeholder="HH:MM" placeholderTextColor={colors.placeholder}
                      keyboardType="numbers-and-punctuation"
                    />
                    <Text style={[styles.reminderHint, { color: colors.placeholder }]}>24h format</Text>
                  </View>

                  <View style={[styles.alarmNote, { backgroundColor: colors.sectionBg }]}>
                    <Feather name="info" size={14} color={colors.gold} />
                    <Text style={[styles.alarmNoteText, { color: colors.textSecondary }]}>
                      Enable notifications in device settings to receive daily reminders.
                    </Text>
                  </View>

                  <View style={styles.modalButtons}>
                    <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.sectionBg }]} onPress={() => setShowSheet(false)}>
                      <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.gold }]} onPress={handleSave}>
                      <Text style={styles.saveText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
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
  header: { paddingHorizontal: 20, paddingBottom: 14, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  headerTitle: { fontSize: 28, fontWeight: "700" as const },
  headerSub: { fontSize: 13, marginTop: 2 },
  headerAddBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  banner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 10 },
  bannerText: { color: "#fff", fontSize: 13, fontWeight: "600" as const },
  emptyContainer: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "600" as const },
  emptySub: { fontSize: 14, textAlign: "center", paddingHorizontal: 40 },
  emptyAddBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, marginTop: 8 },
  emptyAddText: { color: "#fff", fontSize: 14, fontWeight: "600" as const },
  medCard: { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: "rgba(0,0,0,0.05)", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 1, gap: 12 },
  medIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  medName: { fontSize: 15, fontWeight: "600" as const },
  medNotes: { fontSize: 13, marginTop: 2 },
  medRight: { alignItems: "flex-end", gap: 6 },
  reminderChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  reminderTime: { fontSize: 12, fontWeight: "600" as const },
  medActions: { flexDirection: "row", gap: 6 },
  editBtn: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  deleteBtn: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  bottomSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: "700" as const, marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: "600" as const, letterSpacing: 0.5, marginBottom: 8 },
  input: { height: 48, borderRadius: 10, paddingHorizontal: 14, fontSize: 15 },
  notesInputRow: { flexDirection: "row", alignItems: "flex-start", borderRadius: 10, padding: 12, minHeight: 90 },
  notesInput: { flex: 1, fontSize: 14, lineHeight: 22, textAlignVertical: "top" },
  micBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  reminderRow: { flexDirection: "row", alignItems: "center", borderRadius: 10, height: 50 },
  reminderInput: { flex: 1, paddingHorizontal: 12, fontSize: 18, fontWeight: "600" as const },
  reminderHint: { fontSize: 12, paddingRight: 14 },
  alarmNote: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, marginTop: 12 },
  alarmNoteText: { flex: 1, fontSize: 12, lineHeight: 18 },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: "center" },
  cancelText: { fontSize: 15, fontWeight: "600" as const },
  saveBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: "center" },
  saveText: { color: "#fff", fontSize: 15, fontWeight: "600" as const },
});
