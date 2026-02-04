import type { RouteConfig } from "@react-router/dev/routes";
import { remixRoutesOptionAdapter } from "@react-router/remix-routes-option-adapter";
import { flatRoutes } from "remix-flat-routes";

const routes = remixRoutesOptionAdapter((defineRoutes) =>
  flatRoutes("routes", defineRoutes, {
    appDir: "src/app",
    ignoredRouteFiles: ["!**/+(page|*_route|route|*_layout|layout).+(ts|tsx)"],
  }),
) satisfies RouteConfig;

export default routes;
