/**
 * SSE-based real-time notification system.
 *
 * Choice rationale: SSE (Server-Sent Events) is ideal here because:
 * - The data flow is strictly one-direction: server → client (new asset notifications)
 * - SSE works over plain HTTP, no WebSocket upgrade handshake needed
 * - Automatic reconnection is built into the browser EventSource API
 * - No extra infrastructure (Redis pub/sub, WS server) needed for our single-process Node server
 *
 * Tradeoffs vs WebSockets: WebSockets would allow bidirectional communication (useful
 * if we ever need client-to-client messaging), but add complexity. BroadcastChannel
 * only works within a single browser profile, not across tabs in different browser
 * sessions or machines.
 *
 * In production with multiple server instances, we'd replace the in-memory Set
 * with a Redis pub/sub subscription per SSE connection.
 */

type SseClient = {
  userId: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
};

const encoder = new TextEncoder();
const clients = new Set<SseClient>();

export function registerSseClient(
  userId: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
): () => void {
  const client: SseClient = { userId, controller };
  clients.add(client);
  return () => clients.delete(client);
}

export function broadcastAssetCreated(userId: string, assetId: string): void {
  const data = JSON.stringify({ type: "asset:created", assetId });
  const message = encoder.encode(`data: ${data}\n\n`);

  for (const client of clients) {
    if (client.userId === userId) {
      try {
        client.controller.enqueue(message);
      } catch {
        // Client disconnected — will be cleaned up by its own disconnect handler
        clients.delete(client);
      }
    }
  }
}
