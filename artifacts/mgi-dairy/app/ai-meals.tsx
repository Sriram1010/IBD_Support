import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Platform, useColorScheme, KeyboardAvoidingView, ActivityIndicator, Image
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import { useApp as useAppContext } from "@/context/AppContext";
import Colors from "@/constants/colors";
import { AutoHideScrollView } from "@/components/AutoHideScrollView";
import { ProfileSettingsButton } from "@/components/ProfileSettingsButton";
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
  const isGuideTab = usePathname() === "/guide";

  const {
    foodTriggers, meals, symptomLogs, addMenuItem,
    aiLearningEvents, addAiLearningEvent, clearAiLearningEvents, aiConsentGiven, setAiConsentGiven
  } = useAppContext();

  const [mode, setMode] = useState<AiMealAssistantInputMode>("suggestions");
  const [mealType, setMealType] = useState<AiMealAssistantInputMealType>("any");
  const [preferences, setPreferences] = useState("");
  const [prompt, setPrompt] = useState("");
  const [gutState, setGutState] = useState<AiMealAssistantInputGutState>("unknown");
  const [shortcut, setShortcut] = useState<"check" | "reaction" | "ideas">("ideas");
  const [reactionOutcome, setReactionOutcome] = useState<"worked_well" | "mixed" | "did_not_work" | null>(null);
  const [reactionNotes, setReactionNotes] = useState("");
  const [reactionSaved, setReactionSaved] = useState(false);

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

  const handleSaveReaction = async () => {
    const latestMeal = meals[meals.length - 1];
    if (!latestMeal || !reactionOutcome) return;
    try {
      await addAiLearningEvent({
        date: new Date().toISOString().split("T")[0],
        mealLabel: latestMeal.foodDetails,
        outcome: reactionOutcome,
        gutState,
        notes: reactionNotes.trim(),
      });
      setReactionSaved(true);
    } catch {
      Alert.alert("Storage Error", "Could not save your reaction. Please try again.");
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
        <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.borderLight }]}>
          {isGuideTab ? <View style={styles.headerBtn} /> : (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
              <Feather name="x" size={22} color={colors.text} />
            </TouchableOpacity>
          )}
          <Text style={[styles.headerTitle, { color: colors.text }]}>Food Guide</Text>
          <ProfileSettingsButton color={colors.text} />
        </View>

        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad, gap: 24 }]}>
          <View style={[styles.consentIconContainer, { backgroundColor: colors.tealLight }]}>
            <Feather name="heart" size={34} color={colors.teal} />
          </View>

          <Text style={[styles.consentTitle, { color: colors.text }]}>A thoughtful guide,{"\n"}on your terms.</Text>

          <Text style={[styles.consentDesc, { color: colors.textSecondary }]}>
              Before we begin: Food Guide uses Google Gemini to analyze meals and offer personalized gut-health guidance. You decide when to share.
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
            <Text style={[styles.primaryBtnText, { color: colors.background }]}>I Understand and Consent</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // -------------------------------------------------------------
  // MAIN FLOW
  // -------------------------------------------------------------
  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.borderLight }]}>
        <View style={styles.headerSide}>
          {isGuideTab ? <View style={styles.headerBtn} /> : (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
              <Feather name="arrow-left" size={21} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Food Guide <Text style={{ color: colors.teal }}>·</Text></Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Manage AI consent and learning data"
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
            <Feather name="shield" size={20} color={colors.teal} />
          </TouchableOpacity>
          <ProfileSettingsButton color={colors.text} />
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <AutoHideScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 24 }]}>

          {/* CAPTURE & CONNECT STAGE */}
          {!result && (
            <View style={styles.stageContainer}>
              <View style={styles.hero}>
                <View style={[styles.heroMark, { backgroundColor: colors.gold + "25" }]}>
                  <Feather name="heart" size={18} color={colors.goldText} />
                </View>
                <Text style={[styles.eyebrow, { color: colors.teal }]}>YOUR FOOD COMPANION</Text>
                <Text style={[styles.heroTitle, { color: colors.text }]}>A little clarity{"\n"}for your next bite.</Text>
                <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>Ask about a food, scan a plate, or find an idea shaped by what you’ve learned.</Text>
              </View>

              <View style={styles.shortcutRow}>
                {([
                  { key: "check", title: "Check food", icon: "search" },
                  { key: "reaction", title: "Log reaction", icon: "activity" },
                  { key: "ideas", title: "Recipe ideas", icon: "book-open" },
                ] as const).map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    testID={`food-guide-${item.key}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: shortcut === item.key }}
                    style={[styles.shortcut, { backgroundColor: shortcut === item.key ? colors.gold + "29" : colors.card, borderColor: shortcut === item.key ? colors.gold : colors.border }]}
                    onPress={() => { setShortcut(item.key); if (item.key === "check") setMode("scan"); if (item.key === "ideas") setMode("suggestions"); }}
                  >
                    <Feather name={item.icon} size={15} color={shortcut === item.key ? colors.purple : colors.textSecondary} />
                    <Text style={[styles.shortcutText, { color: colors.text }]}>{item.title}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {shortcut === "reaction" ? (
                <View style={[styles.composer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.composerHeading}>
                    <View style={[styles.smallIcon, { backgroundColor: colors.tealLight }]}><Feather name="activity" size={19} color={colors.teal} /></View>
                    <View style={{ flex: 1 }}><Text style={[styles.composerTitle, { color: colors.text }]}>How did it sit?</Text><Text style={[styles.composerHint, { color: colors.textSecondary }]}>A private note for your future guidance</Text></View>
                  </View>
                  {meals.length === 0 ? (
                    <View style={[styles.inlineNotice, { backgroundColor: colors.inputBg }]}>
                      <Feather name="coffee" size={20} color={colors.teal} />
                      <Text style={[styles.inlineNoticeText, { color: colors.textSecondary }]}>No meals logged yet. Add a meal in your diary first, or check a food here.</Text>
                    </View>
                  ) : reactionSaved ? (
                    <View style={[styles.inlineNotice, { backgroundColor: colors.tealLight }]}>
                      <Feather name="check-circle" size={20} color={colors.teal} />
                      <Text style={[styles.inlineNoticeText, { color: colors.text }]}>Reaction saved on this device.</Text>
                      <TouchableOpacity onPress={() => { setReactionSaved(false); setReactionOutcome(null); setReactionNotes(""); }} accessibilityLabel="Log another reaction"><Feather name="plus" size={20} color={colors.teal} /></TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <Text style={[styles.fieldCaption, { color: colors.textSecondary }]}>MOST RECENT MEAL</Text>
                      <Text style={[styles.recentMeal, { color: colors.text }]} numberOfLines={2}>{meals[meals.length - 1].foodDetails}</Text>
                      <View style={styles.feedbackChips}>
                        {([
                          { key: "worked_well", label: "Worked well", color: colors.success },
                          { key: "mixed", label: "Mixed", color: colors.warning },
                          { key: "did_not_work", label: "Did not work", color: colors.destructive },
                        ] as const).map((item) => (
                          <TouchableOpacity key={item.key} onPress={() => setReactionOutcome(item.key)} style={[styles.feedbackChip, { borderColor: reactionOutcome === item.key ? item.color : colors.border, backgroundColor: reactionOutcome === item.key ? item.color + "19" : colors.inputBg }]}>
                            <Text style={[styles.feedbackChipText, { color: reactionOutcome === item.key ? item.color : colors.textSecondary }]}>{item.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TextInput style={[styles.compactInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border, marginTop: 14 }]} placeholder="Private notes (optional) · stays on this device" placeholderTextColor={colors.placeholder} value={reactionNotes} onChangeText={setReactionNotes} multiline />
                      <TouchableOpacity onPress={handleSaveReaction} disabled={!reactionOutcome} style={[styles.primaryBtn, { backgroundColor: colors.purple, marginTop: 16, opacity: reactionOutcome ? 1 : 0.45 }]}><Text style={[styles.primaryBtnText, { color: colors.background }]}>Save reaction</Text><Feather name="arrow-right" size={17} color={colors.background} /></TouchableOpacity>
                    </>
                  )}
                </View>
              ) : (
                <>
                  <View style={[styles.composer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.composerHeading}>
                      <View style={[styles.smallIcon, { backgroundColor: colors.gold + "29" }]}><Feather name={mode === "scan" ? "camera" : "message-circle"} size={20} color={colors.purple} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.composerTitle, { color: colors.text }]}>{mode === "scan" ? "Check a food" : "What sounds good?"}</Text>
                        <Text style={[styles.composerHint, { color: colors.textSecondary }]}>{mode === "scan" ? "Start with a photo of your food" : "Tell me what you’re looking for"}</Text>
                      </View>
                    </View>
                    {mode === "scan" && (
                      imageUri ? (
                        <View style={styles.imagePreviewContainer}>
                          <Image source={{ uri: imageUri }} style={[styles.imagePreview, { borderColor: colors.border }]} />
                          <TouchableOpacity accessibilityLabel="Remove photo" style={[styles.removeImageBtn, { backgroundColor: colors.destructive }]} onPress={() => { setImageUri(null); setImageBase64(null); setImageMime(null); }}><Feather name="x" size={19} color={colors.background} /></TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.photoActionRow}>
                          <TouchableOpacity style={[styles.photoActionBtn, { backgroundColor: colors.gold + "20", borderColor: colors.gold + "80" }]} onPress={() => pickImage(true)}><Feather name="camera" size={19} color={colors.purple} /><Text style={[styles.photoActionText, { color: colors.text }]}>Camera</Text></TouchableOpacity>
                          <TouchableOpacity style={[styles.photoActionBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]} onPress={() => pickImage(false)}><Feather name="image" size={19} color={colors.purple} /><Text style={[styles.photoActionText, { color: colors.text }]}>Library</Text></TouchableOpacity>
                        </View>
                      )
                    )}
                    <TextInput
                      style={[styles.composerInput, { color: colors.text }]}
                      placeholder={mode === "scan" ? "Anything I should know about this food? (optional)" : "e.g. A comforting lunch without dairy..."}
                      placeholderTextColor={colors.placeholder}
                      value={prompt}
                      onChangeText={setPrompt}
                      multiline
                      numberOfLines={3}
                    />
                    <View style={[styles.composerFooter, { borderTopColor: colors.borderLight }]}>
                      <View style={styles.composerTools}>
                        <TouchableOpacity accessibilityLabel="Take food photo" onPress={() => pickImage(true)} style={[styles.toolBtn, { backgroundColor: colors.gold + "31" }]}><Feather name="camera" size={18} color={colors.purple} /></TouchableOpacity>
                        <TouchableOpacity accessibilityLabel="Choose food photo" onPress={() => pickImage(false)} style={[styles.toolBtn, { backgroundColor: colors.inputBg }]}><Feather name="image" size={18} color={colors.teal} /></TouchableOpacity>
                        <Text style={[styles.composerFootnote, { color: colors.textSecondary }]}>{mode === "scan" ? "Photo + context" : "Add a photo"}</Text>
                      </View>
                      <TouchableOpacity testID="food-guide-submit" accessibilityLabel={mode === "scan" ? "Analyze food" : "Get recipe ideas"} disabled={createAssistant.isPending} onPress={handleGenerate} style={[styles.sendBtn, { backgroundColor: colors.purple, opacity: createAssistant.isPending ? 0.55 : 1 }]}>
                        {createAssistant.isPending ? <ActivityIndicator size="small" color={colors.background} /> : <Feather name="arrow-up" size={21} color={colors.background} />}
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={[styles.contextPanel, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderLight }]}>
                    <View style={styles.contextHeading}><Feather name="sliders" size={16} color={colors.teal} /><Text style={[styles.contextHeadingText, { color: colors.text }]}>Make it yours</Text></View>
                    <Text style={[styles.fieldCaption, { color: colors.textSecondary }]}>HOW IS YOUR GUT TODAY?</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                      {(["unknown", "steady", "recovering", "sensitive", "flare"] as AiMealAssistantInputGutState[]).map((st) => (
                        <TouchableOpacity key={st} onPress={() => setGutState(st)} style={[styles.gutStateChip, { backgroundColor: gutState === st ? colors.tealLight : colors.card, borderColor: gutState === st ? colors.teal : colors.border }]}>
                          <Text style={[styles.gutStateText, { color: gutState === st ? colors.teal : colors.textSecondary }]}>{st === "unknown" ? "Not sure" : st.charAt(0).toUpperCase() + st.slice(1)}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <Text style={[styles.fieldCaption, { color: colors.textSecondary, marginTop: 18 }]}>MEAL TYPE</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                      {(["any", "breakfast", "lunch", "dinner", "snack"] as AiMealAssistantInputMealType[]).map((mt) => (
                        <TouchableOpacity key={mt} onPress={() => setMealType(mt)} style={[styles.chip, { backgroundColor: mealType === mt ? colors.purple : colors.card, borderColor: mealType === mt ? colors.purple : colors.border }]}>
                          <Text style={[styles.chipText, { color: mealType === mt ? colors.background : colors.textSecondary }]}>{mt === "any" ? "Any time" : mt.charAt(0).toUpperCase() + mt.slice(1)}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <TextInput style={[styles.compactInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border, marginTop: 18 }]} placeholder="Dietary preferences (optional)" placeholderTextColor={colors.placeholder} value={preferences} onChangeText={setPreferences} />
                    <View style={[styles.connectionNote, { borderTopColor: colors.border }]}>
                      <Feather name="lock" size={13} color={colors.teal} />
                      <Text style={[styles.connectionNoteText, { color: colors.textSecondary }]}>Using {foodTriggers.filter(f => f.category === "safe").length} safe foods · {foodTriggers.filter(f => f.category === "trigger" || f.category === "flareup").length} triggers · {Math.min(symptomLogs.length, 5)} check-ins · {Math.min(aiLearningEvents.length, 10)} outcomes</Text>
                    </View>
                  </View>
                  <Text style={[styles.disclaimer, { color: colors.textSecondary }]}>Gemini receives your prompt, chosen photo, food names, recent meal names, numeric symptoms, urgent flags and outcome labels. Raw symptom and feedback notes stay on this device. General guidance only, not medical advice.</Text>
                </>
              )}
            </View>
          )}

          {/* GUIDE & LEARN STAGE */}
          {result && (
            <View style={styles.stageContainer}>
              <TouchableOpacity style={[styles.resetBtn, { backgroundColor: colors.gold + "26" }]} onPress={() => setResult(null)}>
                <Feather name="arrow-left" size={16} color={colors.purple} />
                <Text style={[styles.resetBtnText, { color: colors.purple }]}>Ask something else</Text>
              </TouchableOpacity>

              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, result.guidanceAction === "seek_care" && { borderColor: colors.destructive, backgroundColor: colors.destructive + "10" }]}>
                <View style={styles.resultTopline}><View style={[styles.signalDot, { backgroundColor: getActionColors(result.guidanceAction).text }]} /><Text style={[styles.eyebrow, { color: result.guidanceAction === "seek_care" ? colors.destructive : colors.teal }]}>{result.guidanceAction === "seek_care" ? "IMPORTANT SAFETY GUIDANCE" : "YOUR FOOD GUIDE"}</Text></View>

                <Text style={[styles.resultHeadline, { color: colors.text }, result.guidanceAction === "seek_care" && { color: colors.destructive }]}>{result.headline}</Text>
                <Text style={[styles.resultOverview, { color: colors.textSecondary }]}>{result.overview}</Text>

                <View style={styles.resultBadges}>
                  <View style={[styles.badge, { backgroundColor: getActionColors(result.guidanceAction).bg }]}>
                    <Text style={[styles.badgeText, { color: getActionColors(result.guidanceAction).text }]}>
                      {result.guidanceAction.toUpperCase().replace("_", " ")}
                    </Text>
                  </View>
                  {result.guidanceAction !== "seek_care" && (
                    <View style={[styles.badge, { backgroundColor: getFitColors(result.personalFitLevel).bg }]}>
                      <Text style={[styles.badgeText, { color: getFitColors(result.personalFitLevel).text }]}>
                        PERSONAL FIT · {formatFitLevel(result.personalFitLevel)}
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
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Why this answer</Text>
                  <Text style={[styles.composerHint, { color: colors.textSecondary, marginBottom: 16 }]}>{result.evidence.length} signals considered</Text>
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

                </View>
              )}

              <View style={[styles.contextUsedRow, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <View style={styles.contextHeading}><Feather name="layers" size={16} color={colors.teal} /><Text style={[styles.contextUsedTitle, { color: colors.text }]}>Context used</Text></View>
                <Text style={[styles.contextUsedStats, { color: colors.textSecondary }]}>
                  {result.contextUsed?.safeFoods || 0} safe · {result.contextUsed?.triggerFoods || 0} triggers · {result.contextUsed?.symptomCheckIns || 0} check-ins · {result.contextUsed?.learningEvents || 0} outcomes
                </Text>
              </View>

              {((result.detectedFoods && result.detectedFoods.length > 0) || (result.considerations && result.considerations.length > 0) || (result.swaps && result.swaps.length > 0) || (result.watchFor && result.watchFor.length > 0)) && (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 16 }]}>
                  {result.detectedFoods && result.detectedFoods.length > 0 && (
                    <View style={styles.listSection}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>On the plate</Text>
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
                      <Text style={[styles.cardTitle, { color: colors.text }]}>Keep an eye on</Text>
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
                      <Text style={[styles.cardTitle, { color: colors.text }]}>What could help</Text>
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
                  <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 8 }]}>Ideas for your table</Text>
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
                        <Text style={[styles.primaryBtnText, { fontSize: 14, color: colors.background }]}>Add to Menu</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* LEARN STAGE */}
              <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, marginTop: 24, borderWidth: 2 }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>How did it go?</Text>

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
                          <Text style={[styles.primaryBtnText, { color: colors.background }]}>Save to Learning History</Text>
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
    paddingHorizontal: 22,
    paddingBottom: 13,
    paddingTop: 10,
    borderBottomWidth: 1,
  },
  headerBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerSide: { width: 86 },
  headerActions: { width: 86, flexDirection: "row", alignItems: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700" as const, letterSpacing: -0.4 },
  scrollContent: { paddingHorizontal: 22, paddingTop: 18 },

  hero: { paddingTop: 22, paddingBottom: 9, alignItems: "flex-start" },
  heroMark: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center", marginBottom: 19, transform: [{ rotate: "-8deg" }] },
  eyebrow: { fontSize: 10, fontWeight: "800" as const, letterSpacing: 1.8 },
  heroTitle: { fontSize: 34, lineHeight: 39, fontWeight: "800" as const, letterSpacing: -1.7, marginTop: 10 },
  heroSubtitle: { fontSize: 14, lineHeight: 21, marginTop: 12, maxWidth: 320 },
  shortcutRow: { flexDirection: "row", gap: 7, marginTop: 20, marginBottom: 4 },
  shortcut: { flex: 1, minHeight: 60, borderRadius: 17, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 3, gap: 5 },
  shortcutText: { fontSize: 10, fontWeight: "700" as const, textAlign: "center" },
  composer: { borderWidth: 1, borderRadius: 23, padding: 18, marginTop: 14, shadowColor: "#374237", shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  composerHeading: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  smallIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  composerTitle: { fontSize: 17, fontWeight: "800" as const, letterSpacing: -0.4 },
  composerHint: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  composerInput: { minHeight: 77, fontSize: 15, lineHeight: 22, paddingTop: 9, paddingBottom: 10, textAlignVertical: "top" },
  composerFooter: { borderTopWidth: 1, paddingTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  composerTools: { flexDirection: "row", alignItems: "center", gap: 7 },
  toolBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  composerFootnote: { fontSize: 11 },
  sendBtn: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  contextPanel: { borderWidth: 1, borderRadius: 21, marginTop: 3, padding: 18 },
  contextHeading: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 17 },
  contextHeadingText: { fontSize: 15, fontWeight: "700" as const },
  fieldCaption: { fontSize: 10, fontWeight: "800" as const, letterSpacing: 1.3, marginBottom: 10 },
  compactInput: { borderWidth: 1, borderRadius: 13, minHeight: 46, fontSize: 13, paddingHorizontal: 13, paddingVertical: 11, textAlignVertical: "top" },
  inlineNotice: { borderRadius: 15, padding: 15, flexDirection: "row", alignItems: "center", gap: 12 },
  inlineNoticeText: { flex: 1, fontSize: 13, lineHeight: 19 },
  recentMeal: { fontSize: 16, fontWeight: "700" as const, marginBottom: 17 },
  resultTopline: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 15 },
  signalDot: { width: 7, height: 7, borderRadius: 4 },

  flowStrip: { borderBottomWidth: 1, paddingVertical: 12, paddingHorizontal: 16 },
  flowStripInner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  flowStep: { flex: 1, alignItems: "center" },
  flowStepText: { fontSize: 12, fontWeight: "500" as const },

  stageContainer: { gap: 12 },

  card: { padding: 20, borderRadius: 22, borderWidth: 1 },
  sectionTitle: { fontSize: 21, fontWeight: "800" as const, marginBottom: 12, letterSpacing: -0.6 },
  cardTitle: { fontSize: 17, fontWeight: "800" as const, marginBottom: 10, letterSpacing: -0.4 },

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

  chipsScroll: { gap: 7, paddingBottom: 2 },
  chip: { paddingHorizontal: 13, paddingVertical: 9, minHeight: 38, borderRadius: 12, borderWidth: 1, justifyContent: "center" },
  chipText: { fontSize: 12, fontWeight: "700" as const },

  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: "top",
  },

  scanSection: { marginBottom: 20 },
  photoActionRow: { flexDirection: "row", gap: 9, marginBottom: 9 },
  photoActionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1,
    gap: 8
  },
  photoActionText: { fontSize: 13, fontWeight: "700" as const },
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
  gutStateChip: { paddingHorizontal: 14, minHeight: 38, justifyContent: "center", borderRadius: 12, borderWidth: 1 },
  gutStateText: { fontSize: 12, fontWeight: "700" as const },
  connectionNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 19, paddingTop: 14, borderTopWidth: 1 },
  connectionNoteText: { fontSize: 11, lineHeight: 17, flex: 1 },

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 15,
    gap: 8
  },
  primaryBtnText: { fontSize: 15, fontWeight: "700" as const },

  resetBtn: { flexDirection: "row", alignItems: "center", gap: 7, alignSelf: "flex-start", marginBottom: 10, paddingHorizontal: 14, minHeight: 42, borderRadius: 13 },
  resetBtnText: { fontSize: 14, fontWeight: "600" as const },

  resultHeadline: { fontSize: 25, lineHeight: 31, fontWeight: "800" as const, letterSpacing: -0.8, marginBottom: 11 },
  resultOverview: { fontSize: 14, lineHeight: 22, marginBottom: 18 },
  resultBadges: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  badge: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: "800" as const, letterSpacing: 0.4 },
  summaryBox: { padding: 15, borderRadius: 14 },
  summaryText: { fontSize: 14, lineHeight: 20 },

  evidenceList: { gap: 0 },
  evidenceItem: { flexDirection: "row", alignItems: "flex-start", gap: 11, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#D9DED2" },
  evidenceIcon: { width: 24, alignItems: "center", marginTop: 2 },
  evidenceContent: { flex: 1 },
  evidenceTitle: { fontSize: 14, fontWeight: "600" as const, marginBottom: 2 },
  evidenceDetail: { fontSize: 13, lineHeight: 18 },

  contextUsedRow: { padding: 17, borderWidth: 1, borderRadius: 18, marginTop: 2 },
  contextUsedTitle: { fontSize: 14, fontWeight: "700" as const },
  contextUsedStats: { fontSize: 11, lineHeight: 17 },

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

  feedbackPrompt: { fontSize: 15, fontWeight: "600" as const, marginBottom: 17, lineHeight: 22 },
  feedbackChips: { flexDirection: "row", gap: 7, flexWrap: "wrap" },
  feedbackChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, minHeight: 43, borderRadius: 12, borderWidth: 1, borderColor: "transparent" },
  feedbackChipText: { fontSize: 12, fontWeight: "700" as const },
  feedbackSuccess: { alignItems: "center", paddingVertical: 20, gap: 12 },
  feedbackSuccessTitle: { fontSize: 18, fontWeight: "700" as const },
  feedbackSuccessText: { fontSize: 14, textAlign: "center", paddingHorizontal: 20 },

  disclaimer: { fontSize: 11, lineHeight: 17, marginTop: 7, marginHorizontal: 3 },

  consentIconContainer: { alignItems: "center", justifyContent: "center", alignSelf: "center", width: 62, height: 62, borderRadius: 20, marginTop: 24, marginBottom: 8 },
  consentTitle: { fontSize: 29, lineHeight: 35, fontWeight: "800" as const, textAlign: "center", marginBottom: 0, letterSpacing: -1 },
  consentDesc: { fontSize: 14, lineHeight: 22, textAlign: "center", marginBottom: 7 },
  consentBox: { padding: 20, borderRadius: 21, borderWidth: 1 },
  consentBoxTitle: { fontSize: 16, fontWeight: "700" as const, marginBottom: 12 },
  consentList: { gap: 12 },
  consentItem: { flexDirection: "row", alignItems: "center", gap: 12 },
  consentItemText: { fontSize: 14, flex: 1 },
  safetyNote: { flexDirection: "row", alignItems: "flex-start", padding: 16, borderRadius: 12, borderWidth: 1, marginTop: 8, gap: 12 },
  safetyNoteText: { flex: 1, fontSize: 13, lineHeight: 18 },
  consentNote: { fontSize: 13, textAlign: "center", marginHorizontal: 16, marginBottom: 8 }
});