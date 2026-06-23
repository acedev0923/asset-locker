import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLottieParser, type WasmMetadata } from "./useLottieParser.js";
import { assetsQueryKey } from "./queryKeys.js";

type UploadState =
  | { phase: "idle" }
  | { phase: "parsing"; fileName: string }
  | { phase: "preview"; fileName: string; metadata: WasmMetadata; file: File; rawJson: string }
  | { phase: "uploading" }
  | { phase: "error"; message: string };

export function UploadDialog({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<UploadState>({ phase: "idle" });
  const [assetName, setAssetName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { parse } = useLottieParser();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async ({
      name,
      file,
      metadata,
      rawJson,
    }: {
      name: string;
      file: File;
      metadata: WasmMetadata;
      rawJson: string;
    }) => {
      const fileType = file.name.endsWith(".lottie") ? "lottie" : "json";

      const res = await fetch("/api/v1/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          originalFilename: file.name,
          fileType,
          rawJson,
          metadata: {
            width: metadata.width,
            height: metadata.height,
            frameRate: metadata.frame_rate,
            durationSeconds: metadata.duration_seconds,
            layerCount: metadata.layer_count,
            fileSizeBytes: metadata.file_size_bytes,
            contentHash: metadata.content_hash,
          } satisfies import("@asset-locker/core").AssetMetadata,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" })) as { error?: string };
        throw new Error(err.error ?? "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: assetsQueryKey });
      onClose();
    },
    onError: (err: Error) => {
      setState({ phase: "error", message: err.message });
    },
  });

  const handleFileSelect = async (file: File) => {
    setState({ phase: "parsing", fileName: file.name });
    setAssetName(file.name.replace(/\.(json|lottie)$/, ""));

    const result = await parse(file);
    if (!result.ok) {
      setState({ phase: "error", message: result.error });
      return;
    }
    setState({ phase: "preview", fileName: file.name, metadata: result.metadata, file, rawJson: result.rawJson });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void handleFileSelect(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (state.phase !== "preview") return;
    setState({ phase: "uploading" });
    uploadMutation.mutate({ name: assetName, file: state.file, metadata: state.metadata, rawJson: state.rawJson });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Upload Animation</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Drop Zone */}
          {(state.phase === "idle" || state.phase === "error") && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
            >
              <div className="text-4xl mb-3">🎬</div>
              <p className="text-gray-600 font-medium">Drop a .json or .lottie file here</p>
              <p className="text-sm text-gray-400 mt-1">or click to browse</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.lottie"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFileSelect(f);
                }}
              />
            </div>
          )}

          {state.phase === "parsing" && (
            <div className="text-center py-8">
              <div className="inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-gray-600">Parsing <strong>{state.fileName}</strong> in WASM worker…</p>
            </div>
          )}

          {(state.phase === "preview" || state.phase === "uploading") && state.phase !== "idle" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Asset name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Asset name
                </label>
                <input
                  type="text"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Metadata preview */}
              {state.phase === "preview" && (
                <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
                  <p className="font-medium text-gray-700 mb-2">Extracted metadata (from WASM)</p>
                  <MetaRow label="Dimensions" value={`${state.metadata.width} × ${state.metadata.height}px`} />
                  <MetaRow label="Frame rate" value={`${state.metadata.frame_rate} fps`} />
                  <MetaRow label="Duration" value={`${state.metadata.duration_seconds.toFixed(2)}s`} />
                  <MetaRow label="Layers" value={String(state.metadata.layer_count)} />
                  <MetaRow label="File size" value={formatBytes(state.metadata.file_size_bytes)} />
                  <MetaRow label="Content hash" value={state.metadata.content_hash.slice(0, 16) + "…"} />
                </div>
              )}

              <button
                type="submit"
                disabled={state.phase === "uploading"}
                className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {state.phase === "uploading" ? "Uploading…" : "Save to library"}
              </button>
            </form>
          )}

          {state.phase === "error" && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              <strong>Error:</strong> {state.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-mono text-xs">{value}</span>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
