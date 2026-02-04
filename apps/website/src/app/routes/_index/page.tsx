import { useEffect, useState } from "react";
import type { Route } from "./+types/page";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "KATI - SQL Workbench" },
    { name: "description", content: "Query Korean subculture event data with SQL" },
  ];
}

export default function Home() {
  const [RoomClient, setRoomClient] = useState<React.ComponentType>();

  useEffect(() => {
    void import("../../components/room.client").then((m) => {
      setRoomClient(() => m.RoomClient);
      return m;
    });
  }, []);

  if (!RoomClient) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium">Loading KATI SQL Workbench...</div>
          <div className="text-sm text-gray-500 mt-2">Initializing DuckDB</div>
        </div>
      </div>
    );
  }

  return <RoomClient />;
}
