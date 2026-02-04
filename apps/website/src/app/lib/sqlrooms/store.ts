import { createRoomShellSlice, createRoomStore, LayoutTypes } from "@sqlrooms/room-shell";
import type { RoomShellSliceState } from "@sqlrooms/room-shell";
import { createSqlEditorSlice } from "@sqlrooms/sql-editor";
import type { SqlEditorSliceState } from "@sqlrooms/sql-editor";
import { DatabaseIcon } from "lucide-react";
import { lazy } from "react";
import { z } from "zod";

const DataPanel = lazy(() =>
  import("../../components/data-panel").then((m) => ({ default: m.DataPanel })),
);
const SqlPanel = lazy(() =>
  import("../../components/sql-panel").then((m) => ({ default: m.SqlPanel })),
);

export const RoomPanelTypes = z.enum(["data", "sql"] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

export type RoomState = RoomShellSliceState & SqlEditorSliceState;

export const { roomStore, useRoomStore } = createRoomStore<RoomState>((set, get, store) => ({
  ...createRoomShellSlice({
    config: {
      title: "KATI SQL",
      dataSources: [
        { tableName: "circles", type: "url", url: "/data/circles.parquet" },
        { tableName: "concerts", type: "url", url: "/data/concerts.parquet" },
        { tableName: "events", type: "url", url: "/data/events.parquet" },
        { tableName: "ongoing_booth_info", type: "url", url: "/data/ongoing_booth_info.parquet" },
        { tableName: "schedule", type: "url", url: "/data/schedule.parquet" },
      ],
    },
    layout: {
      config: {
        type: LayoutTypes.enum.mosaic,
        nodes: {
          first: RoomPanelTypes.enum.data,
          second: RoomPanelTypes.enum.sql,
          direction: "row",
          splitPercentage: 25,
        },
      },
      panels: {
        [RoomPanelTypes.enum.data]: {
          title: "Tables",
          component: DataPanel,
          icon: DatabaseIcon,
          placement: "sidebar",
        },
        [RoomPanelTypes.enum.sql]: {
          component: SqlPanel,
          placement: "main",
        },
      },
    },
  })(set, get, store),
  ...createSqlEditorSlice()(set, get, store),
}));
