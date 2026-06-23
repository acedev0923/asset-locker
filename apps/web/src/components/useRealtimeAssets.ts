import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { assetsQueryKey } from "./queryKeys.js";

/**
 * Connects to the SSE endpoint and invalidates the assets query cache
 * whenever a new asset is created in another tab or session.
 *
 * SSE was chosen because:
 * - Asset notifications are strictly server → client (no need for bidirectional WS)
 * - The browser's EventSource API handles reconnection automatically
 * - No extra server infrastructure vs WebSockets
 * - Works seamlessly with TanStack Query cache invalidation
 */
export function useRealtimeAssets() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const es = new EventSource("/api/sse");

    es.addEventListener("message", (event: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(event.data) as { type: string; assetId: string };
        if (msg.type === "asset:created") {
          // Invalidate so the grid refetches and includes the new asset
          void queryClient.invalidateQueries({ queryKey: assetsQueryKey });
        }
      } catch {
        // Malformed message — ignore
      }
    });

    es.addEventListener("error", () => {
      // EventSource reconnects automatically — no action needed
    });

    return () => es.close();
  }, [queryClient]);
}
