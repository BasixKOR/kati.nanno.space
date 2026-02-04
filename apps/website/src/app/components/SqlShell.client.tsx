import { DuckDBProvider } from "../lib/duckdb/context";
import { SqlShell } from "./SqlShell";

export function SqlShellClient() {
  return (
    <DuckDBProvider>
      <SqlShell />
    </DuckDBProvider>
  );
}
