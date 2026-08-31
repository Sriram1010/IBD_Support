import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, Platform, useColorScheme,
  KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AutoHideScrollView } from "@/components/AutoHideScrollView";
import { ProfileSettingsButton } from "@/components/ProfileSettingsButton";
import { useRouter } from "expo-router";

import Colors from "@/constants/colors";
import { useApp, FoodCategory, FoodTrigger } from "@/context/AppContext";
import { useDateString, formatTimeFromDate } from "@/hooks/useDateString";
import { parse24h } from "@/components/WheelPicker";

const CATEGORY_ORDER_KEY = "mgi_food_category_order";
const DEFAULT_ORDER: FoodCategory[] = ["trigger", "safe", "reintroduce", "flareup"];

function fmtShortDate(d: string): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const dt = new Date(d + "T12:00:00");
  return `${months[dt.getMonth()]} ${dt.getDate()}`;
}

function fmtTime12(t: string): string {
  if (!t) return "";
  const { h12, min, ampm } = parse24h(t);
  return `${h12}:${String(min).padStart(2, "0")} ${ampm}`;
}

const CATEGORY_META: Record<FoodCategory, { label: string; color: string; icon: string; bg: string }> = {
  trigger: { label: "Trigger Foods", color: "#EF4444", icon: "alert-triangle", bg: "#FEF2F2" },
  flareup: { label: "Flare-up Foods", color: "#DC2626", icon: "zap", bg: "#FFF1F1" },
  safe: { label: "Safe Foods", color: "#10B981", icon: "check-circle", bg: "#ECFDF5" },
  reintroduce: { label: "Reintroduce", color: "#F97316", icon: "refresh-cw", bg: "#FFF7ED" },
};

export default function FoodScreen() {
  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const today = useDateString();
  const router = useRouter();

  const { foodTriggers, addFoodTrigger, updateFoodTrigger, deleteFoodTrigger } = useApp();

  const [showSheet, setShowSheet] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [food, setFood] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState<FoodCategory>("trigger");
  const [categoryOrder, setCategoryOrder] = useState<FoodCategory[]>(DEFAULT_ORDER);
  const [isReordering, setIsReordering] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CATEGORY_ORDER_KEY).then((v) => {
      if (v) {
        try {
          const parsed = JSON.parse(v) as FoodCategory[];
          if (parsed.length === 4) setCategoryOrder(parsed);
        } catch {}
      }
    });
  }, []);

  const saveOrder = async (order: FoodCategory[]) => {
    await AsyncStorage.setItem(CATEGORY_ORDER_KEY, JSON.stringify(order));
  };

  const moveCategory = (index: number, direction: "up" | "down") => {
    const newOrder = [...categoryOrder];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newOrder.length) return;
    [newOrder[index], newOrder[targetIdx]] = [newOrder[targetIdx], newOrder[index]];
    setCategoryOrder(newOrder);
    saveOrder(newOrder);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const byCategory = (cat: FoodCategory) => foodTriggers.filter((t) => (t.category ?? "trigger") === cat);

  const openAdd = (cat: FoodCategory = "trigger") => {
    setEditId(null);
    setFood("");
    setNotes("");
    setCategory(cat);
    setShowSheet(true);
  };

  const openEdit = (t: FoodTrigger) => {
    setEditId(t.id);
    setFood(t.food);
    setNotes(t.notes);
    setCategory(t.category ?? "trigger");
    setShowSheet(true);
  };

  const handleSave = async () => {
    if (!food.trim()) { Alert.alert("Required", "Please enter a food name."); return; }
    if (editId) {
      await updateFoodTrigger(editId, { food: food.trim(), notes: notes.trim(), category });
    } else {
      await addFoodTrigger({ date: today, time: formatTimeFromDate(new Date()), food: food.trim(), notes: notes.trim(), category });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowSheet(false);
  };

  const handleDelete = (id: string, name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Delete?", name, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteFoodTrigger(id) },
    ]);
  };

  const handleMove = (item: FoodTrigger) => {
    const all: FoodCategory[] = ["trigger", "flareup", "safe", "reintroduce"];
    const options = all.filter((c) => c !== (item.category ?? "trigger"));
    Alert.alert("Move to…", undefined, [
      ...options.map((c) => ({ text: CATEGORY_META[c].label, onPress: () => updateFoodTrigger(item.id, { category: c, date: today, time: formatTimeFromDate(new Date()) }) })),
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const topPad = Platform.OS === "web" ? 67 + insets.top : insets.top;
  const tabBarHeight = Platform.OS === "web" ? 60 : 50;
  const bottomPad = insets.bottom + tabBarHeight + 16;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: topPad + 16 }]}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.headerText }]}>Food</Text>
            <Text style={[styles.headerSub, { color: colors.headerTextSecondary }]}>Track your food sensitivities</Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={[styles.headerReorderBtn, { backgroundColor: isReordering ? colors.gold : "rgba(255,255,255,0.18)" }]}
              onPress={() => { setIsReordering((v) => !v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            >
              <Feather name={isReordering ? "check" : "menu"} size={16} color="#fff" />
              <Text style={styles.headerReorderText}>{isReordering ? "Done" : "Reorder"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.headerAddBtn, { backgroundColor: colors.gold }]} onPress={() => openAdd("trigger")}>
              <Feather name="plus" size={18} color="#fff" />
            </TouchableOpacity>
            <ProfileSettingsButton color={colors.headerText} />
          </View>
        </View>

        {/* Summary banner */}
        <View style={[styles.banner, { backgroundColor: colors.purple }]}>
          <Feather name="layers" size={15} color="#fff" />
          <Text style={styles.bannerText}>
            {byCategory("trigger").length} triggers · {byCategory("flareup").length} flare-ups · {byCategory("safe").length} safe · {byCategory("reintroduce").length} reintroduce
          </Text>
        </View>

        {isReordering && (
          <View style={[styles.reorderHintBar, { backgroundColor: colors.sectionBg, borderBottomColor: colors.border }]}>
            <Feather name="info" size={13} color={colors.textSecondary} />
            <Text style={[styles.reorderHintText, { color: colors.textSecondary }]}>Use the arrows to rearrange the category cards</Text>
          </View>
        )}

        <AutoHideScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }}
          keyboardShouldPersistTaps="handled"
        >
          {categoryOrder.map((cat, orderIdx) => {
            const meta = CATEGORY_META[cat];
            const items = byCategory(cat);
            const isFirst = orderIdx === 0;
            const isLast = orderIdx === categoryOrder.length - 1;

            return (
              <View
                key={cat}
                style={[
                  styles.sectionCard,
                  { backgroundColor: colors.card, shadowColor: colors.shadow },
                  isReordering && styles.sectionCardReordering,
                  isReordering && { borderColor: meta.color + "44", borderWidth: 1.5 },
                ]}
              >
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    {isReordering && (
                      <View style={styles.reorderArrows}>
                        <TouchableOpacity
                          style={[styles.arrowBtn, isFirst && styles.arrowBtnDisabled]}
                          onPress={() => moveCategory(orderIdx, "up")}
                          disabled={isFirst}
                        >
                          <Feather name="chevron-up" size={14} color={isFirst ? colors.placeholder : meta.color} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.arrowBtn, isLast && styles.arrowBtnDisabled]}
                          onPress={() => moveCategory(orderIdx, "down")}
                          disabled={isLast}
                        >
                          <Feather name="chevron-down" size={14} color={isLast ? colors.placeholder : meta.color} />
                        </TouchableOpacity>
                      </View>
                    )}
                    <View style={[styles.sectionIconBox, { backgroundColor: meta.color + "22" }]}>
                      <Feather name={meta.icon as any} size={16} color={meta.color} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>{meta.label}</Text>
                    <View style={[styles.countBadge, { backgroundColor: meta.color + "22" }]}>
                      <Text style={[styles.countBadgeText, { color: meta.color }]}>{items.length}</Text>
                    </View>
                  </View>
                  {!isReordering && (
                    <TouchableOpacity style={[styles.sectionAddBtn, { backgroundColor: meta.color }]} onPress={() => openAdd(cat)}>
                      <Feather name="plus" size={14} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>

                {items.length === 0 ? (
                  <View style={styles.sectionEmpty}>
                    <Text style={[styles.sectionEmptyText, { color: colors.placeholder }]}>No {meta.label.toLowerCase()} yet. Tap + to add.</Text>
                  </View>
                ) : (
                  items.map((t, idx) => (
                    <View key={t.id} style={[styles.foodRow, { borderTopColor: idx === 0 ? colors.border : colors.borderLight, borderTopWidth: 0.5 }]}>
                      <View style={[styles.foodDot, { backgroundColor: meta.color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.foodName, { color: colors.text }]}>{t.food}</Text>
                        <Text style={[styles.foodMeta, { color: colors.placeholder }]}>
                          {fmtShortDate(t.date)}{t.time ? ` · ${fmtTime12(t.time)}` : ""}
                        </Text>
                        {t.notes ? <Text style={[styles.foodNotes, { color: colors.textSecondary }]} numberOfLines={2}>{t.notes}</Text> : null}
                        {cat === "trigger" && (
                          <TouchableOpacity
                            style={[styles.checkStoolBtn, { borderColor: colors.border }]}
                            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/calendar"); }}
                          >
                            <Feather name="image" size={12} color={colors.teal} />
                            <Text style={[styles.checkStoolText, { color: colors.teal }]}>Stool</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {!isReordering && (
                        <View style={styles.foodActions}>
                          <TouchableOpacity onPress={() => handleMove(t)} style={[styles.actionBtn, { backgroundColor: colors.sectionBg }]}>
                            <Feather name="move" size={13} color={meta.color} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => openEdit(t)} style={[styles.actionBtn, { backgroundColor: colors.sectionBg }]}>
                            <Feather name="edit-2" size={13} color={colors.tint} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDelete(t.id, t.food)} style={[styles.actionBtn, { backgroundColor: "#FEE2E2" }]}>
                            <Feather name="trash-2" size={13} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  ))
                )}
              </View>
            );
          })}
        </AutoHideScrollView>

        {/* ADD/EDIT SHEET */}
        <Modal visible={showSheet} animationType="slide" transparent>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View style={styles.overlay}>
              <TouchableWithoutFeedback onPress={() => setShowSheet(false)}>
                <View style={StyleSheet.absoluteFill} />
              </TouchableWithoutFeedback>
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={[styles.bottomSheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 16 }]}>
                  <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
                  <Text style={[styles.sheetTitle, { color: colors.text }]}>{editId ? "Edit Food" : "Add Food"}</Text>

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Category</Text>
                  <View style={styles.categoryRow}>
                    {(["trigger", "flareup", "safe", "reintroduce"] as FoodCategory[]).map((c) => {
                      const m = CATEGORY_META[c];
                      return (
                        <TouchableOpacity
                          key={c}
                          style={[styles.categoryChip, { borderColor: m.color, borderWidth: category === c ? 2 : 1, backgroundColor: category === c ? m.color + "22" : colors.sectionBg }]}
                          onPress={() => setCategory(c)}
                        >
                          <Feather name={m.icon as any} size={12} color={m.color} />
                          <Text style={[styles.categoryChipText, { color: m.color }]}>{m.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>Food Name</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text }]}
                    value={food}
                    onChangeText={setFood}
                    placeholder="e.g. Dairy, Gluten, Broccoli…"
                    placeholderTextColor={colors.placeholder}
                    autoFocus
                  />

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>Notes</Text>
                  <View style={[styles.notesInputRow, { backgroundColor: colors.inputBg }]}>
                    <TextInput
                      style={[styles.notesInput, { color: colors.text }]}
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Describe reaction or observation…"
                      placeholderTextColor={colors.placeholder}
                      multiline
                      numberOfLines={3}
                    />
                    <TouchableOpacity
                      style={[styles.micBtn, { backgroundColor: colors.borderLight }]}
                      onPress={() => Alert.alert("Voice Input", "Use your device's dictation feature in the keyboard.")}
                    >
                      <Feather name="mic" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.modalButtons}>
                    <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.sectionBg }]} onPress={() => setShowSheet(false)}>
                      <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.saveBtn, { backgroundColor: CATEGORY_META[category].color }]} onPress={handleSave}>
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
  headerButtons: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  headerReorderBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  headerReorderText: { color: "#fff", fontSize: 13, fontWeight: "600" as const },
  headerAddBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  banner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 10 },
  bannerText: { color: "#fff", fontSize: 13, fontWeight: "600" as const },
  reorderHintBar: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 0.5 },
  reorderHintText: { fontSize: 12 },
  sectionCard: { borderRadius: 16, marginBottom: 14, overflow: "hidden", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  sectionCardReordering: { shadowOpacity: 0.06, elevation: 4 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  sectionIconBox: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 16, fontWeight: "700" as const },
  countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countBadgeText: { fontSize: 12, fontWeight: "700" as const },
  sectionAddBtn: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  sectionEmpty: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 2 },
  sectionEmptyText: { fontSize: 13, fontStyle: "italic" as const },
  foodRow: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  foodDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  foodName: { fontSize: 14, fontWeight: "600" as const },
  foodMeta: { fontSize: 11, marginTop: 1, marginBottom: 2 },
  foodNotes: { fontSize: 13, marginTop: 2 },
  checkStoolBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start", marginTop: 6 },
  checkStoolText: { fontSize: 11, fontWeight: "600" as const },
  foodActions: { flexDirection: "row", gap: 6 },
  actionBtn: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  reorderArrows: { flexDirection: "column", gap: 0 },
  arrowBtn: { width: 24, height: 20, alignItems: "center", justifyContent: "center", borderRadius: 4 },
  arrowBtnDisabled: { opacity: 0.3 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  bottomSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: "700" as const, marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: "600" as const, letterSpacing: 0.5, marginBottom: 8 },
  categoryRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 4 },
  categoryChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  categoryChipText: { fontSize: 12, fontWeight: "600" as const },
  input: { height: 48, borderRadius: 10, paddingHorizontal: 14, fontSize: 15 },
  notesInputRow: { flexDirection: "row", alignItems: "flex-start", borderRadius: 10, padding: 12, minHeight: 90 },
  notesInput: { flex: 1, fontSize: 14, lineHeight: 22, textAlignVertical: "top" },
  micBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: "center" },
  cancelText: { fontSize: 15, fontWeight: "600" as const },
  saveBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: "center" },
  saveText: { color: "#fff", fontSize: 15, fontWeight: "600" as const },
});
