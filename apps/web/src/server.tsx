import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";
import { createApiApp } from "./server/api.js";

const startHandler = createStartHandler(defaultStreamHandler);
const apiApp = createApiApp();

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    // Dispatch /api/* to the Hono API layer; everything else goes to TanStack Start
    if (url.pathname.startsWith("/api/")) {
      return apiApp.fetch(req);
    }
    return startHandler(req);
  },
};
