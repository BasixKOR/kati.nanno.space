import type { AnyModel, CollectionModel, Infer } from "../features/model/index.ts";
import { deserialize, merge, serialize } from "../features/model/index.ts";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

async function readJsonlFiles(dir: string): Promise<ReadonlyMap<string, string>> {
  const files = new Map<string, string>();
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry.endsWith(".jsonl")) {
      const content = await readFile(join(dir, entry), "utf8");
      files.set(entry, content);
    }
  }
  return files;
}

async function writeJsonlFiles(dir: string, files: ReadonlyMap<string, string>): Promise<void> {
  await mkdir(dir, { recursive: true });
  for (const [filename, content] of files) {
    await writeFile(join(dir, filename), content, "utf8");
  }
}

export async function persist<M extends CollectionModel>(
  model: M,
  data: Infer<M>,
  name: string,
  dataDir: string,
): Promise<void> {
  const existingFiles = await readJsonlFiles(dataDir);
  const existing =
    existingFiles.size > 0
      ? (deserialize(model as AnyModel, { files: existingFiles }, name) as Infer<M>)
      : (new Map() as Infer<M>);

  const merged = merge(
    model as AnyModel,
    existing as Infer<AnyModel>,
    data as Infer<AnyModel>,
  ) as Infer<M>;
  const serialized = serialize(model as AnyModel, merged as Infer<AnyModel>, name);
  await writeJsonlFiles(dataDir, serialized.files);
}
