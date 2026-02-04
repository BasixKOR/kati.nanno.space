import { RoomPanel } from "@sqlrooms/room-shell";
import { TableStructurePanel } from "@sqlrooms/sql-editor";
import { RoomPanelTypes } from "../lib/sqlrooms/store";

export function DataPanel() {
  return (
    <RoomPanel type={RoomPanelTypes.enum.data}>
      <TableStructurePanel />
    </RoomPanel>
  );
}
