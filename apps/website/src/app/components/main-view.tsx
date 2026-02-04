import { useCallback, useRef, useState } from "react";
import type { DataTable, DuckDbConnector } from "@sqlrooms/duckdb";
import { QueryDataTable } from "@sqlrooms/data-table";
import { SqlMonacoEditor } from "@sqlrooms/sql-editor";
import {
  CheckCircleIcon,
  CircleIcon,
  GripHorizontalIcon,
  PlusIcon,
  PlayIcon,
  XIcon,
} from "lucide-react";
import { useRoomStore } from "../lib/store";

type QueryCell = {
  id: string;
  query: string;
  executedQuery: string;
  resultHeight: number;
};

function ResizeHandle({
  onResizeStart,
  onResize,
}: {
  onResizeStart: () => void;
  onResize: (delta: number) => void;
}) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      onResizeStart();

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientY - startY;
        onResize(delta);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [onResizeStart, onResize],
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      className="flex h-3 cursor-row-resize items-center justify-center border-t bg-muted/30 hover:bg-muted/50"
    >
      <GripHorizontalIcon className="h-3 w-3 text-muted-foreground/50" />
    </div>
  );
}

function QueryCellComponent({
  cell,
  index,
  connector,
  tables,
  onUpdate,
  onRemove,
  canRemove,
}: {
  cell: QueryCell;
  index: number;
  connector: DuckDbConnector;
  tables: DataTable[];
  onUpdate: (id: string, updates: Partial<QueryCell>) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}) {
  const queryRef = useRef(cell.query);
  queryRef.current = cell.query;

  const startHeightRef = useRef(cell.resultHeight);

  const handleRun = () => {
    onUpdate(cell.id, { executedQuery: queryRef.current });
  };

  const handleResizeStart = () => {
    startHeightRef.current = cell.resultHeight;
  };

  const handleResize = useCallback(
    (delta: number) => {
      const newHeight = Math.max(100, Math.min(600, startHeightRef.current + delta));
      onUpdate(cell.id, { resultHeight: newHeight });
    },
    [cell.id, onUpdate],
  );

  return (
    <div id={`cell-${cell.id}`} className="m-3 overflow-hidden rounded-lg border shadow-sm">
      {/* Editor Header */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">Query {index + 1}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">⌘+Enter</span>
          <button
            type="button"
            onClick={handleRun}
            className="flex items-center gap-1.5 rounded bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <PlayIcon className="h-3 w-3" />
            Run
          </button>
          {canRemove && (
            <button
              type="button"
              onClick={() => onRemove(cell.id)}
              className="flex items-center rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="h-[120px]">
        <SqlMonacoEditor
          value={cell.query}
          onChange={(value) => onUpdate(cell.id, { query: value ?? "" })}
          connector={connector}
          tableSchemas={tables}
          onMount={(editor, monaco) => {
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, handleRun);
          }}
          options={{
            minimap: { enabled: false },
            lineNumbers: "on",
            folding: false,
            scrollBeyondLastLine: false,
            fontSize: 13,
            padding: { top: 8, bottom: 8 },
          }}
        />
      </div>

      {/* Results */}
      {cell.executedQuery && (
        <>
          <div className="border-t" style={{ height: cell.resultHeight }}>
            <QueryDataTable className="h-full" fontSize="text-xs" query={cell.executedQuery} />
          </div>
          <ResizeHandle onResizeStart={handleResizeStart} onResize={handleResize} />
        </>
      )}
    </div>
  );
}

function CellSummary({
  cells,
  onScrollTo,
}: {
  cells: QueryCell[];
  onScrollTo: (id: string) => void;
}) {
  return (
    <div className="flex h-full w-48 flex-col border-l bg-muted/20">
      <div className="border-b bg-muted/30 px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">Cells</span>
      </div>
      <div className="flex-1 overflow-auto p-2">
        {cells.map((cell, index) => (
          <button
            key={cell.id}
            type="button"
            onClick={() => onScrollTo(cell.id)}
            className="mb-1 flex w-full items-start gap-2 rounded p-2 text-left transition-colors hover:bg-muted"
          >
            {cell.executedQuery ? (
              <CheckCircleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />
            ) : (
              <CircleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium">Query {index + 1}</div>
              <div className="truncate text-[10px] text-muted-foreground">
                {cell.query.trim().slice(0, 30) || "(empty)"}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function MainView() {
  const tables = useRoomStore((state) => state.db.tables);
  const connector = useRoomStore((state) => state.db.connector);
  const [firstTable] = tables;
  const defaultQuery = firstTable ? `SELECT * FROM ${firstTable.table.table} LIMIT 100` : "";

  const [cells, setCells] = useState<QueryCell[]>([
    { id: "1", query: defaultQuery, executedQuery: "", resultHeight: 200 },
  ]);

  const addCell = () => {
    setCells((prev) => [
      ...prev,
      { id: crypto.randomUUID(), query: "", executedQuery: "", resultHeight: 200 },
    ]);
  };

  const updateCell = (id: string, updates: Partial<QueryCell>) => {
    setCells((prev) => prev.map((cell) => (cell.id === id ? { ...cell, ...updates } : cell)));
  };

  const removeCell = (id: string) => {
    setCells((prev) => prev.filter((cell) => cell.id !== id));
  };

  const scrollToCell = (id: string) => {
    document.querySelector(`#cell-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex h-full bg-background">
      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-muted/10 py-1">
        {cells.map((cell, index) => (
          <QueryCellComponent
            key={cell.id}
            cell={cell}
            index={index}
            connector={connector}
            tables={tables}
            onUpdate={updateCell}
            onRemove={removeCell}
            canRemove={cells.length > 1}
          />
        ))}

        {/* Add Cell Button */}
        <div className="flex justify-center p-4">
          <button
            type="button"
            onClick={addCell}
            className="flex items-center gap-1.5 rounded border border-dashed border-muted-foreground/30 px-4 py-2 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Add Query
          </button>
        </div>
      </div>

      {/* Right Sidebar - Cell Summary */}
      <CellSummary cells={cells} onScrollTo={scrollToCell} />
    </div>
  );
}
