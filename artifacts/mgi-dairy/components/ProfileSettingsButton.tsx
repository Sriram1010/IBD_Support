import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export function ProfileSettingsButton({ color }: { color: string }) {
  const router = useRouter();

  return (
    <TouchableOpacity
      testID="profile-settings-button"
      accessibilityRole="button"
      accessibilityLabel="Open profile settings"
      style={styles.button}
      onPress={() => router.push("/profile")}
    >
      <Feather name="settings" size={22} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
});