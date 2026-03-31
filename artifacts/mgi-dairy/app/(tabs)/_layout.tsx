import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import Colors from "@/constants/colors";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.tabIconDefault,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : isDark ? "#0F0A1E" : "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          height: Platform.OS === "web" ? 66 : 54,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "500" as const,
          marginBottom: Platform.OS === "ios" ? 0 : 4,
        },
        tabBarIconStyle: { marginTop: Platform.OS === "ios" ? 0 : 2 },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "#0F0A1E" : "#FFFFFF" }]} />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Diary",
          tabBarIcon: ({ color }) => <Feather name="book-open" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ color }) => <Feather name="calendar" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="triggers"
        options={{
          title: "Food",
          tabBarIcon: ({ color }) => <Feather name="feather" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="meds"
        options={{
          title: "Meds",
          tabBarIcon: ({ color }) => <Feather name="package" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="mgi"
        options={{
          title: "Academy",
          tabBarIcon: ({ color }) => <Feather name="globe" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
