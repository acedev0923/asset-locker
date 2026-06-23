import { useRef, useCallback } from "react";

export type WasmMetadata = {
  width: number;
  height: number;
  frame_rate: number;
  duration_seconds: number;
  layer_count: number;
  file_size_bytes: number;
  content_hash: string;
};

type ParseResult =
  | { ok: true; metadata: WasmMetadata; rawJson: string }
  | { ok: false; error: string };

type PendingResolve = (result: ParseResult) => void;

/**
 * Hook that manages a singleton Web Worker running the Rust/WASM Lottie parser.
 * The worker is lazily created on first use and reused across calls.
 *
 * The worker returns rawJson alongside metadata so UploadDialog can POST the
 * correct JSON — for .lottie files, file.text() would return binary ZIP data.
 */
export function useLottieParser() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<string, PendingResolve>>(new Map());
  const reqIdRef = useRef(0);

  const getWorker = useCallback((): Worker => {
    if (!workerRef.current) {
      const worker = new Worker(
        new URL("../worker/lottie-worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.addEventListener("message", (event: MessageEvent<{ id: string; ok: boolean; metadata?: WasmMetadata; rawJson?: string; error?: string }>) => {
        const { id, ok } = event.data;
        const resolve = pendingRef.current.get(id);
        if (!resolve) return;
        pendingRef.current.delete(id);
        if (ok && event.data.metadata && event.data.rawJson !== undefined) {
          resolve({ ok: true, metadata: event.data.metadata, rawJson: event.data.rawJson });
        } else {
          resolve({ ok: false, error: event.data.error ?? "Unknown error" });
        }
      });
      workerRef.current = worker;
    }
    return workerRef.current;
  }, []);

  const parse = useCallback(
    (file: File): Promise<ParseResult> => {
      return new Promise((resolve) => {
        const id = String(++reqIdRef.current);
        const worker = getWorker();

        file.arrayBuffer().then((buffer) => {
          const type = file.name.endsWith(".lottie") ? "parse_zip" : "parse_json";
          pendingRef.current.set(id, resolve as PendingResolve);
          // Transfer the buffer to the worker (zero-copy)
          worker.postMessage({ id, type, bytes: buffer }, [buffer]);
        });
      });
    },
    [getWorker],
  );

  return { parse };
}
