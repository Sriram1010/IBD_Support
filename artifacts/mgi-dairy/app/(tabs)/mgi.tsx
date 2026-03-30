import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, useColorScheme, ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";

const ACADEMY_URL = "https://academy.mgiclinic.com";

export default function MGIScreen() {
  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const topPad = Platform.OS === "web" ? 67 + insets.top : 0;
  const tabBarHeight = Platform.OS === "web" ? 84 : 83;

  const reload = () => {
    setError(false);
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: topPad + 16 }]}>
          <Text style={[styles.headerTitle, { color: colors.headerText }]}>MGI Academy</Text>
          <TouchableOpacity style={[styles.reloadBtn, { backgroundColor: colors.gold }]} onPress={reload}>
            <Feather name="refresh-cw" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={[styles.webviewContainer, { marginBottom: tabBarHeight + insets.bottom }]}>
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={colors.gold} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading MGI Academy…</Text>
            </View>
          )}
          <iframe
            key={reloadKey}
            src={ACADEMY_URL}
            style={{ width: "100%", height: "100%", border: "none" }}
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
            title="MGI Academy"
            allow="accelerometer; camera; microphone; fullscreen"
          />
        </View>
        {error && (
          <View style={styles.errorContainer}>
            <Feather name="wifi-off" size={40} color={colors.placeholder} />
            <Text style={[styles.errorText, { color: colors.text }]}>Could not load MGI Academy</Text>
            <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.gold }]} onPress={reload}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // Native WebView
  let WebView: any = null;
  try {
    WebView = require("react-native-webview").WebView;
  } catch {}

  if (!WebView) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: topPad + 16 }]}>
          <Text style={[styles.headerTitle, { color: colors.headerText }]}>MGI Academy</Text>
        </View>
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={40} color={colors.placeholder} />
          <Text style={[styles.errorText, { color: colors.text }]}>WebView not available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: topPad + 16 }]}>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>MGI Academy</Text>
        <TouchableOpacity style={[styles.reloadBtn, { backgroundColor: colors.gold }]} onPress={reload}>
          <Feather name="refresh-cw" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
      <View style={[styles.webviewContainer, { marginBottom: tabBarHeight + insets.bottom }]}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading MGI Academy…</Text>
          </View>
        )}
        <WebView
          key={reloadKey}
          source={{ uri: ACADEMY_URL }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }}
          style={{ flex: 1, opacity: loading ? 0 : 1 }}
          javaScriptEnabled
          domStorageEnabled
          allowsBackForwardNavigationGestures
        />
        {error && (
          <View style={[styles.errorOverlay, { backgroundColor: colors.background }]}>
            <Feather name="wifi-off" size={40} color={colors.placeholder} />
            <Text style={[styles.errorText, { color: colors.text }]}>Could not load MGI Academy</Text>
            <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.gold }]} onPress={reload}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 14, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  headerTitle: { fontSize: 28, fontWeight: "700" as const },
  reloadBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  webviewContainer: { flex: 1 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 12, zIndex: 10 },
  loadingText: { fontSize: 14 },
  errorContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  errorOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 14 },
  errorText: { fontSize: 16, fontWeight: "600" as const },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  retryText: { color: "#fff", fontSize: 15, fontWeight: "600" as const },
});
