import { action, step } from "../features/action/index.ts";
import type {
  circleCollection,
  concertCollection,
  eventCollection,
  scheduleCollection,
} from "./models/illustar.ts";
import type { Fetcher } from "../services/endpoint.ts";
import type { Infer } from "../features/model/index.ts";
import { endpoints } from "../services/illustar/index.ts";

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

export function crawlIllustarEvents(fetcher: Fetcher) {
  return action("crawl-illustar-events", function* crawlEvents() {
    const { eventInfo } = yield* step(() => fetcher.fetch(endpoints.eventList), {
      name: "fetch-event-list",
    });

    return toMap(eventInfo, (e) => [e.id] as const) as Infer<typeof eventCollection>;
  });
}

export function crawlIllustarCircles(fetcher: Fetcher, eventIds: number[]) {
  return action("crawl-illustar-circles", function* crawlCircles() {
    const allCircles: Infer<typeof circleCollection> = new Map();

    for (const eventId of eventIds) {
      let page = 1;
      const rowPerPage = 100;

      while (true) {
        const response = yield* step(
          () =>
            fetcher.fetch(endpoints.circleList, {
              event_id: eventId,
              page,
              row_per_page: rowPerPage,
            }),
          { name: `fetch-circles-event-${eventId}-page-${page}` },
        );

        for (const circle of response.list) {
          const key = [circle.id] as const;
          allCircles.set(key.join("\0"), circle);
        }

        if (page >= response.pageInfo.max_page) break;
        page += 1;
      }
    }

    return allCircles;
  });
}

export function crawlIllustarConcerts(fetcher: Fetcher) {
  return action("crawl-illustar-concerts", function* crawlConcerts() {
    const allConcerts: Infer<typeof concertCollection> = new Map();
    let page = 1;
    const rowPerPage = 100;

    while (true) {
      const response = yield* step(
        () =>
          fetcher.fetch(endpoints.concertList, {
            page,
            row_per_page: rowPerPage,
          }),
        { name: `fetch-concerts-page-${page}` },
      );

      for (const concert of response.list) {
        const key = [concert.id] as const;
        allConcerts.set(key.join("\0"), concert);
      }

      if (page >= response.pageInfo.max_page) break;
      page += 1;
    }

    return allConcerts;
  });
}

export function crawlIllustarSchedule(fetcher: Fetcher) {
  return action("crawl-illustar-schedule", function* crawlSchedule() {
    const { scheduleList } = yield* step(() => fetcher.fetch(endpoints.schedule), {
      name: "fetch-schedule",
    });

    return toMap(scheduleList, (s) => [s.id] as const) as Infer<typeof scheduleCollection>;
  });
}
