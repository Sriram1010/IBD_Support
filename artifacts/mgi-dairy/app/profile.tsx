import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp, UserProfile } from "@/context/AppContext";
import Colors from "@/constants/colors";

const PASSWORD_KEY = "mgi_profile_password";

function ProfileForm({ initialProfile }: { initialProfile: UserProfile }) {
  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { saveProfile } = useApp();

  const [name, setName] = useState(initialProfile.name);
  const [email, setEmail] = useState(initialProfile.email);
  const [age, setAge] = useState(initialProfile.age);
  const [height, setHeight] = useState(initialProfile.height);
  const [weight, setWeight] = useState(initialProfile.weight);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(PASSWORD_KEY)
      .then((value) => setHasPassword(Boolean(value)))
      .catch(() => setHasPassword(false));
  }, []);

  const initials = useMemo(() => {
    const trimmedName = name.trim();
    if (!trimmedName) return "U";
    return trimmedName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }, [name]);

  const handleSave = async () => {
    const numericFields = [
      { label: "Age", value: age },
      { label: "Height", value: height },
      { label: "Weight", value: weight },
    ];
    for (const field of numericFields) {
      if (field.value.trim() && (Number.isNaN(Number(field.value)) || Number(field.value) <= 0)) {
        Alert.alert("Check your details", `${field.label} must be a number greater than 0.`);
        return;
      }
    }

    if (newPassword && newPassword.length < 6) {
      Alert.alert("Password too short", "Use at least 6 characters for your password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Passwords do not match", "Enter the same password in both password fields.");
      return;
    }

    setIsSaving(true);
    try {
      await saveProfile({
        name: name.trim(),
        email: email.trim(),
        age: age.trim(),
        height: height.trim(),
        weight: weight.trim(),
      });
      if (newPassword) {
        await SecureStore.setItemAsync(PASSWORD_KEY, newPassword);
      }
      setNewPassword("");
      setConfirmPassword("");
      setHasPassword(hasPassword || Boolean(newPassword));
      Alert.alert("Profile saved", "Your profile details have been updated.", [
        { text: "Done", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Could not save", "Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          testID="profile-close-button"
          accessibilityRole="button"
          accessibilityLabel="Close profile settings"
          style={styles.iconButton}
          onPress={() => router.back()}
        >
          <Feather name="x" size={24} color={colors.headerText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Profile settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 28 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.profileIntro, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.teal }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.introCopy}>
            <Text style={[styles.introTitle, { color: colors.text }]}>
              {name.trim() || "Your profile"}
            </Text>
            <Text style={[styles.introSubtitle, { color: colors.textSecondary }]}>
              Keep your health details up to date
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Personal details</Text>
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Field label="Full name" value={name} onChangeText={setName} placeholder="How should we call you?" colors={colors} />
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" colors={colors} />
          <View style={styles.fieldRow}>
            <View style={styles.halfField}>
              <Field label="Age" value={age} onChangeText={setAge} placeholder="Years" keyboardType="number-pad" colors={colors} />
            </View>
            <View style={styles.halfField}>
              <Field label="Height (cm)" value={height} onChangeText={setHeight} placeholder="e.g. 172" keyboardType="decimal-pad" colors={colors} />
            </View>
          </View>
          <Field label="Weight (kg)" value={weight} onChangeText={setWeight} placeholder="e.g. 70.5" keyboardType="decimal-pad" colors={colors} />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Password</Text>
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.passwordStatus}>
            <Feather name={hasPassword ? "lock" : "shield"} size={18} color={hasPassword ? colors.teal : colors.textSecondary} />
            <Text style={[styles.passwordStatusText, { color: colors.textSecondary }]}>
              {hasPassword ? "A password is set on this device" : "No password set yet"}
            </Text>
          </View>
          <Field
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="At least 6 characters"
            secureTextEntry
            autoCapitalize="none"
            colors={colors}
          />
          <Field
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Enter it again"
            secureTextEntry
            autoCapitalize="none"
            colors={colors}
          />
          <Text style={[styles.helperText, { color: colors.textSecondary }]}>
            Passwords are stored securely on this device. This offline app does not use an online sign-in.
          </Text>
        </View>

        <TouchableOpacity
          testID="save-profile-button"
          accessibilityRole="button"
          accessibilityLabel="Save profile changes"
          style={[styles.saveButton, { backgroundColor: colors.teal, opacity: isSaving ? 0.65 : 1 }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? <ActivityIndicator color={colors.headerText} /> : <Text style={styles.saveButtonText}>Save changes</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  colors,
  ...props
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  colors: typeof Colors.light;
  keyboardType?: "default" | "email-address" | "number-pad" | "decimal-pad";
  autoCapitalize?: "none" | "sentences";
  secureTextEntry?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        {...props}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
      />
    </View>
  );
}

export default function ProfileScreen() {
  const { profile, isLoading } = useApp();
  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? Colors.dark : Colors.light;

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  return <ProfileForm initialProfile={profile} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { minHeight: 66, paddingHorizontal: 16, paddingBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontSize: 20, fontWeight: "700" as const },
  iconButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  headerSpacer: { width: 42 },
  profileIntro: { borderRadius: 18, borderWidth: 1, padding: 18, flexDirection: "row", alignItems: "center", marginBottom: 24 },
  avatar: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 20, fontWeight: "700" as const },
  introCopy: { flex: 1, marginLeft: 14 },
  introTitle: { fontSize: 18, fontWeight: "700" as const },
  introSubtitle: { fontSize: 13, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: "700" as const, marginBottom: 10 },
  sectionCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 22 },
  field: { marginBottom: 14 },
  fieldRow: { flexDirection: "row", gap: 10 },
  halfField: { flex: 1 },
  fieldLabel: { fontSize: 12, fontWeight: "600" as const, marginBottom: 6 },
  input: { minHeight: 46, borderRadius: 11, borderWidth: 1, paddingHorizontal: 12, fontSize: 15 },
  passwordStatus: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  passwordStatusText: { fontSize: 13 },
  helperText: { fontSize: 12, lineHeight: 18, marginTop: -2 },
  saveButton: { minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 2 },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" as const },
});