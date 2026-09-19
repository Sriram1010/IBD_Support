import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Platform, useColorScheme, KeyboardAvoidingView, ActivityIndicator, Image
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import { useApp as useAppContext } from "@/context/AppContext";
import Colors from "@/constants/colors";
import { AutoHideScrollView } from "@/components/AutoHideScrollView";
import {
  useCreateAiMealAssistant,
  AiMealAssistantInputMode,
  AiMealAssistantInputMealType,
  AiMealAssistantInputImageMimeType,
  AiMealAssistantResult,
  AiMealSuggestion,
} from "@workspace/api-client-react";

const MAX_IMAGE_BASE64_LENGTH = 11_184_812;

export default function AiMealsScreen() {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === "dark";
  const colors = Colors[isDark ? "dark" : "light"];
  const router = useRouter();
  const { foodTriggers, meals, symptomLogs, addMenuItem } = useAppContext();

  const [mode, setMode] = useState<AiMealAssistantInputMode>("suggestions");
  const [mealType, setMealType] = useState<AiMealAssistantInputMealType>("any");
  const [preferences, setPreferences] = useState("");
  const [prompt, setPrompt] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<AiMealAssistantInputImageMimeType | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);

  const createAssistant = useCreateAiMealAssistant();
  const [result, setResult] = useState<AiMealAssistantResult | null>(null);

  const topPad = Platform.OS === "web" ? 67 + insets.top : insets.top;
  const bottomPad = insets.bottom + 16;

  const pickImage = async (useCamera: boolean) => {
    try {
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission required", "Camera permission is needed to scan food.");
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission required", "Photo library permission is needed.");
          return;
        }
      }

      const pickerResult = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.5,
            base64: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.5,
            base64: true,
          });

      if (!pickerResult.canceled && pickerResult.assets[0].base64) {
        const asset = pickerResult.assets[0];
        
        if (asset.base64 && asset.base64.length > MAX_IMAGE_BASE64_LENGTH) {
          Alert.alert("Image Too Large", "The selected image is too large. Please take or choose a smaller photo.");
          return;
        }

        setImageUri(asset.uri);
        setImageBase64(asset.base64 ?? null);
        
        let mime: AiMealAssistantInputImageMimeType = "image/jpeg";
        if (asset.mimeType === "image/png" || asset.mimeType === "image/webp") {
          mime = asset.mimeType;
        }
        setImageMime(mime);
        setMode("scan");
      }
    } catch (e) {
      Alert.alert("Error", "Could not pick image.");
    }
  };

  const handleGenerate = () => {
    if (!consentGiven) {
      Alert.alert("Consent Required", "Please check the consent box to proceed.");
      return;
    }

    if (mode === "scan" && !imageBase64) {
      Alert.alert("Image Required", "Please take or select a photo to scan.");
      return;
    }

    if (mode === "suggestions" && !prompt.trim()) {
      Alert.alert("Input Required", "Please tell the assistant what you are looking for.");
      return;
    }

    const safeFoods = foodTriggers
      .filter((item) => item.category === "safe")
      .map((item) => item.food);
    const triggerFoods = foodTriggers
      .filter((item) => item.category === "trigger" || item.category === "flareup")
      .map((item) => item.food);
    const recentMeals = meals.slice(-10).map(m => m.foodDetails);
    const recentSymptoms = symptomLogs.slice(-5).map(s => `Pain: ${s.pain}/10, Bloating: ${s.bloating}/10, Urgency: ${s.urgency}/10. Notes: ${s.notes}`);

    createAssistant.mutate({
      data: {
        mode,
        mealType,
        preferences: preferences.trim(),
        prompt: prompt.trim(),
        safeFoods,
        triggerFoods,
        recentMeals,
        recentSymptoms,
        ...(mode === "scan" && imageBase64 && imageMime ? { imageBase64, imageMimeType: imageMime } : {})
      }
    }, {
      onSuccess: (data) => {
        setResult(data);
      },
      onError: () => {
        Alert.alert("Error", "Failed to generate suggestions. Please try again.");
      }
    });
  };

  const handleAddSuggestion = async (suggestion: AiMealSuggestion) => {
    const d = new Date();
    const dayOfWeek = d.getDay() === 0 ? 6 : d.getDay() - 1;
    const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    const weekStart = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;

    let time = "12:00";
    if (suggestion.mealType === "breakfast") time = "08:00";
    if (suggestion.mealType === "lunch") time = "13:00";
    if (suggestion.mealType === "dinner") time = "19:00";
    if (suggestion.mealType === "snack") time = "15:00";

    try {
      await addMenuItem({
        weekStart,
        dayOfWeek,
        time,
        recipe: suggestion.title,
        notes: `${suggestion.description}\n\nIngredients: ${suggestion.ingredients.join(", ")}\n\nPrep: ${suggestion.preparation}`,
        links: [],
      });
      Alert.alert("Added to Menu", `"${suggestion.title}" was added to today's menu.`);
    } catch (e) {
      Alert.alert("Storage Error", "Failed to save the meal to your menu. Please try again.");
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "low": return colors.success;
      case "moderate": return colors.warning;
      case "high": return colors.destructive;
      default: return colors.textSecondary;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="x" size={24} color={colors.headerText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>AI Assistant</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <AutoHideScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}>
          <View style={[styles.safetyNote, { backgroundColor: colors.teal + "15", borderColor: colors.teal + "40" }]}>
            <Feather name="info" size={16} color={colors.teal} style={{ marginTop: 2 }} />
            <Text style={[styles.safetyNoteText, { color: colors.teal }]}>
              Safety Note: This tool provides AI-generated suggestions and is not a substitute for professional medical advice. Always consult your doctor before making significant dietary changes.
            </Text>
          </View>

          {!result ? (
            <View style={styles.setupCard}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>How can I help?</Text>
              
              <View style={[styles.modeSelector, { backgroundColor: colors.borderLight }]}>
                <TouchableOpacity 
                  style={[styles.modeBtn, mode === "suggestions" && { backgroundColor: colors.card, shadowColor: colors.shadow, shadowOpacity: 1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 }]} 
                  onPress={() => setMode("suggestions")}
                >
                  <Feather name="list" size={16} color={mode === "suggestions" ? colors.purple : colors.textSecondary} />
                  <Text style={[styles.modeText, { color: mode === "suggestions" ? colors.purple : colors.textSecondary }]}>Ideas</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modeBtn, mode === "scan" && { backgroundColor: colors.card, shadowColor: colors.shadow, shadowOpacity: 1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 }]} 
                  onPress={() => setMode("scan")}
                >
                  <Feather name="camera" size={16} color={mode === "scan" ? colors.purple : colors.textSecondary} />
                  <Text style={[styles.modeText, { color: mode === "scan" ? colors.purple : colors.textSecondary }]}>Scan</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Meal Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mealTypeScroll}>
                {(["any", "breakfast", "lunch", "dinner", "snack"] as AiMealAssistantInputMealType[]).map((mt) => (
                  <TouchableOpacity 
                    key={mt} 
                    onPress={() => setMealType(mt)} 
                    style={[styles.mealTypeBtn, { backgroundColor: colors.inputBg }, mealType === mt && { backgroundColor: colors.purple }]}
                  >
                    <Text style={[styles.mealTypeText, { color: mealType === mt ? "#fff" : colors.text }]}>{mt.charAt(0).toUpperCase() + mt.slice(1)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Dietary preferences</Text>
              <TextInput
                style={[styles.preferenceInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                placeholder="e.g. vegetarian, dairy-free, quick meals"
                placeholderTextColor={colors.placeholder}
                value={preferences}
                onChangeText={setPreferences}
                multiline
                numberOfLines={2}
              />

              {mode === "scan" && (
                <View style={styles.scanSection}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Food or Label Photo</Text>
                  {imageUri ? (
                    <View style={styles.imagePreviewContainer}>
                      <Image source={{ uri: imageUri }} style={[styles.imagePreview, { borderColor: colors.border }]} />
                      <TouchableOpacity style={[styles.removeImageBtn, { backgroundColor: colors.destructive }]} onPress={() => { setImageUri(null); setImageBase64(null); setImageMime(null); }}>
                        <Feather name="trash-2" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.photoActionRow}>
                      <TouchableOpacity style={[styles.photoActionBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]} onPress={() => pickImage(true)}>
                        <Feather name="camera" size={24} color={colors.purple} />
                        <Text style={[styles.photoActionText, { color: colors.text }]}>Take Photo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.photoActionBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]} onPress={() => pickImage(false)}>
                        <Feather name="image" size={24} color={colors.purple} />
                        <Text style={[styles.photoActionText, { color: colors.text }]}>Gallery</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>{mode === "suggestions" ? "What are you craving?" : "Additional Context (Optional)"}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                placeholder={mode === "suggestions" ? "e.g. Something warm, high protein..." : "e.g. This is a brand of crackers..."}
                placeholderTextColor={colors.placeholder}
                value={prompt}
                onChangeText={setPrompt}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity 
                style={[styles.consentRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]} 
                onPress={() => setConsentGiven(!consentGiven)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkbox, consentGiven && { backgroundColor: colors.purple, borderColor: colors.purple }]}>
                  {consentGiven && <Feather name="check" size={14} color="#fff" />}
                </View>
                <Text style={[styles.consentText, { color: colors.textSecondary }]}>
                  I consent to sending my request, selected photo, recent meals and symptoms, and safe/trigger food classifications to the AI service for processing. Please do not include identifying details. This is not medical advice.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.generateBtn, { backgroundColor: colors.purple }, (!consentGiven || createAssistant.isPending) && { opacity: 0.7 }]} 
                onPress={handleGenerate}
                disabled={!consentGiven || createAssistant.isPending}
              >
                {createAssistant.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name="cpu" size={20} color="#fff" />
                    <Text style={styles.generateBtnText}>{mode === "suggestions" ? "Generate Ideas" : "Analyze Food"}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.resultsContainer}>
              <TouchableOpacity style={styles.resetBtn} onPress={() => setResult(null)}>
                <Feather name="arrow-left" size={16} color={colors.purple} />
                <Text style={[styles.resetBtnText, { color: colors.purple }]}>New Request</Text>
              </TouchableOpacity>

              <View style={[styles.resultHeaderCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.resultHeadline, { color: colors.text }]}>{result.headline}</Text>
                <Text style={[styles.resultOverview, { color: colors.textSecondary }]}>{result.overview}</Text>
                
                {mode === "scan" && (
                  <View style={[styles.riskBadge, { backgroundColor: getRiskColor(result.riskLevel) + "20" }]}>
                    <Text style={[styles.riskBadgeText, { color: getRiskColor(result.riskLevel) }]}>
                      {result.riskLevel === "low" ? "Personal fit: Low concern" : 
                       result.riskLevel === "moderate" ? "Personal fit: Moderate concern" : 
                       result.riskLevel === "high" ? "Personal fit: High concern" : 
                       "Personal fit: Unknown"}
                    </Text>
                  </View>
                )}
              </View>

              {result.detectedFoods && result.detectedFoods.length > 0 && (
                <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.infoCardTitle, { color: colors.text }]}>Detected Foods</Text>
                  {result.detectedFoods.map((f, i) => (
                    <View key={i} style={styles.listItem}>
                      <View style={[styles.bullet, { backgroundColor: colors.textSecondary }]} />
                      <Text style={[styles.listItemText, { color: colors.textSecondary }]}>{f}</Text>
                    </View>
                  ))}
                </View>
              )}

              {result.considerations && result.considerations.length > 0 && (
                <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.infoCardTitle, { color: colors.text }]}>Gut Health Considerations</Text>
                  {result.considerations.map((c, i) => (
                    <View key={i} style={styles.listItem}>
                      <View style={[styles.bullet, { backgroundColor: colors.teal }]} />
                      <Text style={[styles.listItemText, { color: colors.textSecondary }]}>{c}</Text>
                    </View>
                  ))}
                </View>
              )}

              {result.suggestions && result.suggestions.length > 0 && (
                <View style={styles.suggestionsSection}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Meal Suggestions</Text>
                  {result.suggestions.map((s, i) => (
                    <View key={i} style={[styles.suggestionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={styles.suggestionHeader}>
                        <Text style={[styles.suggestionTitle, { color: colors.text }]}>{s.title}</Text>
                        <View style={[styles.suggestionType, { backgroundColor: colors.tealLight }]}>
                          <Text style={[styles.suggestionTypeText, { color: colors.teal }]}>{s.mealType}</Text>
                        </View>
                      </View>
                      <Text style={[styles.suggestionDesc, { color: colors.textSecondary }]}>{s.description}</Text>
                      
                      <Text style={[styles.suggestionSubTitle, { color: colors.text }]}>Ingredients:</Text>
                      <Text style={[styles.suggestionText, { color: colors.textSecondary }]}>{s.ingredients.join(", ")}</Text>
                      
                      <Text style={[styles.suggestionSubTitle, { color: colors.text }]}>Prep:</Text>
                      <Text style={[styles.suggestionText, { color: colors.textSecondary }]}>{s.preparation}</Text>
                      
                      <View style={[styles.rationaleBox, { backgroundColor: colors.inputBg }]}>
                        <Feather name="info" size={14} color={colors.purple} />
                        <Text style={[styles.rationaleText, { color: colors.textSecondary }]}>{s.rationale}</Text>
                      </View>

                      <TouchableOpacity style={[styles.addMenuBtn, { backgroundColor: colors.purple }]} onPress={() => handleAddSuggestion(s)}>
                        <Feather name="calendar" size={16} color="#fff" />
                        <Text style={styles.addMenuBtnText}>Add to Menu</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <Text style={[styles.disclaimer, { color: colors.textSecondary }]}>
                {result.disclaimer}
              </Text>
            </View>
          )}
        </AutoHideScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 16
  },
  headerBtn: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 18, fontWeight: "700" as const },
  scrollContent: { padding: 16 },
  
  setupCard: { padding: 4 },
  sectionTitle: { fontSize: 22, fontWeight: "700" as const, marginBottom: 16 },
  
  modeSelector: { 
    flexDirection: "row", 
    borderRadius: 12, 
    padding: 4,
    marginBottom: 24 
  },
  modeBtn: { 
    flex: 1, 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    paddingVertical: 10, 
    borderRadius: 10,
    gap: 8
  },
  modeText: { fontSize: 14, fontWeight: "600" as const },
  
  label: { fontSize: 14, fontWeight: "600" as const, marginBottom: 12, marginLeft: 4 },
  
  mealTypeScroll: { gap: 10, paddingBottom: 8, marginBottom: 16 },
  mealTypeBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  mealTypeText: { fontSize: 14, fontWeight: "500" as const },
  preferenceInput: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 14, minHeight: 68, textAlignVertical: "top", marginBottom: 16 },
  
  scanSection: { marginBottom: 16, marginTop: 8 },
  photoActionRow: { flexDirection: "row", gap: 12 },
  photoActionBtn: { 
    flex: 1, 
    alignItems: "center", 
    justifyContent: "center", 
    paddingVertical: 24, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderStyle: "dashed",
    gap: 8 
  },
  photoActionText: { fontSize: 14, fontWeight: "500" as const },
  
  imagePreviewContainer: { position: "relative", borderRadius: 16, overflow: "hidden" },
  imagePreview: { width: "100%", height: 200, borderWidth: 1, borderRadius: 16 },
  removeImageBtn: { 
    position: "absolute", 
    top: 12, 
    right: 12, 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    alignItems: "center", 
    justifyContent: "center", 
    elevation: 4 
  },
  
  input: { 
    borderWidth: 1, 
    borderRadius: 16, 
    padding: 16, 
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: "top",
    marginBottom: 16
  },
  
  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
    gap: 12
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#A89DC0",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18
  },

  safetyNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 10
  },
  safetyNoteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18
  },
  
  generateBtn: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    paddingVertical: 16, 
    borderRadius: 16, 
    gap: 8 
  },
  generateBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" as const },
  
  resultsContainer: { gap: 16 },
  resetBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginBottom: 8, paddingVertical: 8 },
  resetBtnText: { fontSize: 14, fontWeight: "600" as const },
  
  resultHeaderCard: { padding: 20, borderRadius: 16, borderWidth: 1 },
  resultHeadline: { fontSize: 20, fontWeight: "700" as const, marginBottom: 8 },
  resultOverview: { fontSize: 15, lineHeight: 22 },
  riskBadge: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginTop: 12 },
  riskBadgeText: { fontSize: 13, fontWeight: "700" as const },
  
  infoCard: { padding: 16, borderRadius: 16, borderWidth: 1 },
  infoCardTitle: { fontSize: 16, fontWeight: "600" as const, marginBottom: 12 },
  listItem: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8, paddingRight: 16 },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 8, marginRight: 12 },
  listItemText: { fontSize: 14, lineHeight: 20, flex: 1 },
  
  suggestionsSection: { marginTop: 8, gap: 16 },
  suggestionCard: { padding: 16, borderRadius: 16, borderWidth: 1 },
  suggestionHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8, gap: 12 },
  suggestionTitle: { fontSize: 18, fontWeight: "600" as const, flex: 1 },
  suggestionType: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  suggestionTypeText: { fontSize: 12, fontWeight: "600" as const },
  suggestionDesc: { fontSize: 14, marginBottom: 16 },
  
  suggestionSubTitle: { fontSize: 14, fontWeight: "600" as const, marginBottom: 4, marginTop: 8 },
  suggestionText: { fontSize: 14, lineHeight: 20 },
  
  rationaleBox: { flexDirection: "row", alignItems: "flex-start", padding: 12, borderRadius: 12, gap: 8, marginTop: 16, marginBottom: 16 },
  rationaleText: { fontSize: 13, flex: 1, lineHeight: 18 },
  
  addMenuBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 12, gap: 8 },
  addMenuBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" as const },
  
  disclaimer: { fontSize: 12, textAlign: "center", fontStyle: "italic", marginTop: 24, marginHorizontal: 16, lineHeight: 18 }
});
