import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { getAssetsPage } from "../server/functions.js";
import { AssetCard } from "../components/AssetCard.js";
import { UploadDialog } from "../components/UploadDialog.js";
import { useRealtimeAssets } from "../components/useRealtimeAssets.js";
import { assetsQueryKey } from "../components/queryKeys.js";

const searchSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
});

/**
 * Library route with SSR via loader.
 *
 * Loader data is the initial server-rendered payload. TanStack Query then
 * takes over for any post-hydration updates (page navigation, SSE invalidations).
 * The boundary:
 *   - Loader: runs on the server, fetches page 1 for first meaningful paint
 *   - TanStack Query: manages client cache, handles page changes and invalidations
 */
export const Route = createFileRoute("/library")({
  validateSearch: searchSchema,

  loaderDeps: ({ search }) => ({ page: search.page }),

  loader: async ({ deps }) => {
    return getAssetsPage({ data: { page: deps.page, pageSize: 20 } });
  },

  component: LibraryPage,
});

function LibraryPage() {
  const loaderData = Route.useLoaderData();
  const { page } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [showUpload, setShowUpload] = useState(false);

  // SSE → invalidates this query when new assets are uploaded in other tabs
  useRealtimeAssets();

  // TanStack Query hydrates from loader data, then manages client-side updates
  const { data } = useQuery({
    queryKey: [...assetsQueryKey, { page }],
    queryFn: () => getAssetsPage({ data: { page, pageSize: 20 } }),
    initialData: loaderData,
    staleTime: 15_000,
  });

  const goToPage = (p: number) => navigate({ search: (prev) => ({ ...prev, page: p }) });

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Library</h1>
          <p className="text-sm text-gray-400 mt-0.5">{data.total} animations</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <span>+</span> Upload
        </button>
      </div>

      {data.assets.length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          <div className="text-5xl mb-4">📂</div>
          <p className="font-medium">No animations yet</p>
          <p className="text-sm mt-1">Upload your first .json or .lottie file to get started</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {data.assets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} />
            ))}
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                ← Prev
              </button>
              <span className="text-sm text-gray-500">
                Page {page} of {data.totalPages}
              </span>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= data.totalPages}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {showUpload && <UploadDialog onClose={() => setShowUpload(false)} />}
    </div>
  );
}
