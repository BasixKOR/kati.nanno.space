import { GoogleGenAI, JobState } from "@google/genai";
import type { BatchJob } from "@google/genai";

/** 18 MB — keeps base64 payload under Gemini batch request limit */
const MAX_BATCH_BYTES = 18 * 1024 * 1024;

const CLASSIFICATION_PROMPT = `You are classifying images from Korean subculture event Twitter accounts.

Determine whether the image is a booth/merchandise INFO SHEET — a single image that lists multiple products with names and prices so customers know what to buy.

POSITIVE (is_booth_info = true) — must show ALL of:
- Multiple product thumbnails or photos arranged in a grid/list
- Product names and prices explicitly written
- Designed as an informational reference (price list, catalog, menu)

NEGATIVE (is_booth_info = false):
- Fan art, illustrations, or standalone artwork (even by a booth seller)
- A single product photo without a price list context
- Logos, banners, profile images, or event posters
- Personal photos, selfies, event venue shots
- Memes, casual content, work-in-progress sketches
- Tiny thumbnails or icons
- Pre-order form screenshots (just a link/QR, not the product list itself)
- Booth layout diagrams without product details

Be strict. When in doubt, classify as negative. Only flag images that would let a customer see the full product lineup and prices at a glance.

Return your classification with confidence (0-1) and a brief reason.`;

const CLASSIFICATION_JSON_SCHEMA = {
  type: "object",
  properties: {
    is_booth_info: {
      type: "boolean",
      description: "Whether the image contains booth/merchandise information",
    },
    confidence: {
      type: "number",
      description: "Confidence score between 0 and 1",
    },
    reason: {
      type: "string",
      description: "Brief explanation for the classification",
    },
  },
  required: ["is_booth_info", "confidence", "reason"],
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
  is_booth_info: boolean;
  confidence: number;
  reason: string;
}

function createClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: process.env.CRAWLER_AI_KEY_GEMINI! });
}

/** Split requests into chunks that each fit under the base64 payload limit. */
export function chunkRequests(requests: ClassificationRequest[]): ClassificationRequest[][] {
  const chunks: ClassificationRequest[][] = [];
  let current: ClassificationRequest[] = [];
  let currentSize = 0;

  for (const req of requests) {
    const size = req.pngBase64.length;
    if (current.length > 0 && currentSize + size > MAX_BATCH_BYTES) {
      chunks.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(req);
    currentSize += size;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

/** Submit a batch of classification requests. Returns the batch resource name. */
export async function createClassificationBatch(
  requests: ClassificationRequest[],
  displayName: string,
): Promise<string> {
  const ai = createClient();

  const inlinedRequests = requests.map((req) => ({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: CLASSIFICATION_PROMPT,
      responseMimeType: "application/json",
      responseJsonSchema: CLASSIFICATION_JSON_SCHEMA,
      temperature: 0.2,
      thinkingConfig: { thinkingBudget: 0 },
    },
    contents: [
      {
        role: "user" as const,
        parts: [
          { inlineData: { mimeType: "image/png", data: req.pngBase64 } },
          { text: `Tweet text: ${req.tweetText}` },
        ],
      },
    ],
    metadata: { key: req.key },
  }));

  const batch = await ai.batches.create({
    model: "gemini-2.5-flash",
    src: inlinedRequests,
    config: { displayName },
  });

  return batch.name!;
}

/** Poll batch status. */
export async function getBatchStatus(name: string): Promise<BatchJob> {
  const ai = createClient();
  return ai.batches.get({ name });
}

/** Returns true when the batch is in a terminal state. */
export function isBatchDone(batch: BatchJob): boolean {
  return (
    batch.state === JobState.JOB_STATE_SUCCEEDED ||
    batch.state === JobState.JOB_STATE_FAILED ||
    batch.state === JobState.JOB_STATE_CANCELLED
  );
}

/** Parse completed batch responses into a key→result map. */
export async function getBatchResults(name: string): Promise<Map<string, ClassificationResult>> {
  const ai = createClient();
  const batch = await ai.batches.get({ name });
  const results = new Map<string, ClassificationResult>();

  const responses = batch.dest?.inlinedResponses;
  if (!responses) return results;

  for (const resp of responses) {
    const key = resp.metadata?.key;
    if (!key) continue;

    try {
      const text = resp.response?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        results.set(key, JSON.parse(text) as ClassificationResult);
      }
    } catch {
      // Skip malformed responses — images remain unclassified for retry
    }
  }

  return results;
}

export { JobState };
