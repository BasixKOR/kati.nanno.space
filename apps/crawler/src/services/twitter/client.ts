import { Rettiwt, TweetRepliesSortType } from "rettiwt-api";
import type { CursoredData, ITweetFilter, Tweet } from "rettiwt-api";

declare module "../../features/task/types.ts" {
  interface TaskContext {
    readonly twitterChannel: TwitterChannel;
  }
}

interface QueueItem {
  execute: (client: Rettiwt) => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}

export class TwitterChannel {
  private readonly queue: QueueItem[] = [];
  private processing = false;
  private readonly delayMs: number;
  private readonly client: Rettiwt;
  readonly hasAuth: boolean;

  constructor(options?: { delayMs?: number; apiKey?: string }) {
    this.delayMs = options?.delayMs ?? 2000;
    const apiKey = options?.apiKey;
    this.hasAuth = apiKey !== undefined;
    this.client = new Rettiwt(apiKey ? { apiKey } : undefined);
  }

  enqueue<T>(execute: (client: Rettiwt) => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        execute: execute as (client: Rettiwt) => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      void this.drain();
    });
  }

  private async drain(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      try {
        const result = await item.execute(this.client);
        item.resolve(result);
      } catch (error: unknown) {
        if (isRateLimitError(error)) {
          // Push back and wait
          this.queue.unshift(item);
          console.warn("[TwitterChannel] Rate limited, waiting 60s…");
          await sleep(60_000);
        } else {
          item.reject(error);
        }
      }
      // Delay between requests
      if (this.queue.length > 0) {
        await sleep(this.delayMs);
      }
    }

    this.processing = false;
  }
}

function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("429") || msg.includes("rate limit");
  }
  return false;
}

function is404(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes("404");
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// Twitter snowflake IDs are numeric strings — compare as BigInt for correct ordering
function tweetIdLte(a: string, b: string): boolean {
  return BigInt(a) <= BigInt(b);
}

export interface TimelineOptions {
  stopBeforeTweetId?: string;
  /** Stop paginating when tweets are older than this date */
  afterDate: Date;
}

/** Fetch user timeline pages, stopping at checkpoint ID or date cutoff. */
export async function fetchUserTimeline(
  channel: TwitterChannel,
  userId: string,
  options: TimelineOptions,
): Promise<Tweet[]> {
  const { stopBeforeTweetId, afterDate } = options;
  const allTweets: Tweet[] = [];
  let cursor: string | undefined;

  for (;;) {
    let data: CursoredData<Tweet>;
    try {
      data = await channel.enqueue((client) => client.user.timeline(userId, 20, cursor));
    } catch (error) {
      console.warn(`[TwitterChannel] Failed to fetch timeline for ${userId}:`, error);
      break;
    }

    if (data.list.length === 0) break;

    let hitStop = false;
    for (const tweet of data.list) {
      if (stopBeforeTweetId && tweetIdLte(tweet.id, stopBeforeTweetId)) {
        hitStop = true;
        break;
      }
      if (new Date(tweet.createdAt) < afterDate) {
        hitStop = true;
        break;
      }
      allTweets.push(tweet);
    }

    if (hitStop) break;
    if (!data.next) break;
    cursor = data.next;
  }

  return allTweets;
}

export interface SearchOptions {
  stopBeforeTweetId?: string;
  /** Resume pagination from a previously returned cursor */
  startCursor?: string;
  /** Maximum number of pages to fetch (default: 50) */
  maxPages?: number;
}

export interface SearchResult {
  tweets: Tweet[];
  /** Cursor for resuming pagination in a future call */
  nextCursor: string | undefined;
}

/** Fetch tweets matching a search filter, paginating until exhaustion or limits. */
export async function fetchSearchResults(
  channel: TwitterChannel,
  filter: ITweetFilter,
  options?: SearchOptions,
): Promise<SearchResult> {
  const { stopBeforeTweetId, startCursor, maxPages = 50 } = options ?? {};
  const allTweets: Tweet[] = [];
  let cursor: string | undefined = startCursor;

  for (let page = 0; page < maxPages; page++) {
    let data: CursoredData<Tweet>;
    try {
      data = await channel.enqueue((client) => client.tweet.search(filter, 20, cursor));
    } catch (error) {
      // First page failure is fatal — propagate so caller knows search didn't work
      if (page === 0) throw error;
      // 404 on later pages = end of results; other errors are worth logging
      if (!is404(error)) {
        console.warn("[TwitterChannel] Search failed on page", page, error);
      }
      break;
    }

    if (data.list.length === 0) break;

    let hitStop = false;
    for (const tweet of data.list) {
      if (stopBeforeTweetId && tweetIdLte(tweet.id, stopBeforeTweetId)) {
        hitStop = true;
        break;
      }
      allTweets.push(tweet);
    }

    if (hitStop) break;
    if (!data.next) break;
    cursor = data.next;
  }

  return { tweets: allTweets, nextCursor: cursor };
}

/**
 * Fetch all tweets in a thread (self-reply chain) by the given author.
 * Uses RELEVANCE sort which returns the full thread in the first batch.
 */
export async function fetchThread(
  channel: TwitterChannel,
  conversationId: string,
  authorUsername: string,
): Promise<Tweet[]> {
  const data = await channel.enqueue((client) =>
    client.tweet.replies(conversationId, undefined, TweetRepliesSortType.RELEVANCE),
  );
  // Filter to only tweets by the same author
  const lowerAuthor = authorUsername.toLowerCase();
  return data.list.filter((tweet) => tweet.tweetBy.userName.toLowerCase() === lowerAuthor);
}
