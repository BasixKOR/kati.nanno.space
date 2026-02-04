import { RoomPanel } from "@sqlrooms/room-shell";
import { QueryEditorPanel, QueryResultPanel } from "@sqlrooms/sql-editor";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@sqlrooms/ui";
import { RoomPanelTypes } from "../lib/sqlrooms/store";

export function SqlPanel() {
  return (
    <RoomPanel type={RoomPanelTypes.enum.sql}>
      <ResizablePanelGroup direction="vertical">
        <ResizablePanel defaultSize={40}>
          <QueryEditorPanel />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={60}>
          <QueryResultPanel />
        </ResizablePanel>
      </ResizablePanelGroup>
    </RoomPanel>
  );
}
