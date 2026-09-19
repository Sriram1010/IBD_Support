import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
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

const SYSTEM_PROMPT = `You are a careful food-planning assistant for people living with IBS, IBD, or a sensitive gut.
Provide practical, non-diagnostic meal guidance. You are not a clinician and must not diagnose, prescribe treatment, or tell someone to stop medication or ignore urgent symptoms.
Personal food logs are observations, not universal medical truths. Treat safe foods and trigger foods as user-specific signals, never as proof of causation or as rules that apply to everyone.
Do not claim that a food caused a symptom. Use language such as "may be associated with this person's logged experience" and mention portion, preparation, and context when relevant.
If a scan is unclear, say so and set riskLevel to "unknown". Do not invent ingredients or nutrition facts.
Always return exactly one JSON object matching the requested schema, with no markdown fences and no additional keys:
{
  "headline": "short result title",
  "overview": "brief, plain-language summary",
  "riskLevel": "low" | "moderate" | "high" | "unknown",
  "detectedFoods": ["foods confidently identified or []"],
  "considerations": ["specific, practical considerations"],
  "suggestions": [
    {
      "title": "meal name",
      "mealType": "breakfast" | "lunch" | "dinner" | "snack",
      "description": "short description",
      "ingredients": ["ingredient"],
      "preparation": "simple preparation guidance",
      "rationale": "why this fits the provided context, without claiming certainty"
    }
  ],
  "disclaimer": "brief reminder that this is educational guidance and not medical advice"
}
For suggestions mode, return 3 to 5 suggestions. For scan mode, return 0 to 3 safer meal suggestions based on what was identified.
Keep all strings concise and actionable.`;

function stripJsonFences(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
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
    loggedSafeFoods: body.safeFoods,
    loggedTriggerFoods: body.triggerFoods,
    recentMeals: body.recentMeals,
    recentSymptoms: body.recentSymptoms,
  });

  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    {
      type: "text",
      text: `Use this private user context to answer the request. Do not repeat private context unnecessarily:\n${context}`,
    },
  ];

  if (body.imageBase64 && body.imageMimeType) {
    userContent.push({
      type: "image_url",
      image_url: {
        url: `data:${body.imageMimeType};base64,${body.imageBase64}`,
      },
    });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.6-terra",
      max_completion_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    });

    const modelContent = completion.choices[0]?.message?.content;
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

    const validatedResponse = CreateAiMealAssistantResponse.safeParse(modelJson);
    if (!validatedResponse.success) {
      req.log.error({ mode: body.mode, reason: "schema_validation_failed" }, "AI meal assistant returned an invalid schema");
      res.status(502).json({ error: "The meal assistant returned an invalid response." });
      return;
    }

    const hasRedFlagSymptoms = RED_FLAG_PATTERN.test(body.recentSymptoms.join(" "));
    const considerations = hasRedFlagSymptoms
      ? [ESCALATION_CONSIDERATION, ...validatedResponse.data.considerations]
      : validatedResponse.data.considerations;
    res.json({
      ...validatedResponse.data,
      considerations,
      disclaimer: FIXED_DISCLAIMER,
    });
  } catch {
    req.log.error({ mode: body.mode, reason: "provider_error" }, "AI meal assistant provider error");
    res.status(502).json({ error: "The meal assistant is temporarily unavailable. Please try again." });
  }
});

export default router;