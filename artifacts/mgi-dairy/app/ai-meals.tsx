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
  AiMealAssistantInputGutState,
  AiMealAssistantInputRedFlagSymptomsItem,
} from "@workspace/api-client-react";

const MAX_IMAGE_BASE64_LENGTH = 11_184_812;

export default function AiMealsScreen() {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === "dark";
  const colors = Colors[isDark ? "dark" : "light"];
  const router = useRouter();

  const {
    foodTriggers, meals, symptomLogs, addMenuItem,
    aiLearningEvents, addAiLearningEvent, clearAiLearningEvents, aiConsentGiven, setAiConsentGiven
  } = useAppContext();

  const [mode, setMode] = useState<AiMealAssistantInputMode>("suggestions");
  const [mealType, setMealType] = useState<AiMealAssistantInputMealType>("any");
  const [preferences, setPreferences] = useState("");
  const [prompt, setPrompt] = useState("");
  const [gutState, setGutState] = useState<AiMealAssistantInputGutState>("unknown");

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<AiMealAssistantInputImageMimeType | null>(null);

  const createAssistant = useCreateAiMealAssistant();
  const [result, setResult] = useState<AiMealAssistantResult | null>(null);

  // Learn Card State
  const [feedbackOutcome, setFeedbackOutcome] = useState<"worked_well" | "mixed" | "did_not_work" | null>(null);
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [feedbackSaved, setFeedbackSaved] = useState(false);

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
          mime = asset.mimeType as AiMealAssistantInputImageMimeType;
        }
        setImageMime(mime);
        setMode("scan");
      }
    } catch (e) {
      Alert.alert("Error", "Could not pick image.");
    }
  };

  const handleGenerate = () => {
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

    // Numeric-only symptoms to protect privacy
    const recentSymptoms = symptomLogs.slice(-5).map(s =>
      `Pain: ${s.pain}/10, Bloating: ${s.bloating}/10, Urgency: ${s.urgency}/10, StoolType: ${s.stoolType}`
    );

    // AI learning history without private notes
    const learningHistory = aiLearningEvents.slice(-10).map(e =>
      `Date: ${e.date}, Meal: ${e.mealLabel}, Outcome: ${e.outcome}, Gut State: ${e.gutState}`
    );

    const recentRawSymptoms = symptomLogs.slice(-5);
    const redFlagSymptomsSet = new Set<AiMealAssistantInputRedFlagSymptomsItem>();
    recentRawSymptoms.forEach(s => {
      if (s.pain >= 8) redFlagSymptomsSet.add("severe_pain");
      const notes = s.notes.toLowerCase();
      if (notes.includes("blood in stool") || notes.includes("bloody stool")) redFlagSymptomsSet.add("blood_in_stool");
      if (notes.includes("severe pain")) redFlagSymptomsSet.add("severe_pain");
      if (notes.includes("persistent vomiting")) redFlagSymptomsSet.add("persistent_vomiting");
      if (notes.includes("fainting")) redFlagSymptomsSet.add("fainting");
      if (notes.includes("dehydration")) redFlagSymptomsSet.add("dehydration");
      if (notes.includes("high fever")) redFlagSymptomsSet.add("high_fever");
      if (
        notes.includes("inability to keep fluids down") || notes.includes("inability to keep liquids down") ||
        notes.includes("can't keep fluids down") || notes.includes("can't keep liquids down") ||
        notes.includes("cannot keep fluids down") || notes.includes("cannot keep liquids down")
      ) {
        redFlagSymptomsSet.add("cannot_keep_fluids_down");
      }
    });
    const redFlagSymptoms = Array.from(redFlagSymptomsSet);

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
        redFlagSymptoms,
        gutState,
        learningHistory,
        ...(mode === "scan" && imageBase64 && imageMime ? { imageBase64, imageMimeType: imageMime } : {})
      }
    }, {
      onSuccess: (data) => {
        setResult(data);
        setFeedbackOutcome(null);
        setFeedbackNotes("");
        setFeedbackSaved(false);
      },
      onError: () => {
        Alert.alert("Error", "Failed to analyze food. Please try again.");
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
      Alert.alert("Added to Menu", `"${suggestion.title}" was added to your menu.`);
    } catch (e) {
      Alert.alert("Storage Error", "Failed to save the meal to your menu. Please try again.");
    }
  };

  const handleSaveFeedback = async () => {
    if (!result || !feedbackOutcome) return;

    const mealLabel = result.suggestions?.[0]?.title || result.detectedFoods?.[0] || "Analyzed Meal";
    const date = new Date().toISOString().split("T")[0];

    try {
      await addAiLearningEvent({
        date,
        mealLabel,
        outcome: feedbackOutcome,
        gutState,
        notes: feedbackNotes.trim()
      });
      setFeedbackSaved(true);
    } catch (e) {
      Alert.alert("Error", "Could not save learning event.");
    }
  };

  const getActionColors = (action: string) => {
    switch (action) {
      case "eat": return { bg: colors.success + "20", text: colors.success };
      case "limit": return { bg: colors.warning + "20", text: colors.warning };
      case "swap": return { bg: colors.warning + "20", text: colors.warning };
      case "avoid": return { bg: colors.destructive + "20", text: colors.destructive };
      case "observe": return { bg: colors.purple + "20", text: colors.purple };
      case "seek_care": return { bg: colors.destructive + "20", text: colors.destructive };
      default: return { bg: colors.border, text: colors.textSecondary };
    }
  };

  const getFitColors = (fit: string) => {
    switch (fit) {
      case "good_fit": return { bg: colors.success + "20", text: colors.success };
      case "use_caution": return { bg: colors.warning + "20", text: colors.warning };
      case "high_caution": return { bg: colors.destructive + "20", text: colors.destructive };
      case "unclear": return { bg: colors.border, text: colors.textSecondary };
      default: return { bg: colors.border, text: colors.textSecondary };
    }
  };

  const formatFitLevel = (fit: string) => {
    return fit.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  };

  // -------------------------------------------------------------
  // CONSENT SCREEN
  // -------------------------------------------------------------
  if (!aiConsentGiven) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Feather name="x" size={24} color={colors.headerText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.headerText }]}>Food Guide</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad, gap: 24 }]}>
          <View style={styles.consentIconContainer}>
            <Feather name="cpu" size={48} color={colors.purple} />
          </View>

          <Text style={[styles.consentTitle, { color: colors.text }]}>Privacy & Consent</Text>

          <Text style={[styles.consentDesc, { color: colors.textSecondary }]}>
            The Food Guide uses Google Gemini to analyze your meals and provide personalized guidance based on your gut health.
          </Text>

          <View style={[styles.consentBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.consentBoxTitle, { color: colors.text }]}>What is sent to the AI server?</Text>
            <View style={styles.consentList}>
              <View style={styles.consentItem}><Feather name="check" size={16} color={colors.success} /><Text style={[styles.consentItemText, { color: colors.textSecondary }]}>Selected photos & prompt</Text></View>
              <View style={styles.consentItem}><Feather name="check" size={16} color={colors.success} /><Text style={[styles.consentItemText, { color: colors.textSecondary }]}>Safe and trigger food names</Text></View>
              <View style={styles.consentItem}><Feather name="check" size={16} color={colors.success} /><Text style={[styles.consentItemText, { color: colors.textSecondary }]}>Recent meal names</Text></View>
              <View style={styles.consentItem}><Feather name="check" size={16} color={colors.success} /><Text style={[styles.consentItemText, { color: colors.textSecondary }]}>Numeric symptom check-ins and urgent-symptom flags</Text></View>
              <View style={styles.consentItem}><Feather name="check" size={16} color={colors.success} /><Text style={[styles.consentItemText, { color: colors.textSecondary }]}>Gut state & prior outcome labels</Text></View>
            </View>

            <Text style={[styles.consentBoxTitle, { color: colors.text, marginTop: 16 }]}>What stays local?</Text>
            <View style={styles.consentList}>
              <View style={styles.consentItem}><Feather name="lock" size={16} color={colors.purple} /><Text style={[styles.consentItemText, { color: colors.textSecondary }]}>Raw symptom notes</Text></View>
              <View style={styles.consentItem}><Feather name="lock" size={16} color={colors.purple} /><Text style={[styles.consentItemText, { color: colors.textSecondary }]}>Feedback notes</Text></View>
              <View style={styles.consentItem}><Feather name="lock" size={16} color={colors.purple} /><Text style={[styles.consentItemText, { color: colors.textSecondary }]}>Identity and credentials</Text></View>
            </View>
          </View>

          <View style={[styles.safetyNote, { backgroundColor: colors.teal + "15", borderColor: colors.teal + "40" }]}>
            <Feather name="info" size={16} color={colors.teal} style={{ marginTop: 2 }} />
            <Text style={[styles.safetyNoteText, { color: colors.teal }]}>
              Urgent flags cause a fixed safety response without Gemini processing. The AI provides general guidance, not medical advice. Never rely on it during a medical emergency.
            </Text>
          </View>

          <Text style={[styles.consentNote, { color: colors.textSecondary }]}>
            You can withdraw consent and delete your learning history at any time using the shield icon.
          </Text>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.purple }]}
            onPress={async () => {
              try {
                await setAiConsentGiven(true);
              } catch (e) {
                Alert.alert("Storage Error", "Could not save your consent. Please try again.");
              }
            }}
          >
            <Text style={styles.primaryBtnText}>I Understand and Consent</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // -------------------------------------------------------------
  // MAIN FLOW
  // -------------------------------------------------------------
  const flowActiveStep = result ? 3 : 1; // 1=Capture/Connect, 3=Guide/Learn

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="x" size={24} color={colors.headerText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Food Guide</Text>
        <TouchableOpacity
          onPress={() => {
            Alert.alert("AI Data Controls", "Manage your AI consent and learning data.", [
              { text: "Cancel", style: "cancel" },
              { text: "Withdraw Gemini Consent", onPress: async () => {
                try {
                  await setAiConsentGiven(false);
                  setResult(null);
                  Alert.alert("Consent Withdrawn", "You have withdrawn Gemini consent. Your learning history was not deleted.");
                } catch (e) {
                  Alert.alert("Storage Error", "Could not withdraw consent. Please try again.");
                }
              }},
              { text: "Delete Learning History", style: "destructive", onPress: () => {
                Alert.alert(
                  "Delete Learning History?",
                  "This will permanently remove all saved meal outcomes and local feedback notes connected to the Food Guide. This cannot be undone.",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete Permanently", style: "destructive", onPress: async () => {
                        try {
                          await clearAiLearningEvents();
                          Alert.alert("History Deleted", "Your AI learning history and feedback notes have been removed.");
                        } catch (e) {
                          Alert.alert("Storage Error", "Could not delete learning history. Please try again.");
                        }
                    }}
                  ]
                );
              }}
            ]);
          }}
          style={styles.headerBtn}
        >
          <Feather name="shield" size={20} color={colors.headerTextSecondary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.flowStrip, { backgroundColor: colors.surfaceElevated, borderBottomColor: colors.borderLight }]}>
        <View style={styles.flowStripInner}>
          <View style={styles.flowStep}>
            <Text style={[styles.flowStepText, flowActiveStep === 1 ? { color: colors.purple, fontWeight: "700" } : { color: colors.textSecondary }]}>Capture</Text>
          </View>
          <Feather name="chevron-right" size={14} color={colors.border} />
          <View style={styles.flowStep}>
            <Text style={[styles.flowStepText, flowActiveStep === 1 ? { color: colors.purple, fontWeight: "700" } : { color: colors.textSecondary }]}>Connect</Text>
          </View>
          <Feather name="chevron-right" size={14} color={colors.border} />
          <View style={styles.flowStep}>
            <Text style={[styles.flowStepText, flowActiveStep === 3 ? { color: colors.purple, fontWeight: "700" } : { color: colors.textSecondary }]}>Guide</Text>
          </View>
          <Feather name="chevron-right" size={14} color={colors.border} />
          <View style={styles.flowStep}>
            <Text style={[styles.flowStepText, flowActiveStep === 3 ? { color: colors.purple, fontWeight: "700" } : { color: colors.textSecondary }]}>Learn</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <AutoHideScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}>

          {/* CAPTURE & CONNECT STAGE */}
          {!result && (
            <View style={styles.stageContainer}>
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>1. Capture</Text>

                <View style={[styles.modeSelector, { backgroundColor: colors.borderLight }]}>
                  <TouchableOpacity
                    style={[styles.modeBtn, mode === "suggestions" && { backgroundColor: colors.card, elevation: 2 }]}
                    onPress={() => setMode("suggestions")}
                  >
                    <Feather name="list" size={14} color={mode === "suggestions" ? colors.purple : colors.textSecondary} />
                    <Text style={[styles.modeText, { color: mode === "suggestions" ? colors.purple : colors.textSecondary }]}>Ideas</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modeBtn, mode === "scan" && { backgroundColor: colors.card, elevation: 2 }]}
                    onPress={() => setMode("scan")}
                  >
                    <Feather name="camera" size={14} color={mode === "scan" ? colors.purple : colors.textSecondary} />
                    <Text style={[styles.modeText, { color: mode === "scan" ? colors.purple : colors.textSecondary }]}>Scan</Text>
                  </TouchableOpacity>
                </View>

                {mode === "scan" && (
                  <View style={styles.scanSection}>
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

                <Text style={[styles.label, { color: colors.textSecondary, marginTop: mode === "scan" ? 8 : 0 }]}>Meal Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                  {(["any", "breakfast", "lunch", "dinner", "snack"] as AiMealAssistantInputMealType[]).map((mt) => (
                    <TouchableOpacity
                      key={mt}
                      onPress={() => setMealType(mt)}
                      style={[styles.chip, { backgroundColor: mealType === mt ? colors.purple : colors.inputBg }]}
                    >
                      <Text style={[styles.chipText, { color: mealType === mt ? "#fff" : colors.text }]}>
                        {mt.charAt(0).toUpperCase() + mt.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>Dietary preferences (optional)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border, minHeight: 60 }]}
                  placeholder="e.g. vegetarian, dairy-free"
                  placeholderTextColor={colors.placeholder}
                  value={preferences}
                  onChangeText={setPreferences}
                />

                <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>
                  {mode === "suggestions" ? "What are you craving?" : "Additional Context (Optional)"}
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  placeholder={mode === "suggestions" ? "e.g. Something warm, high protein..." : "e.g. This is a brand of crackers..."}
                  placeholderTextColor={colors.placeholder}
                  value={prompt}
                  onChangeText={setPrompt}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 16 }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>2. Connect</Text>
                <Text style={[styles.label, { color: colors.textSecondary, marginTop: 4 }]}>How is your gut feeling today?</Text>

                <View style={styles.gutStateGrid}>
                  {(["steady", "recovering", "sensitive", "flare", "unknown"] as AiMealAssistantInputGutState[]).map((st) => (
                    <TouchableOpacity
                      key={st}
                      onPress={() => setGutState(st)}
                      style={[
                        styles.gutStateChip,
                        { backgroundColor: colors.inputBg, borderColor: colors.borderLight },
                        gutState === st && { backgroundColor: colors.teal + "15", borderColor: colors.teal }
                      ]}
                    >
                      <Text style={[styles.gutStateText, { color: gutState === st ? colors.teal : colors.textSecondary, fontWeight: gutState === st ? "600" : "500" }]}>
                        {st.charAt(0).toUpperCase() + st.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.connectionNote}>
                  <Feather name="refresh-cw" size={14} color={colors.textSecondary} />
                  <Text style={[styles.connectionNoteText, { color: colors.textSecondary }]}>
                    Connecting {aiLearningEvents.length} learning events and recent symptom check-ins.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.purple, marginTop: 24 }, createAssistant.isPending && { opacity: 0.7 }]}
                onPress={handleGenerate}
                disabled={createAssistant.isPending}
              >
                {createAssistant.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name="cpu" size={20} color="#fff" />
                    <Text style={styles.primaryBtnText}>{mode === "suggestions" ? "Generate Guide" : "Analyze Food"}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* GUIDE & LEARN STAGE */}
          {result && (
            <View style={styles.stageContainer}>
              <TouchableOpacity style={styles.resetBtn} onPress={() => setResult(null)}>
                <Feather name="arrow-left" size={16} color={colors.purple} />
                <Text style={[styles.resetBtnText, { color: colors.purple }]}>New Analysis</Text>
              </TouchableOpacity>

              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, result.guidanceAction === "seek_care" && { borderColor: colors.destructive, backgroundColor: colors.destructive + "10" }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }, result.guidanceAction === "seek_care" && { color: colors.destructive }]}>3. Guide</Text>

                <Text style={[styles.resultHeadline, { color: colors.text }, result.guidanceAction === "seek_care" && { color: colors.destructive }]}>{result.headline}</Text>
                <Text style={[styles.resultOverview, { color: colors.textSecondary }]}>{result.overview}</Text>

                <View style={styles.resultBadges}>
                  <View style={[styles.badge, { backgroundColor: getActionColors(result.guidanceAction).bg }]}>
                    <Text style={[styles.badgeText, { color: getActionColors(result.guidanceAction).text }]}>
                      Action: {result.guidanceAction.toUpperCase().replace("_", " ")}
                    </Text>
                  </View>
                  {result.guidanceAction !== "seek_care" && (
                    <View style={[styles.badge, { backgroundColor: getFitColors(result.personalFitLevel).bg }]}>
                      <Text style={[styles.badgeText, { color: getFitColors(result.personalFitLevel).text }]}>
                        Fit: {formatFitLevel(result.personalFitLevel)}
                      </Text>
                    </View>
                  )}
                </View>

                {result.guidanceSummary && (
                  <View style={[styles.summaryBox, { backgroundColor: colors.inputBg }, result.guidanceAction === "seek_care" && { backgroundColor: colors.destructive + "20" }]}>
                    <Text style={[styles.summaryText, { color: colors.textSecondary }, result.guidanceAction === "seek_care" && { color: colors.destructive, fontWeight: "600" }]}>{result.guidanceSummary}</Text>
                  </View>
                )}
              </View>

              {(result.evidence?.length > 0) && (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 16 }]}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Why this answer?</Text>
                  <View style={styles.evidenceList}>
                    {result.evidence.map((ev, i) => (
                      <View key={i} style={styles.evidenceItem}>
                        <View style={styles.evidenceIcon}>
                          {ev.signal === "support" ? <Feather name="check-circle" size={18} color={colors.success} /> :
                           ev.signal === "caution" ? <Feather name="alert-triangle" size={18} color={colors.warning} /> :
                           <Feather name="info" size={18} color={colors.textSecondary} />}
                        </View>
                        <View style={styles.evidenceContent}>
                          <Text style={[styles.evidenceTitle, { color: colors.text }]}>{ev.title}</Text>
                          <Text style={[styles.evidenceDetail, { color: colors.textSecondary }]}>{ev.detail}</Text>
                        </View>
                      </View>
                    ))}
                  </View>

                  <View style={styles.contextUsedRow}>
                    <Text style={[styles.contextUsedTitle, { color: colors.textSecondary }]}>Context Used:</Text>
                    <Text style={[styles.contextUsedStats, { color: colors.textSecondary }]}>
                      {result.contextUsed?.safeFoods || 0} Safe, {result.contextUsed?.triggerFoods || 0} Triggers, {result.contextUsed?.symptomCheckIns || 0} Logs, {result.contextUsed?.learningEvents || 0} Learnings
                    </Text>
                  </View>
                </View>
              )}

              {((result.detectedFoods && result.detectedFoods.length > 0) || (result.considerations && result.considerations.length > 0) || (result.swaps && result.swaps.length > 0) || (result.watchFor && result.watchFor.length > 0)) && (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 16 }]}>
                  {result.detectedFoods && result.detectedFoods.length > 0 && (
                    <View style={styles.listSection}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>Detected Foods</Text>
                      {result.detectedFoods.map((f, i) => (
                        <View key={i} style={styles.listItem}>
                          <View style={[styles.bullet, { backgroundColor: colors.textSecondary }]} />
                          <Text style={[styles.listItemText, { color: colors.textSecondary }]}>{f}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {result.watchFor && result.watchFor.length > 0 && (
                    <View style={[styles.listSection, (result.detectedFoods?.length) ? { marginTop: 16 } : {}]}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>Watch For</Text>
                      {result.watchFor.map((w, i) => (
                        <View key={i} style={styles.listItem}>
                          <View style={[styles.bullet, { backgroundColor: colors.warning }]} />
                          <Text style={[styles.listItemText, { color: colors.textSecondary }]}>{w}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {result.swaps && result.swaps.length > 0 && (
                    <View style={[styles.listSection, (result.detectedFoods?.length || result.watchFor?.length) ? { marginTop: 16 } : {}]}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>Suggested Swaps</Text>
                      {result.swaps.map((s, i) => (
                        <View key={i} style={styles.listItem}>
                          <View style={[styles.bullet, { backgroundColor: colors.success }]} />
                          <Text style={[styles.listItemText, { color: colors.textSecondary }]}>{s}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {result.considerations && result.considerations.length > 0 && (
                    <View style={[styles.listSection, (result.detectedFoods?.length || result.watchFor?.length || result.swaps?.length) ? { marginTop: 16 } : {}]}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>Considerations</Text>
                      {result.considerations.map((c, i) => (
                        <View key={i} style={styles.listItem}>
                          <View style={[styles.bullet, { backgroundColor: colors.teal }]} />
                          <Text style={[styles.listItemText, { color: colors.textSecondary }]}>{c}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {result.suggestions && result.suggestions.length > 0 && (
                <View style={styles.suggestionsSection}>
                  <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16 }]}>Meal Suggestions</Text>
                  {result.suggestions.map((s, i) => (
                    <View key={i} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={styles.suggestionHeader}>
                        <Text style={[styles.suggestionTitle, { color: colors.text }]}>{s.title}</Text>
                        <View style={[styles.badge, { backgroundColor: colors.tealLight }]}>
                          <Text style={[styles.badgeText, { color: colors.teal }]}>{s.mealType}</Text>
                        </View>
                      </View>
                      <Text style={[styles.suggestionDesc, { color: colors.textSecondary }]}>{s.description}</Text>

                      <Text style={[styles.suggestionSubTitle, { color: colors.text }]}>Ingredients:</Text>
                      <Text style={[styles.suggestionText, { color: colors.textSecondary }]}>{s.ingredients.join(", ")}</Text>

                      <Text style={[styles.suggestionSubTitle, { color: colors.text }]}>Prep:</Text>
                      <Text style={[styles.suggestionText, { color: colors.textSecondary }]}>{s.preparation}</Text>

                      <View style={[styles.summaryBox, { backgroundColor: colors.inputBg, marginTop: 12, marginBottom: 16 }]}>
                        <Text style={[styles.summaryText, { color: colors.textSecondary }]}>{s.rationale}</Text>
                      </View>

                      <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.purple, paddingVertical: 12 }]} onPress={() => handleAddSuggestion(s)}>
                        <Feather name="calendar" size={16} color="#fff" />
                        <Text style={[styles.primaryBtnText, { fontSize: 14 }]}>Add to Menu</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* LEARN STAGE */}
              <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, marginTop: 24, borderWidth: 2 }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>4. Learn</Text>

                {feedbackSaved ? (
                  <View style={styles.feedbackSuccess}>
                    <Feather name="check-circle" size={32} color={colors.success} />
                    <Text style={[styles.feedbackSuccessTitle, { color: colors.text }]}>Learning Saved</Text>
                    <Text style={[styles.feedbackSuccessText, { color: colors.textSecondary }]}>
                      This outcome has been connected to your profile and will shape future guidance.
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.feedbackPrompt, { color: colors.text }]}>
                      {result.learningPrompt || "How did this meal work for you?"}
                    </Text>

                    <View style={styles.feedbackChips}>
                      <TouchableOpacity
                        style={[styles.feedbackChip, feedbackOutcome === "worked_well" && { backgroundColor: colors.success + "20", borderColor: colors.success }]}
                        onPress={() => setFeedbackOutcome("worked_well")}
                      >
                        <Feather name="smile" size={16} color={feedbackOutcome === "worked_well" ? colors.success : colors.textSecondary} />
                        <Text style={[styles.feedbackChipText, { color: feedbackOutcome === "worked_well" ? colors.success : colors.textSecondary }]}>Worked well</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.feedbackChip, feedbackOutcome === "mixed" && { backgroundColor: colors.warning + "20", borderColor: colors.warning }]}
                        onPress={() => setFeedbackOutcome("mixed")}
                      >
                        <Feather name="meh" size={16} color={feedbackOutcome === "mixed" ? colors.warning : colors.textSecondary} />
                        <Text style={[styles.feedbackChipText, { color: feedbackOutcome === "mixed" ? colors.warning : colors.textSecondary }]}>Mixed</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.feedbackChip, feedbackOutcome === "did_not_work" && { backgroundColor: colors.destructive + "20", borderColor: colors.destructive }]}
                        onPress={() => setFeedbackOutcome("did_not_work")}
                      >
                        <Feather name="frown" size={16} color={feedbackOutcome === "did_not_work" ? colors.destructive : colors.textSecondary} />
                        <Text style={[styles.feedbackChipText, { color: feedbackOutcome === "did_not_work" ? colors.destructive : colors.textSecondary }]}>Did not work</Text>
                      </TouchableOpacity>
                    </View>

                    {feedbackOutcome && (
                      <>
                        <TextInput
                          style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border, marginTop: 16 }]}
                          placeholder="Private notes (optional) - stays on this device"
                          placeholderTextColor={colors.placeholder}
                          value={feedbackNotes}
                          onChangeText={setFeedbackNotes}
                          multiline
                          numberOfLines={2}
                        />
                        <TouchableOpacity
                          style={[styles.primaryBtn, { backgroundColor: colors.teal, marginTop: 16 }]}
                          onPress={handleSaveFeedback}
                        >
                          <Feather name="save" size={18} color="#fff" />
                          <Text style={styles.primaryBtnText}>Save to Learning History</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </>
                )}
              </View>

              <Text style={[styles.disclaimer, { color: colors.textSecondary }]}>
                {result.disclaimer}
                {"\n"}Not medical advice. Seek emergency care immediately if experiencing severe symptoms.
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

  flowStrip: { borderBottomWidth: 1, paddingVertical: 12, paddingHorizontal: 16 },
  flowStripInner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  flowStep: { flex: 1, alignItems: "center" },
  flowStepText: { fontSize: 12, fontWeight: "500" as const },

  stageContainer: { gap: 16 },

  card: { padding: 20, borderRadius: 16, borderWidth: 1 },
  sectionTitle: { fontSize: 20, fontWeight: "700" as const, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: "700" as const, marginBottom: 12 },

  modeSelector: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20
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

  label: { fontSize: 14, fontWeight: "600" as const, marginBottom: 10 },

  chipsScroll: { gap: 8, paddingBottom: 4 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  chipText: { fontSize: 14, fontWeight: "500" as const },

  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: "top",
  },

  scanSection: { marginBottom: 20 },
  photoActionRow: { flexDirection: "row", gap: 12 },
  photoActionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    gap: 8
  },
  photoActionText: { fontSize: 14, fontWeight: "500" as const },
  imagePreviewContainer: { position: "relative", borderRadius: 14, overflow: "hidden" },
  imagePreview: { width: "100%", height: 180, borderWidth: 1, borderRadius: 14 },
  removeImageBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4
  },

  gutStateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  gutStateChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  gutStateText: { fontSize: 14 },
  connectionNote: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16 },
  connectionNoteText: { fontSize: 12, fontStyle: "italic" },

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" as const },

  resetBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginBottom: 8, paddingVertical: 8 },
  resetBtnText: { fontSize: 14, fontWeight: "600" as const },

  resultHeadline: { fontSize: 22, fontWeight: "800" as const, marginBottom: 8 },
  resultOverview: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
  resultBadges: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: "700" as const },
  summaryBox: { padding: 14, borderRadius: 12 },
  summaryText: { fontSize: 14, lineHeight: 20 },

  evidenceList: { gap: 12 },
  evidenceItem: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  evidenceIcon: { width: 24, alignItems: "center", marginTop: 2 },
  evidenceContent: { flex: 1 },
  evidenceTitle: { fontSize: 14, fontWeight: "600" as const, marginBottom: 2 },
  evidenceDetail: { fontSize: 13, lineHeight: 18 },

  contextUsedRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.05)" },
  contextUsedTitle: { fontSize: 12, fontWeight: "600" as const },
  contextUsedStats: { fontSize: 12 },

  listSection: { gap: 8 },
  listItem: { flexDirection: "row", alignItems: "flex-start", paddingRight: 16 },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 8, marginRight: 12 },
  listItemText: { fontSize: 14, lineHeight: 20, flex: 1 },

  suggestionsSection: { gap: 16 },
  suggestionHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8, gap: 12 },
  suggestionTitle: { fontSize: 18, fontWeight: "600" as const, flex: 1 },
  suggestionDesc: { fontSize: 14, marginBottom: 16 },
  suggestionSubTitle: { fontSize: 14, fontWeight: "600" as const, marginBottom: 4, marginTop: 8 },
  suggestionText: { fontSize: 14, lineHeight: 20 },

  feedbackPrompt: { fontSize: 16, fontWeight: "600" as const, marginBottom: 16, textAlign: "center" },
  feedbackChips: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  feedbackChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: "transparent" },
  feedbackChipText: { fontSize: 14, fontWeight: "600" as const },
  feedbackSuccess: { alignItems: "center", paddingVertical: 20, gap: 12 },
  feedbackSuccessTitle: { fontSize: 18, fontWeight: "700" as const },
  feedbackSuccessText: { fontSize: 14, textAlign: "center", paddingHorizontal: 20 },

  disclaimer: { fontSize: 12, textAlign: "center", fontStyle: "italic", marginTop: 16, marginHorizontal: 16, lineHeight: 18 },

  consentIconContainer: { alignItems: "center", marginTop: 24, marginBottom: 8 },
  consentTitle: { fontSize: 28, fontWeight: "800" as const, textAlign: "center", marginBottom: 8 },
  consentDesc: { fontSize: 15, lineHeight: 22, textAlign: "center", marginBottom: 24 },
  consentBox: { padding: 20, borderRadius: 16, borderWidth: 1 },
  consentBoxTitle: { fontSize: 16, fontWeight: "700" as const, marginBottom: 12 },
  consentList: { gap: 12 },
  consentItem: { flexDirection: "row", alignItems: "center", gap: 12 },
  consentItemText: { fontSize: 14, flex: 1 },
  safetyNote: { flexDirection: "row", alignItems: "flex-start", padding: 16, borderRadius: 12, borderWidth: 1, marginTop: 8, gap: 12 },
  safetyNoteText: { flex: 1, fontSize: 13, lineHeight: 18 },
  consentNote: { fontSize: 13, textAlign: "center", marginHorizontal: 16, marginBottom: 8 }
});