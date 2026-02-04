import { useState } from "react";
import { TableIcon } from "lucide-react";
import { useRoomStore } from "../lib/store";

export function DataSourcesPanel() {
  const tables = useRoomStore((state) => state.db.tables);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const selected = tables.find((t) => t.table.table === selectedTable);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-1 p-2">
        {tables.map((t) => (
          <button
            key={t.table.table}
            type="button"
            onClick={() => setSelectedTable(t.table.table)}
            className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted ${
              selectedTable === t.table.table ? "bg-muted" : ""
            }`}
          >
            <TableIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{t.table.table}</span>
          </button>
        ))}
      </div>

      {selected && (
        <div className="mt-auto border-t p-2">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Schema</div>
          <div className="space-y-1">
            {selected.columns.map((col) => (
              <div key={col.name} className="flex items-center justify-between text-xs">
                <span className="truncate">{col.name}</span>
                <span className="text-muted-foreground">{col.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
