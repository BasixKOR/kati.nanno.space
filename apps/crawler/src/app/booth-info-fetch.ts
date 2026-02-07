import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

import sharp from "sharp";

import { Ok, task, work } from "../features/task/index.ts";
import type { Task, OkType } from "../features/task/index.ts";
import { boothInfoPaths } from "./booth-info-shared.ts";
import type { BoothImageMeta } from "./booth-info-shared.ts";

export function boothInfoFetch(url: string): Task<BoothImageMeta> {
  return task("booth-info/fetch", function* () {
    const meta = yield* work(async ($) => {
      $.description(`Downloading image — ${url}`);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Failed to fetch image: ${resp.status}`);
      const arrayBuf = await resp.arrayBuffer();
      const pipeline = sharp(Buffer.from(arrayBuf)).png();
      const [pngBuf, metadata] = await Promise.all([pipeline.toBuffer(), pipeline.metadata()]);
      const sha256 = createHash("sha256").update(pngBuf).digest("hex");

      const paths = boothInfoPaths(sha256);
      $.description(`Writing ${sha256.slice(0, 12)}… → ${paths.dir}`);
      await mkdir(paths.dir, { recursive: true });

      const metaObj: BoothImageMeta = {
        url,
        width: metadata.width!,
        height: metadata.height!,
        sha256,
      };

      await Promise.all([
        writeFile(paths.png, pngBuf),
        writeFile(paths.meta, JSON.stringify(metaObj, undefined, 2), "utf8"),
      ]);

      return metaObj;
    });

    return Ok(meta) as OkType<BoothImageMeta>;
  });
}
