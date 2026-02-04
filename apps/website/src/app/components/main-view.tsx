import { useRef, useState } from "react";
import { QueryDataTable } from "@sqlrooms/data-table";
import { SqlMonacoEditor } from "@sqlrooms/sql-editor";
import { PlayIcon } from "lucide-react";
import { useRoomStore } from "../lib/store";

export function MainView() {
  const tables = useRoomStore((state) => state.db.tables);
  const connector = useRoomStore((state) => state.db.connector);
  const firstTable = tables[0];
  const defaultQuery = firstTable ? `SELECT * FROM ${firstTable.table.table} LIMIT 100` : "";

  const [query, setQuery] = useState(defaultQuery);
  const [executedQuery, setExecutedQuery] = useState(defaultQuery);
  const queryRef = useRef(query);
  queryRef.current = query;

  const handleRun = () => {
    setExecutedQuery(queryRef.current);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-2 border-b p-2">
        <div className="h-[120px] flex-1 overflow-hidden rounded border">
          <SqlMonacoEditor
            value={query}
            onChange={(value) => setQuery(value ?? "")}
            connector={connector}
            tableSchemas={tables}
            onMount={(editor, monaco) => {
              editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, handleRun);
            }}
            options={{
              minimap: { enabled: false },
              lineNumbers: "off",
              folding: false,
              scrollBeyondLastLine: false,
            }}
          />
        </div>
        <button
          type="button"
          onClick={handleRun}
          className="flex h-10 items-center gap-1 rounded bg-primary px-3 text-sm text-primary-foreground hover:bg-primary/90"
        >
          <PlayIcon className="h-4 w-4" />
          Run
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        {executedQuery && (
          <QueryDataTable className="h-full" fontSize="text-xs" query={executedQuery} />
        )}
      </div>
    </div>
  );
}
