import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";

export default function TabLayout() {
  const scheme = useColorScheme();
  const colors = scheme === "dark" ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          elevation: 0,
          height: Platform.OS === "web" ? 84 : 54 + insets.bottom,
          paddingBottom: Platform.OS === "web" ? 18 : insets.bottom,
          paddingTop: 7,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600", marginTop: 1 },
        tabBarIconStyle: { marginTop: 1 },
        tabBarItemStyle: { paddingHorizontal: 0 },
      }}
    >
      <Tabs.Screen name="guide" options={{ title: "Guide", tabBarIcon: ({ color }) => <Feather name="compass" size={20} color={color} /> }} />
      <Tabs.Screen name="index" options={{ title: "Diary", tabBarIcon: ({ color }) => <Feather name="book-open" size={19} color={color} /> }} />
      <Tabs.Screen name="menu" options={{ title: "Menu", tabBarIcon: ({ color }) => <Feather name="list" size={19} color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: "More", tabBarIcon: ({ color }) => <Feather name="grid" size={19} color={color} /> }} />
      <Tabs.Screen name="calendar" options={{ href: null }} />
      <Tabs.Screen name="triggers" options={{ href: null }} />
      <Tabs.Screen name="meds" options={{ href: null }} />
    </Tabs>
  );
}