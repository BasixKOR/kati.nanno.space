import { createHash } from "node:crypto";
import { access, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import sharp from "sharp";

import { Ok, task, work } from "../features/task/index.ts";
import type { Task } from "../features/task/index.ts";
import {
  chunkRequests,
  createClassificationBatch,
  getBatchResults,
  getBatchStatus,
  isBatchDone,
  JobState,
} from "../services/gemini/batch.ts";
import type { ClassificationRequest } from "../services/gemini/batch.ts";
import { boothInfoPaths } from "./booth-info-shared.ts";
import type { BoothImageMeta } from "./booth-info-shared.ts";
import type { PendingBatch } from "./analyze-info-checkpoint.ts";
import { loadAnalyzeCheckpoint, saveAnalyzeCheckpoint } from "./analyze-info-checkpoint.ts";
import { loadUserRawTweets, saveUserRawTweets } from "./raw-tweets-io.ts";
import type { RawTweetsFile } from "./raw-tweets-io.ts";
import type { TwitterChannel } from "../services/twitter/index.ts";

const DATA_DIR = resolve(import.meta.dirname!, "../../../../data");
const FIND_INFO_DIR = join(DATA_DIR, "find-info");
const RAW_TWEETS_DIR = join(FIND_INFO_DIR, "raw-tweets");
const IMAGE_CACHE_DIR = join(FIND_INFO_DIR, ".image-cache");
const CHECKPOINT_PATH = join(FIND_INFO_DIR, ".analyze-checkpoint.json");

const CONFIDENCE_THRESHOLD = 0.6;
const POLL_INTERVAL_MS = 30_000;

/** Pending image waiting for batch classification. */
interface CollectedImage {
  mediaUrl: string;
  username: string;
  tweetId: string;
  tweetText: string;
  cacheKey: string;
}

function urlHash(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Flatten all unclassified media from a user's tweets into a single list. */
function collectUnclassifiedMedia(
  data: RawTweetsFile,
  classifiedImages: Map<string, unknown>,
): { url: string; tweetId: string; tweetText: string }[] {
  return data.tweets
    .filter((t) => t.media && t.media.length > 0 && !t.fullText.startsWith("RT @"))
    .flatMap((t) =>
      t
        .media!.filter((m) => !classifiedImages.has(m.url) && !m.url.includes("video.twimg.com"))
        .map((m) => ({ url: m.url, tweetId: t.id, tweetText: t.fullText })),
    );
}

export function analyzeInfo(twitter?: TwitterChannel): Task<void> {
  return task("analyze-info", function* () {
    // ── Load checkpoint and raw tweets ──────────────────────────────
    const { checkpoint, userFiles } = yield* work(async ($) => {
      $.description("Loading checkpoint and raw tweets…");

      const cp = await loadAnalyzeCheckpoint(CHECKPOINT_PATH);

      let files: string[];
      try {
        files = await readdir(RAW_TWEETS_DIR);
      } catch {
        files = [];
      }

      const jsonFiles = files.filter((f) => f.endsWith(".json")).toSorted();

      const userFiles: { username: string; fetchedAt: string; data: RawTweetsFile }[] = [];
      for (const file of jsonFiles) {
        const raw = await readFile(join(RAW_TWEETS_DIR, file), "utf8");
        const data = JSON.parse(raw) as RawTweetsFile;
        const username = file.replace(/\.json$/, "");
        userFiles.push({ username, fetchedAt: data.fetchedAt, data });
      }

      return { checkpoint: cp, userFiles };
    });

    // If there are already pending batches, skip straight to Phase 3
    const hasPendingBatches = checkpoint.pending_batches.length > 0;

    // ── Phase 1: Collect ────────────────────────────────────────────
    const collected: CollectedImage[] = [];

    if (!hasPendingBatches) {
      yield* work(async () => {
        await mkdir(IMAGE_CACHE_DIR, { recursive: true });
      });

      let downloadCount = 0;

      for (const { username, fetchedAt, data } of userFiles) {
        if (checkpoint.users_processed.get(username) === fetchedAt) continue;

        const media = collectUnclassifiedMedia(data, checkpoint.classified_images);

        for (const m of media) {
          const cacheKey = urlHash(m.url);
          const cachePath = join(IMAGE_CACHE_DIR, `${cacheKey}.png`);
          const cached = yield* work(async () => fileExists(cachePath));

          if (!cached) {
            const ok = yield* work(async ($) => {
              downloadCount++;
              $.description(`Downloading image ${downloadCount}…`);

              const resp = await fetch(m.url);

              if (resp.status === 404 && twitter) {
                // Tweet may have been deleted or updated — check via API
                const tweetDetail = await twitter.enqueue((c) => c.tweet.details(m.tweetId));
                const loaded = await loadUserRawTweets(RAW_TWEETS_DIR, username);
                if (!tweetDetail) {
                  // Tweet deleted — remove from raw-tweets JSON
                  loaded.tweets.delete(m.tweetId);
                } else {
                  // Tweet updated — update entry with new data
                  loaded.tweets.set(m.tweetId, {
                    id: tweetDetail.id,
                    fullText: tweetDetail.fullText,
                    createdAt: tweetDetail.createdAt,
                    conversationId: tweetDetail.conversationId,
                    media: tweetDetail.media?.map((med) => ({ url: med.url })),
                    urls: tweetDetail.entities.urls,
                  });
                }
                await saveUserRawTweets(RAW_TWEETS_DIR, username, loaded.tweets);
                return false;
              }

              if (!resp.ok) {
                // Non-404 failure — skip this image
                return false;
              }

              const arrayBuf = await resp.arrayBuffer();
              try {
                const pngBuf = await sharp(Buffer.from(arrayBuf)).png().toBuffer();
                await writeFile(cachePath, pngBuf);
              } catch {
                // Unsupported image format — skip
                return false;
              }
              return true;
            });
            if (!ok) continue;
          }

          collected.push({
            mediaUrl: m.url,
            username,
            tweetId: m.tweetId,
            tweetText: m.tweetText,
            cacheKey,
          });
        }
      }

      if (collected.length === 0) {
        for (const { username, fetchedAt } of userFiles) {
          checkpoint.users_processed.set(username, fetchedAt);
        }
        yield* work(async ($) => {
          $.description("No new images to classify.");
          await saveAnalyzeCheckpoint(CHECKPOINT_PATH, checkpoint);
        });
        return Ok(undefined);
      }
    }

    // ── Phase 2: Submit batches ─────────────────────────────────────
    if (!hasPendingBatches && collected.length > 0) {
      const requests: ClassificationRequest[] = yield* work(async ($) => {
        $.description(`Encoding ${collected.length} images…`);

        const reqs: ClassificationRequest[] = [];
        for (const img of collected) {
          const cachePath = join(IMAGE_CACHE_DIR, `${img.cacheKey}.png`);
          const pngBuf = await readFile(cachePath);
          reqs.push({
            key: img.mediaUrl,
            pngBase64: pngBuf.toString("base64"),
            tweetText: img.tweetText,
          });
        }
        return reqs;
      });

      const chunks = chunkRequests(requests);
      const urlToUsername = new Map(collected.map((c) => [c.mediaUrl, c.username]));

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]!;

        const batchName = yield* work(async ($) => {
          $.description(`Submitting batch ${i + 1}/${chunks.length} (${chunk.length} images)…`);
          return createClassificationBatch(chunk, `analyze-info-${i + 1}-${Date.now()}`);
        });

        const requestKeys: Record<string, { media_url: string; username: string }> = {};
        for (const req of chunk) {
          requestKeys[req.key] = { media_url: req.key, username: urlToUsername.get(req.key)! };
        }

        const pendingBatch: PendingBatch = {
          batch_name: batchName,
          created_at: new Date().toISOString(),
          request_keys: requestKeys,
        };
        checkpoint.pending_batches.push(pendingBatch);

        yield* work(async () => {
          await saveAnalyzeCheckpoint(CHECKPOINT_PATH, checkpoint);
        });
      }
    }

    // ── Phase 3: Poll & Process ─────────────────────────────────────
    let saved = 0;

    while (checkpoint.pending_batches.length > 0) {
      yield* work(async ($) => {
        $.description(
          `Waiting for ${checkpoint.pending_batches.length} batch(es)… (polling every 30s)`,
        );
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      });

      const remaining: PendingBatch[] = [];

      for (const batch of checkpoint.pending_batches) {
        const status = yield* work(async ($) => {
          $.description(`Polling ${batch.batch_name.slice(-12)}…`);
          return getBatchStatus(batch.batch_name);
        });

        if (!isBatchDone(status)) {
          remaining.push(batch);
          continue;
        }

        if (status.state !== JobState.JOB_STATE_SUCCEEDED) {
          yield* work(async ($) => {
            $.description(
              `Batch ${batch.batch_name.slice(-12)} failed (${status.state}), images will retry next run`,
            );
          });
          continue;
        }

        const results = yield* work(async ($) => {
          $.description(`Reading results for ${batch.batch_name.slice(-12)}…`);
          return getBatchResults(batch.batch_name);
        });

        for (const [mediaUrl, classification] of results) {
          checkpoint.classified_images.set(mediaUrl, classification);

          if (!classification.is_booth_info || classification.confidence < CONFIDENCE_THRESHOLD) {
            continue;
          }

          yield* work(async ($) => {
            const cachePath = join(IMAGE_CACHE_DIR, `${urlHash(mediaUrl)}.png`);
            const pngBuf = await readFile(cachePath);
            const sha256 = createHash("sha256").update(pngBuf).digest("hex");
            const metadata = await sharp(pngBuf).metadata();
            const paths = boothInfoPaths(sha256);

            $.description(`Saving ${sha256.slice(0, 12)}…`);
            await mkdir(paths.dir, { recursive: true });

            const meta: BoothImageMeta = {
              url: mediaUrl,
              width: metadata.width!,
              height: metadata.height!,
              sha256,
            };

            await Promise.all([
              writeFile(paths.png, pngBuf),
              writeFile(paths.meta, JSON.stringify(meta, undefined, 2), "utf8"),
            ]);

            saved++;
          });
        }
      }

      checkpoint.pending_batches = remaining;

      yield* work(async () => {
        await saveAnalyzeCheckpoint(CHECKPOINT_PATH, checkpoint);
      });
    }

    // Mark all users as processed now that all batches are done
    for (const { username, fetchedAt } of userFiles) {
      checkpoint.users_processed.set(username, fetchedAt);
    }

    // Clean up image cache
    yield* work(async ($) => {
      $.description(`Done — ${saved} images saved. Cleaning up cache…`);
      try {
        await rm(IMAGE_CACHE_DIR, { recursive: true });
      } catch {
        // Ignore if already cleaned
      }
      await saveAnalyzeCheckpoint(CHECKPOINT_PATH, checkpoint);
    });

    return Ok(undefined);
  });
}
