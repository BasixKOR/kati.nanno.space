import { Link } from "react-router";
import type { Route } from "./+types/page";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "KATI" }, { name: "description", content: "Korean Subculture Event Platform" }];
}

export default function Home() {
  return (
    <main style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1>KATI</h1>
      <p>Korean Subculture Event Platform</p>
      <nav style={{ marginTop: "2rem" }}>
        <Link to="/sql" style={{ color: "#0066cc" }}>
          SQL Shell
        </Link>
        {" - Query event data with SQL"}
      </nav>
    </main>
  );
}
