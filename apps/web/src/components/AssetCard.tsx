import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo } from "react";
import lottie, { type AnimationItem } from "lottie-web";
import type { Asset } from "@asset-locker/core";

export function AssetCard({ asset }: { asset: Asset }) {
  const fileTypeBadge = asset.fileType === "lottie" ? "LOTTIE" : "JSON";
  const [hovered, setHovered] = useState(false);

  const animationData = useMemo(() => {
    try {
      return JSON.parse(asset.rawJson) as object;
    } catch {
      return null;
    }
  }, [asset.rawJson]);

  return (
    <Link
      to="/asset/$id"
      params={{ id: asset.id }}
      className="group block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:border-indigo-200 transition-all duration-150"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center border-b border-gray-100 overflow-hidden">
        {hovered && animationData ? (
          <CardLottiePlayer animationData={animationData} />
        ) : (
          <span className="text-4xl opacity-50">🎬</span>
        )}
        <span className="absolute bottom-2 left-2 text-[10px] font-bold tracking-wide bg-white/90 border border-gray-200 px-1.5 py-0.5 rounded text-gray-500 z-10">
          {fileTypeBadge}
        </span>
        <span className="absolute bottom-2 right-2 text-[10px] font-mono bg-white/90 border border-gray-200 px-1.5 py-0.5 rounded text-gray-500 z-10">
          {asset.metadata.durationSeconds.toFixed(1)}s
        </span>
      </div>

      <div className="p-4">
        <p className="font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors text-sm">
          {asset.name}
        </p>
        <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
          <span>{asset.metadata.width} × {asset.metadata.height}</span>
          <span>·</span>
          <span>{asset.metadata.frameRate} fps</span>
          <span>·</span>
          <span>{asset.metadata.layerCount} layers</span>
        </div>
        <p className="text-[10px] text-gray-300 truncate font-mono mt-2">{asset.id}</p>
      </div>
    </Link>
  );
}

function CardLottiePlayer({ animationData }: { animationData: object }) {
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
    } catch {
      // silently fall back — placeholder stays visible
    }
    return () => {
      animRef.current?.destroy();
      animRef.current = null;
    };
  }, [animationData]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
    />
  );
}
