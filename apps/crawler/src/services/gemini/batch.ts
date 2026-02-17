import { GoogleGenAI } from "@google/genai";

const CLASSIFICATION_PROMPT = `You are a strict binary scorer for booth merchandise INFO SHEET images.

Target: a single image intended for ordering, containing MULTIPLE items with readable item names and prices.

Decision rules (strict):
1) Start from confidence=0.0.
2) To exceed 0.90, ALL must be true:
   - Multiple distinct products are shown.
   - Price text is visible for products (numbers/currency/원/¥/KRW etc.).
   - The layout is informational (catalog/menu/price sheet), not decorative art.
3) If ANY is missing (especially readable prices), cap confidence at 0.60.
4) If image is mainly artwork/poster/photo/banner/announcement, confidence <= 0.20.
5) If uncertain, lower confidence (favor false negatives over false positives).

Common negatives (score low):
- Standalone illustration or fanart
- Single product close-up
- Event poster, booth banner, logo, profile image
- Crowd/selfie/venue photo
- Schedule/info notice without product list+prices
- QR/link-only preorder notice

Use tweet text only as weak context. Do NOT up-score based on text if the image itself lacks clear product+price evidence.

Return only JSON:
- confidence: float in [0,1]
- reason: one short sentence mentioning observed evidence (or missing evidence).`;

const CLASSIFICATION_JSON_SCHEMA = {
  type: "object",
  properties: {
    confidence: {
      type: "number",
      description: "Confidence score between 0 and 1",
    },
    reason: {
      type: "string",
      description: "Brief explanation for the classification",
    },
  },
  required: ["confidence", "reason"],
};

export interface ClassificationRequest {
  /** Media URL used as correlation key */
  key: string;
  /** Base64-encoded PNG image data */
  pngBase64: string;
  /** Tweet text for context */
  tweetText: string;
}

export interface ClassificationResult {
  confidence: number;
  reason: string;
}

function createClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: process.env.CRAWLER_AI_KEY_GEMINI! });
}

const ANALYZE_INFO_MODEL = process.env.CRAWLER_GEMINI_ANALYZE_MODEL ?? "gemini-2.5-pro";

/** Classify one image directly (non-batch request). */
export async function classifyImage(request: ClassificationRequest): Promise<ClassificationResult> {
  const ai = createClient();
  const response = await ai.models.generateContent({
    model: ANALYZE_INFO_MODEL,
    config: {
      systemInstruction: CLASSIFICATION_PROMPT,
      responseMimeType: "application/json",
      responseJsonSchema: CLASSIFICATION_JSON_SCHEMA,
      temperature: 0,
      thinkingConfig: { thinkingBudget: 128 },
    },
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/png", data: request.pngBase64 } },
          { text: `Tweet text: ${request.tweetText}` },
        ],
      },
    ],
  });

  const text = response.text;
  if (!text) {
    return { confidence: 0, reason: "Empty model response" };
  }

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const rawConfidence =
      typeof parsed.confidence === "number"
        ? parsed.confidence
        : typeof parsed.booth_info_score === "number"
          ? parsed.booth_info_score
          : typeof parsed.is_booth_info === "boolean"
            ? parsed.is_booth_info
              ? 1
              : 0
            : null;
    const confidence =
      rawConfidence == undefined || Number.isNaN(rawConfidence)
        ? 0
        : Math.max(0, Math.min(1, rawConfidence));
    const reason =
      typeof parsed.reason === "string" && parsed.reason.trim().length > 0
        ? parsed.reason
        : "No reason returned by model";

    return { confidence, reason };
  } catch {
    return { confidence: 0, reason: "Malformed model response" };
  }
}

/** Format a Gemini API error into a readable string. */
export function formatGeminiError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);

  // APIError from @google/genai stores the JSON body in .error
  const body = (err as unknown as Record<string, unknown>).error as
    | Record<string, unknown>
    | undefined;
  const inner = (body?.error as Record<string, unknown> | undefined) ?? body;

  if (!inner?.message) return err.message;

  const details = inner.details as
    | Array<{ reason?: string; metadata?: Record<string, string> }>
    | undefined;
  const parts: string[] = [];
  if (inner.status) parts.push(String(inner.status));
  parts.push(String(inner.message));
  for (const d of details ?? []) {
    if (d.reason) parts.push(d.reason);
    const limit = d.metadata?.quota_limit;
    if (limit) parts.push(`(${limit})`);
  }
  return parts.join(": ");
}
