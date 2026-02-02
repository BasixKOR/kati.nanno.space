import {
  circleCollection,
  concertCollection,
  eventCollection,
  scheduleCollection,
} from "./app/models/illustar.ts";
import {
  crawlIllustarCircles,
  crawlIllustarConcerts,
  crawlIllustarEvents,
  crawlIllustarSchedule,
} from "./app/illustar.ts";
import { dirname, resolve } from "node:path";
import type { ActionEntry } from "./app/types.ts";
import { createFetcher } from "./services/endpoint.ts";
import { fileURLToPath } from "node:url";
import { persist } from "./app/persist.ts";
import { renderActions } from "./ui.tsx";
import { run } from "./features/action/index.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, "../../../data/illustar");

const fetcher = createFetcher();

// Phase 1: crawl events
const eventsAction = crawlIllustarEvents(fetcher);
const eventsResult = run(eventsAction);

const phase1: ActionEntry[] = [{ name: "crawl-illustar-events", result: eventsResult }];

const { unmount: unmount1 } = renderActions(phase1);
const eventsData = await eventsResult.result;
unmount1();

// Persist events
await persist(eventCollection, eventsData, "events", dataDir);

// Phase 2: crawl circles, concerts, schedule in parallel
const eventIds = [...eventsData.values()].map((e) => e.id);

const circlesResult = run(crawlIllustarCircles(fetcher, eventIds));
const concertsResult = run(crawlIllustarConcerts(fetcher));
const scheduleResult = run(crawlIllustarSchedule(fetcher));

const phase2: ActionEntry[] = [
  { name: "crawl-illustar-circles", result: circlesResult },
  { name: "crawl-illustar-concerts", result: concertsResult },
  { name: "crawl-illustar-schedule", result: scheduleResult },
];

const { unmount: unmount2 } = renderActions(phase2);

const [circlesData, concertsData, scheduleData] = await Promise.all([
  circlesResult.result,
  concertsResult.result,
  scheduleResult.result,
]);

unmount2();

// Persist all
await Promise.all([
  persist(circleCollection, circlesData, "circles", dataDir),
  persist(concertCollection, concertsData, "concerts", dataDir),
  persist(scheduleCollection, scheduleData, "schedule", dataDir),
]);
