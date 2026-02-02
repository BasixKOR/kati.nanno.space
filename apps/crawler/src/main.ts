import type { ActionEntry } from "./app/types.ts";
import { createFetcher } from "./services/endpoint.ts";
import { listIllustarEvents } from "./app/illustar.ts";
import { renderActions } from "./ui.tsx";
import { run } from "./features/action/index.ts";

const fetcher = createFetcher();

const actions: ActionEntry[] = [
  { name: "list-illustar-events", result: run(listIllustarEvents(fetcher)) },
];

const { unmount } = renderActions(actions);

await Promise.all(actions.map((a) => a.result.result));
unmount();
