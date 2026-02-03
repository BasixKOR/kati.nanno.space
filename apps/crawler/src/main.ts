import { dirname, resolve } from "node:path";
import { crawlIllustar, persistIllustar } from "./app/illustar.ts";
import { createFetcher } from "./services/endpoint.ts";
import { createSession, runTask } from "./features/task/index.ts";
import { fileURLToPath } from "node:url";
import { renderTasks } from "./ui.tsx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, "../../../data/illustar");

const fetcher = createFetcher();
const session = createSession({ fetcher });

const illustarTask = crawlIllustar();
const { events, result } = runTask(illustarTask, session);

await renderTasks([{ name: illustarTask.name, result: { events, result } }]);

const finalResult = await result;
if (finalResult.ok) {
  await persistIllustar(finalResult.data, dataDir);
}

process.exit(0);
