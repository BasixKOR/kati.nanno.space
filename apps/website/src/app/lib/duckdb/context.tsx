import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AsyncDuckDB, AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";

interface DuckDBContextValue {
  db: AsyncDuckDB | null;
  conn: AsyncDuckDBConnection | null;
  loading: boolean;
  error: Error | null;
  runQuery: (sql: string) => Promise<QueryResult>;
}

interface QueryResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
}

const DuckDBContext = createContext<DuckDBContextValue | null>(null);

export function DuckDBProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<AsyncDuckDB | null>(null);
  const [conn, setConn] = useState<AsyncDuckDBConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const duckdb = await import("@duckdb/duckdb-wasm");

        const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
        const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

        const worker = new Worker(bundle.mainWorker!);
        const logger = new duckdb.ConsoleLogger();
        const database = new duckdb.AsyncDuckDB(logger, worker);

        await database.instantiate(bundle.mainModule, bundle.pthreadWorker);

        if (cancelled) {
          await database.terminate();
          return;
        }

        const connection = await database.connect();

        setDb(database);
        setConn(connection);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  const runQuery = useCallback(
    async (sql: string): Promise<QueryResult> => {
      if (!conn) {
        throw new Error("Database not initialized");
      }

      const result = await conn.query(sql);
      const columns = result.schema.fields.map((f) => f.name);
      const rows: unknown[][] = [];

      for (const row of result) {
        const rowData: unknown[] = [];
        for (const col of columns) {
          rowData.push(row[col]);
        }
        rows.push(rowData);
      }

      return {
        columns,
        rows,
        rowCount: result.numRows,
      };
    },
    [conn],
  );

  const value = useMemo(
    () => ({ db, conn, loading, error, runQuery }),
    [db, conn, loading, error, runQuery],
  );

  return <DuckDBContext.Provider value={value}>{children}</DuckDBContext.Provider>;
}

export function useDuckDB() {
  const context = useContext(DuckDBContext);
  if (!context) {
    throw new Error("useDuckDB must be used within a DuckDBProvider");
  }
  return context;
}
