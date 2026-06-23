import { createFileRoute, notFound, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect, useRef } from "react";
import lottie, { type AnimationItem } from "lottie-web";
import { getAsset, removeAsset } from "../server/functions.js";
import { assetQueryKey, assetsQueryKey } from "../components/queryKeys.js";

export const Route = createFileRoute("/asset/$id")({
  loader: async ({ params }) => {
    const asset = await getAsset({ data: { id: params.id } });
    if (!asset) throw notFound();
    return asset;
  },

  notFoundComponent: () => (
    <div className="max-w-2xl mx-auto px-6 py-16 text-center">
      <div className="text-5xl mb-4">🔍</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Asset not found</h2>
      <Link to="/library" className="text-indigo-600 hover:underline text-sm">
        Back to library
      </Link>
    </div>
  ),

  component: AssetDetailPage,
});

function AssetDetailPage() {
  const loaderData = Route.useLoaderData();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [playerError, setPlayerError] = useState(false);

  const { data: asset } = useQuery({
    queryKey: assetQueryKey(id),
    queryFn: () => getAsset({ data: { id } }),
    initialData: loaderData,
    staleTime: 60_000,
  });

  const deleteMutation = useMutation({
    mutationFn: () => removeAsset({ data: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: assetsQueryKey });
      void navigate({ to: "/library" });
    },
  });

  const handleDelete = () => {
    if (confirm("Delete this asset? This cannot be undone.")) {
      deleteMutation.mutate();
    }
  };

  // Parse once — rawJson is the extracted animation JSON for both .json and .lottie files
  const animationData = useMemo(() => {
    try {
      return JSON.parse(asset?.rawJson ?? "null") as object;
    } catch {
      return null;
    }
  }, [asset?.rawJson]);

  if (!asset) return null;

  const meta = asset.metadata;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <Link to="/library" className="text-sm text-gray-400 hover:text-indigo-600 inline-flex items-center gap-1">
          ← Library
        </Link>
        <button
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="text-sm text-red-500 hover:text-red-700 hover:bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {deleteMutation.isPending ? "Deleting…" : "Delete asset"}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Animation player */}
        <div className="lg:col-span-2">
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl overflow-hidden border border-gray-100 flex items-center justify-center aspect-square">
            {animationData && !playerError ? (
              <LottiePlayer animationData={animationData} onError={() => setPlayerError(true)} />
            ) : (
              <span className="text-6xl opacity-40">🎬</span>
            )}
          </div>
          <p className="text-center text-xs text-gray-400 mt-2">
            {meta.durationSeconds.toFixed(2)}s · {meta.frameRate} fps · loops
          </p>
        </div>

        {/* Metadata column */}
        <div className="lg:col-span-3 space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{asset.name}</h1>
            <p className="text-sm text-gray-400 font-mono mt-1">{asset.originalFilename}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Metadata</h2>
            <MetaRow label="Dimensions" value={`${meta.width} × ${meta.height} px`} />
            <MetaRow label="Frame rate" value={`${meta.frameRate} fps`} />
            <MetaRow label="Duration" value={`${meta.durationSeconds.toFixed(3)} s`} />
            <MetaRow label="Layers" value={String(meta.layerCount)} />
            <MetaRow label="File size" value={formatBytes(meta.fileSizeBytes)} />
            <MetaRow label="File type" value={asset.fileType.toUpperCase()} />
            <MetaRow label="Uploaded" value={new Date(asset.createdAt).toLocaleString()} />
            <div className="pt-2 border-t border-gray-50">
              <p className="text-xs text-gray-400 mb-1">Content hash (SHA-256)</p>
              <p className="text-xs font-mono text-gray-600 break-all">{meta.contentHash}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Raw JSON viewer */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Raw JSON</h2>
        <div className="bg-gray-900 rounded-2xl overflow-auto max-h-96">
          <pre className="text-green-400 text-xs p-5 whitespace-pre-wrap break-all">
            {formatJson(asset.rawJson)}
          </pre>
        </div>
      </div>
    </div>
  );
}

function LottiePlayer({
  animationData,
  onError,
}: {
  animationData: object;
  onError: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    try {
      animRef.current = lottie.loadAnimation({
        container: containerRef.current,
        renderer: "svg",
        loop: true,
        autoplay: true,
        animationData,
      });
      animRef.current.addEventListener("error", onError);
    } catch {
      onError();
    }
    return () => {
      animRef.current?.destroy();
      animRef.current = null;
    };
  }, [animationData, onError]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium">{value}</span>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
