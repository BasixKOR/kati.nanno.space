import {
  task,
  work,
  yieldTask,
  useContext,
  Ok,
  runTask,
  createSession,
} from "../features/task/index.ts";
import type { Session } from "../features/task/index.ts";
import {
  circleCollection,
  concertCollection,
  eventCollection,
  ongoingBoothInfoCollection,
  scheduleCollection,
} from "./models/illustar.ts";
import type { TaskEntry } from "./types.ts";
import type { Infer } from "../features/model/index.ts";
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

export interface IllustarCrawlResult {
  readonly session: Session;
  readonly entries: TaskEntry[];
  persist(dataDir: string): Promise<void>;
}

// eslint-disable-next-line import/no-default-export
export default function crawlIllustar(
  context: import("../features/task/index.ts").TaskContext,
): IllustarCrawlResult {
  const session = createSession(context);

  const eventsResult = runTask(crawlEvents(), session);
  const circlesResult = runTask(crawlCircles(), session);
  const concertsResult = runTask(crawlConcerts(), session);
  const scheduleResult = runTask(crawlSchedule(), session);
  const ongoingBoothInfoResult = runTask(crawlOngoingBoothInfo(), session);

  const allResults = Promise.allSettled([
    eventsResult.result,
    circlesResult.result,
    concertsResult.result,
    scheduleResult.result,
    ongoingBoothInfoResult.result,
  ]);

  return {
    session,
    entries: [
      { name: "crawl-illustar-events", result: eventsResult },
      { name: "crawl-illustar-circles", result: circlesResult },
      { name: "crawl-illustar-concerts", result: concertsResult },
      { name: "crawl-illustar-schedule", result: scheduleResult },
      { name: "crawl-illustar-ongoing-booth-info", result: ongoingBoothInfoResult },
    ],
    async persist(dataDir: string) {
      const [events, circles, concerts, schedule, ongoingBooth] = await allResults;

      if (events.status === "fulfilled" && events.value.ok) {
        await persist(
          eventCollection,
          events.value.data as Infer<typeof eventCollection>,
          "events",
          dataDir,
        );
      }
      if (circles.status === "fulfilled" && circles.value.ok) {
        await persist(
          circleCollection,
          circles.value.data as Infer<typeof circleCollection>,
          "circles",
          dataDir,
        );
      }
      if (concerts.status === "fulfilled" && concerts.value.ok) {
        await persist(
          concertCollection,
          concerts.value.data as Infer<typeof concertCollection>,
          "concerts",
          dataDir,
        );
      }
      if (schedule.status === "fulfilled" && schedule.value.ok) {
        await persist(
          scheduleCollection,
          schedule.value.data as Infer<typeof scheduleCollection>,
          "schedule",
          dataDir,
        );
      }
      if (ongoingBooth.status === "fulfilled" && ongoingBooth.value.ok) {
        await persist(
          ongoingBoothInfoCollection,
          ongoingBooth.value.data as Infer<typeof ongoingBoothInfoCollection>,
          "ongoing-booth-info",
          dataDir,
        );
      }
    },
  };
}
