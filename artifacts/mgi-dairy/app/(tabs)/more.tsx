import React from "react";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";

const destinations = [
  { title: "Calendar", subtitle: "See your daily logs over time", icon: "calendar" as const, route: "/calendar" as const },
  { title: "Food notes", subtitle: "Track foods that feel safe or worth watching", icon: "feather" as const, route: "/triggers" as const },
  { title: "Medications", subtitle: "Keep your medication record close", icon: "package" as const, route: "/meds" as const },
  { title: "Your profile", subtitle: "Settings and your personal details", icon: "user" as const, route: "/profile" as const },
];

export default function MoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = Colors[useColorScheme() === "dark" ? "dark" : "light"];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, {
          paddingTop: (Platform.OS === "web" ? 67 : insets.top) + 20,
          paddingBottom: (Platform.OS === "web" ? 84 : insets.bottom + 54) + 24,
        }]}
      >
        <Text style={[styles.eyebrow, { color: colors.leaf }]}>HAPPY COLON / YOUR SPACE</Text>
        <Text style={[styles.title, { color: colors.text }]}>More</Text>
        <Text style={[styles.intro, { color: colors.textSecondary }]}>
          Your records and settings, together in one place.
        </Text>
        <View style={[styles.list, { borderTopColor: colors.border }]}>
          {destinations.map((item) => (
            <TouchableOpacity
              key={item.route}
              accessibilityRole="button"
              onPress={() => router.push(item.route)}
              style={[styles.row, { borderBottomColor: colors.border }]}
            >
              <View style={[styles.icon, { backgroundColor: colors.leafLight }]}>
                <Feather name={item.icon} size={21} color={colors.leaf} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>{item.title}</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{item.subtitle}</Text>
              </View>
              <Feather name="chevron-right" size={19} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 22 },
  eyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginBottom: 22 },
  title: { fontSize: 36, fontWeight: "700", letterSpacing: -1.4 },
  intro: { fontSize: 14, lineHeight: 22, marginTop: 8, marginBottom: 30 },
  list: { borderTopWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 18, borderBottomWidth: 1 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: "600" },
  subtitle: { fontSize: 12, lineHeight: 17, marginTop: 3 },
});