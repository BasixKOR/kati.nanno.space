import { action, step } from "../features/action/index.ts";
import type { Fetcher } from "../services/endpoint.ts";
import { endpoints } from "../services/illustar/index.ts";

export function listIllustarEvents(fetcher: Fetcher) {
  return action("list-illustar-events", function* listEvents() {
    const { eventInfo } = yield* step(() => fetcher.fetch(endpoints.eventList), {
      name: "fetch-event-list",
    });

    return eventInfo;
  });
}
