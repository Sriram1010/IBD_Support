import React from "react";
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ImageViewerScreen() {
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.image}
          resizeMode="contain"
        />
      ) : null}
      <TouchableOpacity
        style={[styles.closeBtn, { top: insets.top + 16 }]}
        onPress={() => router.back()}
      >
        <Feather name="x" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "80%",
  },
  closeBtn: {
    position: "absolute",
    right: 20,
    width: 44,
    height: 44,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
