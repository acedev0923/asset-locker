import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-20">
      {/* Hero */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 border border-indigo-100">
          <span>⚡</span> Powered by Rust/WASM
        </div>
        <h1 className="text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
          Your Lottie animation
          <br />
          <span className="text-indigo-600">library, organised.</span>
        </h1>
        <p className="text-gray-500 text-lg max-w-xl mx-auto mb-8">
          Upload <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">.json</code> and{" "}
          <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">.lottie</code> files. Metadata is extracted
          instantly in a Rust WASM worker — dimensions, frame rate, SHA-256 hash, and more.
        </p>
        <Link
          to="/library"
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-8 py-3.5 rounded-xl font-semibold hover:bg-indigo-700 active:scale-95 transition-all shadow-sm"
        >
          Open Library →
        </Link>
      </div>

      {/* Feature grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <FeatureCard
          icon="🦀"
          title="Rust/WASM Parser"
          description="Files are parsed off the main thread in a Web Worker. SHA-256 hashing, dimension extraction, and ZIP handling — all in compiled Rust."
        />
        <FeatureCard
          icon="⚡"
          title="Server-Side Rendered"
          description="The library grid loads instantly via TanStack Start SSR. No loading spinners on first paint — data is serialised into the HTML."
        />
        <FeatureCard
          icon="🔄"
          title="Real-Time Sync"
          description="Upload in one tab, see it appear in another. SSE (Server-Sent Events) broadcasts new uploads to all open tabs automatically."
        />
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}
