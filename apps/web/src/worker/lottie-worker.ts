/**
 * Web Worker that runs the Rust/WASM Lottie parser off the main thread.
 *
 * ZIP decompression for .lottie files is handled here in JS using the browser's
 * native DecompressionStream API (deflate-raw). The extracted JSON bytes are then
 * passed to the Rust parse_lottie function for metadata extraction and SHA-256 hashing.
 *
 * For .lottie files we also return the extracted JSON string so the upload dialog
 * can POST it directly — reading file.text() on a ZIP would give binary garbage.
 */

type WorkerRequest =
  | { id: string; type: "parse_json"; bytes: ArrayBuffer }
  | { id: string; type: "parse_zip"; bytes: ArrayBuffer };

type WasmMetadata = {
  width: number;
  height: number;
  frame_rate: number;
  duration_seconds: number;
  layer_count: number;
  file_size_bytes: number;
  content_hash: string;
};

type WorkerResponse =
  | { id: string; ok: true; metadata: WasmMetadata; rawJson: string }
  | { id: string; ok: false; error: string };

type LottieParserModule = {
  default: (input?: unknown) => Promise<unknown>;
  parse_lottie: (bytes: Uint8Array) => { to_js_object: () => WasmMetadata; free: () => void };
};

let modulePromise: Promise<LottieParserModule> | null = null;

async function getModule(): Promise<LottieParserModule> {
  if (!modulePromise) {
    modulePromise = (async () => {
      const mod = await import("../wasm/lottie_parser.js") as LottieParserModule;
      await mod.default();
      return mod;
    })();
  }
  return modulePromise;
}

/**
 * Extract the first animation .json from a .lottie ZIP archive.
 * Handles stored (method 0) and deflate-compressed (method 8) entries.
 * Skips manifest.json — that is dotLottie metadata, not the animation.
 */
async function extractJsonFromLottie(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 0;

  while (pos + 30 < bytes.length) {
    // Local file header signature: PK\x03\x04
    if (view.getUint32(pos, true) !== 0x04034b50) break;

    const method      = view.getUint16(pos + 8,  true);
    const compSize    = view.getUint32(pos + 18, true);
    const fnameLen    = view.getUint16(pos + 26, true);
    const extraLen    = view.getUint16(pos + 28, true);

    const fnameBytes  = bytes.subarray(pos + 30, pos + 30 + fnameLen);
    const fname       = new TextDecoder().decode(fnameBytes);
    const dataStart   = pos + 30 + fnameLen + extraLen;
    const dataEnd     = dataStart + compSize;

    if (dataEnd > bytes.length) break;

    // Animation files live at animations/*.json — skip manifest.json
    const isAnimation = fname.endsWith(".json")
      && fname !== "manifest.json"
      && !fname.endsWith("/manifest.json");

    if (isAnimation && compSize > 0) {
      // slice() creates a new Uint8Array<ArrayBuffer> (not SharedArrayBuffer)
      const compData = bytes.slice(dataStart, dataEnd);

      if (method === 0) {
        return compData;
      } else if (method === 8) {
        const ds = new DecompressionStream("deflate-raw");
        const writer = ds.writable.getWriter();
        const reader = ds.readable.getReader();

        void writer.write(compData).then(() => writer.close());

        const chunks: Uint8Array<ArrayBuffer>[] = [];
        let totalLen = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          totalLen += value.length;
        }

        const out = new Uint8Array(totalLen);
        let offset = 0;
        for (const chunk of chunks) {
          out.set(chunk, offset);
          offset += chunk.length;
        }
        return out.buffer instanceof ArrayBuffer
          ? (out as Uint8Array<ArrayBuffer>)
          : new Uint8Array(out) as Uint8Array<ArrayBuffer>;
      } else {
        throw new Error(`Unsupported compression method ${method} in .lottie file`);
      }
    }

    pos = dataEnd;
  }

  throw new Error("No animation JSON found inside .lottie zip");
}

self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  const { id, type, bytes } = event.data;

  try {
    const mod = await getModule();
    // slice() ensures we have a plain ArrayBuffer, not SharedArrayBuffer
    let input = new Uint8Array(bytes.slice(0)) as Uint8Array<ArrayBuffer>;

    if (type === "parse_zip") {
      input = await extractJsonFromLottie(input);
    }

    const result = mod.parse_lottie(input);
    const metadata = result.to_js_object();
    result.free();

    // Decode the JSON bytes to a string so UploadDialog can POST it directly.
    // For .lottie files this is the extracted animation JSON, not the ZIP binary.
    const rawJson = new TextDecoder().decode(input);

    const response: WorkerResponse = { id, ok: true, metadata, rawJson };
    self.postMessage(response);
  } catch (err) {
    const response: WorkerResponse = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
});
