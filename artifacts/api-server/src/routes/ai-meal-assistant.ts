import { Router, type IRouter } from "express";
import { ai } from "@workspace/integrations-gemini-ai";
import {
  CreateAiMealAssistantBody,
  CreateAiMealAssistantResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_BASE64_LENGTH = 11_184_812;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const rateLimitWindows = new Map<string, { count: number; resetAt: number }>();
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const FIXED_DISCLAIMER =
  "Educational guidance only, not medical advice or a diagnosis. Talk with your clinician before making significant diet changes.";
const RED_FLAG_PATTERN =
  /\b(?:blood\s+in\s+(?:the\s+)?stool|bloody\s+stool|severe\s+pain|persistent\s+vomiting|fainting|dehydration|high\s+fever|inability\s+to\s+keep\s+(?:fluids|liquids)\s+down|can['’]?t\s+keep\s+(?:fluids|liquids)\s+down)\b/i;
const ESCALATION_CONSIDERATION =
  "Some logged symptoms may need prompt medical attention (such as blood in stool, severe pain, persistent vomiting, fainting, dehydration, high fever, or inability to keep fluids down). Contact a clinician or urgent care promptly; seek emergency help if symptoms are severe.";
const ESCALATION_HEADLINE = "Please seek prompt medical care";
const ESCALATION_OVERVIEW =
  "The information you shared includes a warning sign that should be assessed by a clinician rather than interpreted by this meal assistant.";
const ESCALATION_GUIDANCE =
  "Contact a clinician or urgent care promptly for guidance. Call emergency services if symptoms are severe or there is immediate danger. Do not use this guidance to diagnose or delay care.";
const ESCALATION_EVIDENCE = [
  {
    stage: "current" as const,
    signal: "caution" as const,
    title: "A warning sign was reported",
    detail: "A reported symptom or pain level needs prompt clinical assessment; this assistant cannot determine its cause.",
  },
];
const ESCALATION_LEARNING_PROMPT =
  "After speaking with a clinician, record any care guidance they provide and how your symptoms change.";
const PAIN_SEVERITY_PATTERN =
  /\bpain\b[^\d]{0,24}(?:8|9|10)\s*(?:\/\s*10|out\s+of\s+10)\b|\b(?:8|9|10)\s*(?:\/\s*10|out\s+of\s+10)\b[^\d]{0,24}\bpain\b/i;

const SYSTEM_PROMPT = `You are a careful, non-diagnostic food-pattern assistant for someone living with IBS, IBD, or a sensitive gut.

Use this transparent data flow:
1. Capture: describe what the current request and image (if provided) actually show.
2. Connect patterns: connect only the structured foods, meals, symptoms, and learning history supplied by the user.
3. Personalize: treat this person's safe foods, trigger foods, and outcomes as observations about them, never as universal rules.
4. Reason: consider the current gut state and meal context, preserving uncertainty when evidence is incomplete.
5. Guide: choose one action from eat, limit, swap, avoid, observe, or seek_care; provide practical alternatives. The app handles urgent flags before Gemini, so use seek_care only for schema consistency and do not attempt urgent-flag triage.
6. Learn: invite the person to record how the meal felt so a future check can learn from the outcome.

Never diagnose, prescribe, tell someone to stop medication, or claim that a food caused a symptom. Never invent hidden ingredients, portions, onset, or nutrition facts from an unclear image. Do not present a prediction or certainty. If the image or context is incomplete, use unclear/observe and say what is unknown. Personal food history is observational evidence only.

Return exactly one JSON object, with no markdown fences or additional keys:
{
  "headline": "short result title",
  "overview": "plain-language summary",
  "personalFitLevel": "good_fit" | "use_caution" | "high_caution" | "unclear",
  "confidence": "low" | "medium" | "high",
  "guidanceAction": "eat" | "limit" | "swap" | "avoid" | "observe" | "seek_care",
  "guidanceSummary": "practical non-medical guidance",
  "evidence": [
    {
      "stage": "captured" | "pattern" | "personal" | "current",
      "signal": "support" | "caution" | "unknown",
      "title": "short evidence title",
      "detail": "detail tied to supplied context, or explicitly unknown"
    }
  ],
  "contextUsed": {
    "safeFoods": 0,
    "triggerFoods": 0,
    "recentMeals": 0,
    "symptomCheckIns": 0,
    "learningEvents": 0
  },
  "detectedFoods": [],
  "considerations": [],
  "suggestions": [
    {
      "title": "meal name",
      "mealType": "breakfast" | "lunch" | "dinner" | "snack",
      "description": "short description",
      "ingredients": ["ingredient"],
      "preparation": "simple preparation guidance",
      "rationale": "why this fits the supplied context without certainty"
    }
  ],
  "swaps": [],
  "watchFor": [],
  "learningPrompt": "what to record after trying this",
  "disclaimer": "brief educational disclaimer"
}
For suggestions mode, return 3 to 5 suggestions. For scan mode, return 0 to 3 suggestions. Keep strings concise and actionable.`;

function stripJsonFences(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function normalizeStringList(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (typeof item !== "object" || item === null) return "";
      return Object.values(item)
        .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
        .join(" — ");
    })
    .filter((item) => item.length > 0);
}

function decodeAndValidateImage(base64: string, mimeType: string): boolean {
  if (
    base64.length === 0 ||
    base64.length > MAX_IMAGE_BASE64_LENGTH ||
    base64.length % 4 !== 0 ||
    !BASE64_PATTERN.test(base64)
  ) {
    return false;
  }

  const decoded = Buffer.from(base64, "base64");
  if (
    decoded.length === 0 ||
    decoded.length > MAX_IMAGE_BYTES ||
    decoded.toString("base64") !== base64
  ) {
    return false;
  }

  if (mimeType === "image/jpeg") {
    return decoded.length >= 3 && decoded[0] === 0xff && decoded[1] === 0xd8 && decoded[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return (
      decoded.length >= 8 &&
      decoded.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  return (
    decoded.length >= 12 &&
    decoded.subarray(0, 4).toString("ascii") === "RIFF" &&
    decoded.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

function getRetryAfterSeconds(clientKey: string): number | null {
  const now = Date.now();
  if (rateLimitWindows.size > 1_000) {
    for (const [key, window] of rateLimitWindows) {
      if (now >= window.resetAt) rateLimitWindows.delete(key);
    }
  }
  const current = rateLimitWindows.get(clientKey);
  if (!current || now >= current.resetAt) {
    rateLimitWindows.set(clientKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return null;
  }
  if (current.count >= RATE_LIMIT_MAX) {
    return Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  }
  current.count += 1;
  return null;
}

router.post("/ai/meal-assistant", async (req, res): Promise<void> => {
  const parsedBody = CreateAiMealAssistantBody.safeParse(req.body);
  if (!parsedBody.success) {
    req.log.warn({ mode: req.body?.mode }, "Invalid AI meal assistant request");
    res.status(400).json({ error: "Invalid meal assistant request." });
    return;
  }

  const body = parsedBody.data;
  const hasImageBase64 = body.imageBase64 !== undefined;
  const hasImageMimeType = body.imageMimeType !== undefined;
  if (hasImageBase64 !== hasImageMimeType) {
    req.log.warn({ mode: body.mode }, "Incomplete AI meal assistant image payload");
    res.status(400).json({ error: "Image data and image MIME type must be provided together." });
    return;
  }
  if (body.mode === "scan" && (!body.imageBase64 || !body.imageMimeType)) {
    req.log.warn({ mode: body.mode }, "Scan request missing image payload");
    res.status(400).json({ error: "Scan requests require an image and MIME type." });
    return;
  }
  if (body.mode === "suggestions" && (hasImageBase64 || hasImageMimeType)) {
    req.log.warn({ mode: body.mode }, "Suggestions request included image payload");
    res.status(400).json({ error: "Suggestions requests cannot include an image." });
    return;
  }
  if (body.imageBase64 && body.imageMimeType && !decodeAndValidateImage(body.imageBase64, body.imageMimeType)) {
    req.log.warn({ mode: body.mode }, "Invalid AI meal assistant image payload");
    res.status(400).json({ error: "Image data does not match its MIME type or size limits." });
    return;
  }

  const contextUsed = {
    safeFoods: body.safeFoods.length,
    triggerFoods: body.triggerFoods.length,
    recentMeals: body.recentMeals.length,
    symptomCheckIns: body.recentSymptoms.length,
    learningEvents: body.learningHistory.length,
  };
  const reportedText = [body.prompt, ...body.recentSymptoms].join(" ");
  const hasRedFlag =
    body.redFlagSymptoms.length > 0 ||
    PAIN_SEVERITY_PATTERN.test(reportedText) ||
    RED_FLAG_PATTERN.test(reportedText);
  if (hasRedFlag) {
    res.json({
      headline: ESCALATION_HEADLINE,
      overview: ESCALATION_OVERVIEW,
      personalFitLevel: "unclear",
      confidence: "high",
      guidanceAction: "seek_care",
      guidanceSummary: ESCALATION_GUIDANCE,
      evidence: ESCALATION_EVIDENCE,
      contextUsed,
      detectedFoods: [],
      considerations: [ESCALATION_CONSIDERATION],
      suggestions: [],
      swaps: [],
      watchFor: [],
      learningPrompt: ESCALATION_LEARNING_PROMPT,
      disclaimer: FIXED_DISCLAIMER,
    });
    return;
  }

  const clientKey = req.ip || req.socket.remoteAddress || "unknown";
  const retryAfterSeconds = getRetryAfterSeconds(clientKey);
  if (retryAfterSeconds !== null) {
    req.log.warn({ mode: body.mode, retryAfterSeconds }, "AI meal assistant rate limit exceeded");
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(429).json({ error: "Too many meal assistant requests. Please try again later." });
    return;
  }

  const context = JSON.stringify({
    mode: body.mode,
    requestedMealType: body.mealType,
    userPreferences: body.preferences,
    userQuestion: body.prompt,
    gutState: body.gutState,
    loggedSafeFoods: body.safeFoods,
    loggedTriggerFoods: body.triggerFoods,
    recentMeals: body.recentMeals,
    recentSymptoms: body.recentSymptoms,
    learningHistory: body.learningHistory,
  });
  const userParts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [{ text: `Use this private user context to answer the request:\n${context}` }];
  if (body.imageBase64 && body.imageMimeType) {
    userParts.push({
      inlineData: {
        mimeType: body.imageMimeType,
        data: body.imageBase64,
      },
    });
  }

  try {
    const completion = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: userParts }],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
      },
    });
    const modelContent = completion.text;
    if (!modelContent) {
      req.log.error({ mode: body.mode, reason: "empty_model_response" }, "AI meal assistant provider error");
      res.status(502).json({ error: "The meal assistant returned an empty response." });
      return;
    }

    let modelJson: unknown;
    try {
      modelJson = JSON.parse(stripJsonFences(modelContent));
    } catch {
      req.log.error({ mode: body.mode, reason: "invalid_json" }, "AI meal assistant returned invalid JSON");
      res.status(502).json({ error: "The meal assistant returned an invalid response." });
      return;
    }

    const responseCandidate =
      typeof modelJson === "object" && modelJson !== null
        ? {
            ...modelJson,
            contextUsed,
            detectedFoods: normalizeStringList(Reflect.get(modelJson, "detectedFoods")),
            considerations: normalizeStringList(Reflect.get(modelJson, "considerations")),
            swaps: normalizeStringList(Reflect.get(modelJson, "swaps")),
            watchFor: normalizeStringList(Reflect.get(modelJson, "watchFor")),
          }
        : modelJson;
    const validatedResponse = CreateAiMealAssistantResponse.safeParse(responseCandidate);
    if (!validatedResponse.success) {
      req.log.error(
        {
          mode: body.mode,
          reason: "schema_validation_failed",
          issues: validatedResponse.error.issues.slice(0, 8).map((issue) => ({
            path: issue.path.join("."),
            code: issue.code,
          })),
        },
        "AI meal assistant returned an invalid schema",
      );
      res.status(502).json({ error: "The meal assistant returned an invalid response." });
      return;
    }

    res.json({
      ...validatedResponse.data,
      contextUsed,
      disclaimer: FIXED_DISCLAIMER,
    });
  } catch {
    req.log.error({ mode: body.mode, reason: "provider_error" }, "AI meal assistant provider error");
    res.status(502).json({ error: "The meal assistant is temporarily unavailable. Please try again." });
  }
});

export default router;