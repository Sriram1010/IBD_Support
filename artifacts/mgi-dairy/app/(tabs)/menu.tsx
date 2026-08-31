import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, Platform, useColorScheme,
  KeyboardAvoidingView, Linking,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useApp as useAppContext } from "@/context/AppContext";
import Colors from "@/constants/colors";
import { SimpleTimeInput } from "@/components/WheelPicker";
import { AutoHideScrollView } from "@/components/AutoHideScrollView";
import { ProfileSettingsButton } from "@/components/ProfileSettingsButton";

function MenuSimple24hInput({ value, onChange, colors }: { value: string; onChange: (v: string) => void; colors: any }) {
  const [text, setText] = React.useState(value || "08:00");
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
      placeholder="08:00" keyboardType="numbers-and-punctuation" maxLength={5}
      style={{ flex: 1, height: 36, borderRadius: 10, paddingHorizontal: 12, fontSize: 15, fontWeight: "600" as const, backgroundColor: colors.inputBg, color: colors.text }} />
  );
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateString(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function MenuScreen() {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === "dark";
  const colors = Colors[isDark ? "dark" : "light"];
  const { menuItems, addMenuItem, updateMenuItem, deleteMenuItem, getWeekMenuItems } = useAppContext();

  const [selectedDay, setSelectedDay] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);

  const monday = getMondayOfWeek(new Date());
  monday.setDate(monday.getDate() + weekOffset * 7);
  const weekStart = toDateString(monday);

  const weekDayDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toDateString(d);
  });

  const weekItemsAll = getWeekMenuItems(weekStart);
  const dayItems = weekItemsAll.filter((m) => m.dayOfWeek === selectedDay);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTime, setFormTime] = useState("08:00");
  const [menuTimeFmt, setMenuTimeFmt] = useState<"12h" | "24h">("12h");
  const [formRecipe, setFormRecipe] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formLinkUrl, setFormLinkUrl] = useState("");
  const [formLinkLabel, setFormLinkLabel] = useState("");

  const [webViewUrl, setWebViewUrl] = useState<string | null>(null);
  const [webCanGoBack, setWebCanGoBack] = useState(false);
  const [webCanGoFwd, setWebCanGoFwd] = useState(false);
  const webViewRef = useRef<any>(null);

  const topPad = Platform.OS === "web" ? 67 + insets.top : insets.top;
  const tabBarHeight = Platform.OS === "web" ? 60 : 50;
  const bottomPad = insets.bottom + tabBarHeight + 16;

  const openAdd = () => {
    setEditingId(null);
    setFormTime("08:00");
    setFormRecipe("");
    setFormNotes("");
    setFormLinkUrl("");
    setFormLinkLabel("");
    setSelectedDay(0);
    setShowModal(true);
  };

  const openEdit = (id: string) => {
    const item = menuItems.find((m) => m.id === id);
    if (!item) return;
    setEditingId(id);
    setSelectedDay(item.dayOfWeek);
    setFormTime(item.time);
    setFormRecipe(item.recipe);
    setFormNotes(item.notes ?? "");
    setFormLinkUrl(item.links?.[0]?.url ?? "");
    setFormLinkLabel(item.links?.[0]?.label ?? "");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formRecipe.trim()) {
      Alert.alert("Recipe required", "Please enter a recipe or meal name.");
      return;
    }
    const links = formLinkUrl.trim() ? [{ url: formLinkUrl.trim(), label: formLinkLabel.trim() || undefined }] : [];
    const data = {
      weekStart,
      dayOfWeek: selectedDay,
      time: formTime,
      recipe: formRecipe.trim(),
      notes: formNotes.trim() || "",
      links,
    };
    if (editingId) await updateMenuItem(editingId, data);
    else await addMenuItem(data);
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Entry", "Remove this menu entry?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMenuItem(id) },
    ]);
  };

  const openLink = (url: string) => {
    let safeUrl = url.trim();
    if (!safeUrl.startsWith("http://") && !safeUrl.startsWith("https://")) safeUrl = "https://" + safeUrl;
    setWebViewUrl(safeUrl);
  };

  const formatTimeDisplay = (t: string) => {
    const [hStr, mStr] = t.split(":");
    const h = parseInt(hStr, 10);
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${mStr} ${period}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: topPad + 16 }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.headerText }]}>Weekly Menu</Text>
          <Text style={[styles.headerSub, { color: colors.headerTextSecondary }]}>{DAY_FULL[selectedDay]}</Text>
        </View>
        <ProfileSettingsButton color={colors.headerText} />
      </View>

      <View style={[styles.weekNav, { backgroundColor: colors.card, borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
        <TouchableOpacity onPress={() => setWeekOffset((p) => p - 1)} style={styles.weekNavArrow}>
          <Feather name="chevron-left" size={20} color={colors.tint} />
        </TouchableOpacity>
        <Text style={[styles.weekLabel, { color: colors.text }]}>
          {toDateString(monday).replace(/-/g, "/")} – {weekDayDates[6].replace(/-/g, "/")}
        </Text>
        <TouchableOpacity onPress={() => setWeekOffset((p) => p + 1)} style={styles.weekNavArrow}>
          <Feather name="chevron-right" size={20} color={colors.tint} />
        </TouchableOpacity>
      </View>

      <View style={[styles.dayTabs, { backgroundColor: colors.card, borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
        {DAY_LABELS.map((label, idx) => {
          const hasItems = weekItemsAll.some((m) => m.dayOfWeek === idx);
          return (
            <TouchableOpacity key={idx} style={[styles.dayTab, selectedDay === idx && { borderBottomWidth: 3, borderBottomColor: colors.purple }]} onPress={() => setSelectedDay(idx)}>
              <Text style={[styles.dayTabLabel, { color: selectedDay === idx ? colors.purple : colors.textSecondary }]}>{label}</Text>
              {hasItems && <View style={[styles.dayDot, { backgroundColor: colors.teal }]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <AutoHideScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
        {dayItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="calendar" size={40} color={colors.placeholder} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No meals planned</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Tap + to add a meal for {DAY_FULL[selectedDay]}</Text>
          </View>
        ) : (
          <View style={[styles.table, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.tableHead, { borderBottomColor: colors.border }]}>
              <Text style={[styles.thTime, { color: colors.textSecondary }]}>Time</Text>
              <Text style={[styles.thRecipe, { color: colors.textSecondary }]}>Recipe</Text>
              <Text style={[styles.thNotes, { color: colors.textSecondary }]}>Notes</Text>
              <Text style={[styles.thLink, { color: colors.textSecondary }]}>Link</Text>
              <View style={{ width: 32 }} />
            </View>
            {dayItems.map((item) => (
              <TouchableOpacity key={item.id} activeOpacity={0.8} onLongPress={() => openEdit(item.id)} style={[styles.tableRow, { borderTopColor: colors.borderLight }]}>
                <Text style={[styles.tdTime, { color: colors.text }]}>{formatTimeDisplay(item.time)}</Text>
                <View style={styles.tdRecipeCol}>
                  <Text style={[styles.tdRecipe, { color: colors.text }]}>{item.recipe}</Text>
                </View>
                <View style={styles.tdNotesCol}>
                  {item.notes ? <Text style={[styles.tdNotes, { color: colors.textSecondary }]} numberOfLines={2}>{item.notes}</Text> : <Text style={[styles.tdDash, { color: colors.placeholder }]}>—</Text>}
                </View>
                <View style={styles.tdLinkCol}>
                  {item.links && item.links.length > 0 ? (
                    <TouchableOpacity onPress={() => openLink(item.links![0].url)} style={[styles.linkPill, { backgroundColor: colors.teal + "20" }]}>
                      <Feather name="link" size={12} color={colors.teal} />
                      <Text style={[styles.linkPillText, { color: colors.teal }]} numberOfLines={1}>{item.links[0].label || "Open"}</Text>
                    </TouchableOpacity>
                  ) : <Text style={[styles.tdDash, { color: colors.placeholder }]}>—</Text>}
                </View>
                <View style={styles.rowActions}>
                  <TouchableOpacity onPress={() => openEdit(item.id)} style={styles.rowAction}>
                    <Feather name="edit-2" size={13} color={colors.tint} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.rowAction}>
                    <Feather name="trash-2" size={13} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </AutoHideScrollView>

      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.purple }]} onPress={openAdd}>
        <Feather name="plus" size={26} color="#fff" />
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
            <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{editingId ? "Edit Entry" : "Add Meal"}</Text>
                <TouchableOpacity onPress={() => setShowModal(false)}>
                  <Feather name="x" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Day</Text>
                <View style={[styles.dayPicker, { borderColor: colors.border }]}> 
                  {DAY_LABELS.map((d, idx) => (
                    <TouchableOpacity key={d} onPress={() => setSelectedDay(idx)} style={[styles.dayPickBtn, selectedDay === idx && { backgroundColor: colors.teal }]}>
                      <Text style={[styles.dayPickText, { color: selectedDay === idx ? "#fff" : colors.textSecondary }]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 0 }]}>Time</Text>
                  <View style={{ flexDirection: "row", borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
                    <TouchableOpacity style={[{ paddingHorizontal: 12, paddingVertical: 5 }, menuTimeFmt === "12h" && { backgroundColor: colors.teal }]} onPress={() => setMenuTimeFmt("12h")}>
                      <Text style={{ fontSize: 12, fontWeight: "600" as const, color: menuTimeFmt === "12h" ? "#fff" : colors.textSecondary }}>12 HR</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[{ paddingHorizontal: 12, paddingVertical: 5 }, menuTimeFmt === "24h" && { backgroundColor: colors.teal }]} onPress={() => setMenuTimeFmt("24h")}>
                      <Text style={{ fontSize: 12, fontWeight: "600" as const, color: menuTimeFmt === "24h" ? "#fff" : colors.textSecondary }}>24 HR</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {menuTimeFmt === "12h"
                  ? <SimpleTimeInput value={formTime} onChange={setFormTime} colors={colors} />
                  : <MenuSimple24hInput value={formTime} onChange={setFormTime} colors={colors} />}
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Recipe / Meal Name *</Text>
                <View style={[styles.inputRow, { backgroundColor: colors.inputBg }]}>
                  <Feather name="book-open" size={16} color={colors.textSecondary} style={{ marginLeft: 12 }} />
                  <TextInput style={[styles.input, { color: colors.text }]} value={formRecipe} onChangeText={setFormRecipe} placeholder="e.g. Chicken salad, Oatmeal…" placeholderTextColor={colors.placeholder} />
                </View>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Notes</Text>
                <View style={[styles.textareaRow, { backgroundColor: colors.inputBg }]}>
                  <TextInput style={[styles.textarea, { color: colors.text }]} value={formNotes} onChangeText={setFormNotes} placeholder="Preparation tips, ingredients, quantities…" placeholderTextColor={colors.placeholder} multiline numberOfLines={3} />
                </View>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Link URL</Text>
                <View style={[styles.inputRow, { backgroundColor: colors.inputBg }]}>
                  <Feather name="link" size={16} color={colors.textSecondary} style={{ marginLeft: 12 }} />
                  <TextInput style={[styles.input, { color: colors.text }]} value={formLinkUrl} onChangeText={setFormLinkUrl} placeholder="https://..." placeholderTextColor={colors.placeholder} autoCapitalize="none" keyboardType="url" />
                </View>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Link Label (optional)</Text>
                <View style={[styles.inputRow, { backgroundColor: colors.inputBg }]}>
                  <Feather name="tag" size={16} color={colors.textSecondary} style={{ marginLeft: 12 }} />
                  <TextInput style={[styles.input, { color: colors.text }]} value={formLinkLabel} onChangeText={setFormLinkLabel} placeholder="e.g. Recipe Video, Blog Post…" placeholderTextColor={colors.placeholder} />
                </View>
                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.purple }]} onPress={handleSave}>
                  <Text style={styles.saveBtnText}>{editingId ? "Save Changes" : "Add to Menu"}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={!!webViewUrl} animationType="slide" presentationStyle="overFullScreen">
        <View style={[styles.webContainer, { paddingTop: insets.top, backgroundColor: colors.card }]}>
          <View style={[styles.webToolbar, { backgroundColor: colors.headerBg }]}>
            <TouchableOpacity onPress={() => { setWebViewUrl(null); setWebCanGoBack(false); setWebCanGoFwd(false); }} style={styles.webBtn}>
              <Feather name="x" size={20} color={colors.headerText} />
            </TouchableOpacity>
            <Text style={[styles.webUrl, { color: colors.headerTextSecondary }]} numberOfLines={1}>{webViewUrl}</Text>
            <View style={styles.webNavBtns}>
              <TouchableOpacity onPress={() => webViewRef.current?.goBack()} style={[styles.webBtn, !webCanGoBack && { opacity: 0.3 }]} disabled={!webCanGoBack}>
                <Feather name="chevron-left" size={20} color={colors.headerText} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => webViewRef.current?.goForward()} style={[styles.webBtn, !webCanGoFwd && { opacity: 0.3 }]} disabled={!webCanGoFwd}>
                <Feather name="chevron-right" size={20} color={colors.headerText} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { if (webViewUrl) Linking.openURL(webViewUrl); }} style={styles.webBtn}>
                <Feather name="external-link" size={18} color={colors.headerText} />
              </TouchableOpacity>
            </View>
          </View>
          {webViewUrl && <WebView ref={webViewRef} source={{ uri: webViewUrl }} style={{ flex: 1 }} onNavigationStateChange={(state) => { setWebCanGoBack(state.canGoBack); setWebCanGoFwd(state.canGoForward); }} />}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontSize: 28, fontWeight: "700" as const },
  headerSub: { fontSize: 14, marginTop: 2 },
  weekNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 8 },
  weekNavArrow: { padding: 8 },
  weekLabel: { fontSize: 13, fontWeight: "600" as const },
  dayTabs: { flexDirection: "row" },
  dayTab: { flex: 1, alignItems: "center", paddingVertical: 10 },
  dayTabLabel: { fontSize: 12, fontWeight: "600" as const },
  dayDot: { width: 5, height: 5, borderRadius: 3, marginTop: 3 },
  content: { padding: 16 },
  emptyState: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "600" as const },
  emptyText: { fontSize: 14, textAlign: "center" },
  table: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  tableHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  thTime: { width: 70, fontSize: 11, fontWeight: "600" as const },
  thRecipe: { flex: 1.3, fontSize: 11, fontWeight: "600" as const },
  thNotes: { flex: 1.4, fontSize: 11, fontWeight: "600" as const },
  thLink: { width: 60, fontSize: 11, fontWeight: "600" as const },
  tableRow: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 0.5, gap: 4 },
  tdTime: { width: 70, fontSize: 12 },
  tdRecipeCol: { flex: 1.3 },
  tdRecipe: { fontSize: 13, fontWeight: "500" as const },
  tdNotesCol: { flex: 1.4 },
  tdNotes: { fontSize: 12 },
  tdDash: { fontSize: 12 },
  tdLinkCol: { width: 60 },
  linkPill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, alignSelf: "flex-start" },
  linkPillText: { fontSize: 11, fontWeight: "500" as const, maxWidth: 44 },
  rowActions: { width: 32, alignItems: "center", gap: 6 },
  rowAction: { padding: 2 },
  fab: { position: "absolute", right: 20, bottom: 90, width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", elevation: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 5 },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  modalCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "90%", paddingBottom: 40 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "700" as const },
  fieldLabel: { fontSize: 12, fontWeight: "600" as const, marginTop: 14, marginBottom: 4 },
  fieldValue: { fontSize: 15, fontWeight: "500" as const },
  dayPicker: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 8, borderWidth: 1, borderRadius: 12 },
  dayPickBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.05)" },
  dayPickText: { fontSize: 12, fontWeight: "600" as const },
  compactTimeRow: { flexDirection: "row", alignItems: "center", borderRadius: 10, height: 44 },
  compactTimeInput: { flex: 1, paddingHorizontal: 12, fontSize: 18, fontWeight: "600" as const },
  inputRow: { flexDirection: "row", alignItems: "center", borderRadius: 10, height: 44 },
  input: { flex: 1, paddingHorizontal: 12, fontSize: 15 },
  textareaRow: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  textarea: { fontSize: 14, minHeight: 70 },
  saveBtn: { marginTop: 20, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" as const },
  webContainer: { flex: 1 },
  webToolbar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 10 },
  webBtn: { padding: 8 },
  webUrl: { flex: 1, fontSize: 12, marginHorizontal: 8 },
  webNavBtns: { flexDirection: "row", alignItems: "center" },
});