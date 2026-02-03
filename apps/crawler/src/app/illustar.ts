import { Ok, spawn, task, useContext, work, yieldTask } from "../features/task/index.ts";
import type { Infer } from "../features/model/index.ts";
import type { Task, TaskResult } from "../features/task/index.ts";
import {
  circleCollection,
  concertCollection,
  eventCollection,
  ongoingBoothInfoCollection,
  scheduleCollection,
} from "./models/illustar.ts";
import { endpoints } from "../services/illustar/index.ts";
import { persist } from "./persist.ts";

function toMap<T, K extends readonly [string | number, ...(string | number)[]]>(
  items: T[],
  keyFn: (item: T) => K,
): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    map.set(keyFn(item).join("\0"), item);
  }
  return map;
}

const crawlEvents = () =>
  task("crawl-illustar-events", function* () {
    const { fetcher } = yield* useContext();
    const { eventInfo } = yield* work(async ($) => {
      $.description("Fetching event list");
      return await fetcher.fetch(endpoints.eventList);
    });

    return Ok(toMap(eventInfo, (e) => [e.id] as const) as Infer<typeof eventCollection>);
  });

const crawlOngoingBoothInfo = () =>
  task("crawl-illustar-ongoing-booth-info", function* () {
    const { fetcher } = yield* useContext();
    const { boothInfo } = yield* work(async ($) => {
      $.description("Fetching ongoing booth info");
      return await fetcher.fetch(endpoints.ongoingBoothInfo);
    });

    return Ok(toMap(boothInfo, (b) => [b.id] as const) as Infer<typeof ongoingBoothInfoCollection>);
  });

const crawlCircles = () =>
  task("crawl-illustar-circles", function* () {
    const { fetcher } = yield* useContext();
    const ongoingEvents = yield* yieldTask(crawlOngoingBoothInfo());

    const allCircles: Infer<typeof circleCollection> = new Map();

    for (const event of ongoingEvents.values()) {
      let page = 1;
      const rowPerPage = 100;

      while (true) {
        const response = yield* work(async ($) => {
          $.description(`Fetching circles for event ${event.id}, page ${page}`);
          return await fetcher.fetch(endpoints.circleList, {
            query: { event_id: event.id, page, row_per_page: rowPerPage },
          });
        });

        for (const circle of response.list) {
          const key = [circle.id] as const;
          allCircles.set(key.join("\0"), circle);
        }

        if (page >= response.pageInfo.max_page) break;
        page += 1;
      }
    }

    return Ok(allCircles);
  });

const crawlConcerts = () =>
  task("crawl-illustar-concerts", function* () {
    const { fetcher } = yield* useContext();
    const allConcerts: Infer<typeof concertCollection> = new Map();
    let page = 1;
    const rowPerPage = 100;

    while (true) {
      const response = yield* work(async ($) => {
        $.description(`Fetching concerts, page ${page}`);
        return await fetcher.fetch(endpoints.concertList, {
          query: { page, row_per_page: rowPerPage },
        });
      });

      for (const concert of response.list) {
        const key = [concert.id] as const;
        allConcerts.set(key.join("\0"), concert);
      }

      if (page >= response.pageInfo.max_page) break;
      page += 1;
    }

    return Ok(allConcerts);
  });

const crawlSchedule = () =>
  task("crawl-illustar-schedule", function* () {
    const { fetcher } = yield* useContext();
    const { scheduleList } = yield* work(async ($) => {
      $.description("Fetching schedule");
      return await fetcher.fetch(endpoints.schedule);
    });

    return Ok(toMap(scheduleList, (s) => [s.id] as const) as Infer<typeof scheduleCollection>);
  });

export interface IllustarCrawlData {
  events: Infer<typeof eventCollection>;
  circles: Infer<typeof circleCollection>;
  concerts: Infer<typeof concertCollection>;
  schedule: Infer<typeof scheduleCollection>;
  ongoingBoothInfo: Infer<typeof ongoingBoothInfoCollection>;
}

export function crawlIllustar(): Task<IllustarCrawlData> {
  return task("crawl-illustar", function* () {
    const results = yield* spawn([
      crawlEvents(),
      crawlCircles(),
      crawlConcerts(),
      crawlSchedule(),
      crawlOngoingBoothInfo(),
    ]);

    const [eventsResult, circlesResult, concertsResult, scheduleResult, ongoingBoothInfoResult] =
      results as [
        TaskResult<Infer<typeof eventCollection>>,
        TaskResult<Infer<typeof circleCollection>>,
        TaskResult<Infer<typeof concertCollection>>,
        TaskResult<Infer<typeof scheduleCollection>>,
        TaskResult<Infer<typeof ongoingBoothInfoCollection>>,
      ];

    if (!eventsResult.ok) throw eventsResult.error;
    if (!circlesResult.ok) throw circlesResult.error;
    if (!concertsResult.ok) throw concertsResult.error;
    if (!scheduleResult.ok) throw scheduleResult.error;
    if (!ongoingBoothInfoResult.ok) throw ongoingBoothInfoResult.error;

    return Ok({
      events: eventsResult.data,
      circles: circlesResult.data,
      concerts: concertsResult.data,
      schedule: scheduleResult.data,
      ongoingBoothInfo: ongoingBoothInfoResult.data,
    });
  });
}

export async function persistIllustar(data: IllustarCrawlData, dataDir: string): Promise<void> {
  await Promise.all([
    persist(eventCollection, data.events, "events", dataDir),
    persist(circleCollection, data.circles, "circles", dataDir),
    persist(concertCollection, data.concerts, "concerts", dataDir),
    persist(scheduleCollection, data.schedule, "schedule", dataDir),
    persist(ongoingBoothInfoCollection, data.ongoingBoothInfo, "ongoing-booth-info", dataDir),
  ]);
}
