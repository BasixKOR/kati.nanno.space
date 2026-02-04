import { Suspense, lazy } from "react";
import type { Route } from "./+types/page";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "SQL Shell - KATI" },
    { name: "description", content: "Query KATI data with SQL" },
  ];
}

const SqlShellClient = lazy(() =>
  import("../../components/SqlShell.client").then((m) => ({
    default: m.SqlShellClient,
  })),
);

export default function SqlPage() {
  return (
    <main style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "1rem" }}>SQL Shell</h1>
      <p style={{ marginBottom: "1.5rem", color: "#666" }}>
        Query KATI event data using DuckDB SQL. Your queries run entirely in your browser.
      </p>
      <Suspense fallback={<div>Loading SQL Shell...</div>}>
        <SqlShellClient />
      </Suspense>
    </main>
  );
}
