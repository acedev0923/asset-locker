#!/usr/bin/env node
// Pure JS baseline: JSON.parse + field extraction + SHA-256
// Measures what a synchronous JS implementation on the main thread would cost.
// Node 20+ required (uses performance.now() and crypto built-in).

const { createHash } = require("crypto");

function makeLottie(layerCount) {
  const layers = Array.from({ length: layerCount }, (_, i) => ({
    ty: 4,
    nm: "layer_" + i,
    ind: i,
    ip: 0,
    op: 60,
    ks: {
      p: { a: 0, k: [0, 0] },
      s: { a: 0, k: [100, 100] },
      r: { a: 0, k: 0 },
      o: { a: 0, k: 100 },
    },
    shapes: Array.from({ length: 5 }, () => ({
      ty: "sh",
      ks: { a: 0, k: { i: [[0, 0]], o: [[0, 0]], v: [[0, 0]] } },
    })),
  }));
  return JSON.stringify({
    v: "5.7.0",
    fr: 30,
    ip: 0,
    op: 90,
    w: 800,
    h: 600,
    nm: "bench",
    layers,
  });
}

const CASES = [
  { label: "~5 KB  (10 layers)", json: makeLottie(10) },
  { label: "~48 KB (100 layers)", json: makeLottie(100) },
  { label: "~478 KB (1000 layers)", json: makeLottie(1000) },
];

const WARMUP = 20;
const RUNS = 1000;

function bench(label, fn, runs) {
  for (let i = 0; i < WARMUP; i++) fn();
  const t0 = performance.now();
  for (let i = 0; i < runs; i++) fn();
  return (performance.now() - t0) / runs;
}

console.log("\nLottie parser JS baseline — Node.js", process.version);
console.log("=".repeat(62));
console.log(
  "File size".padEnd(26),
  "parse+hash".padStart(12),
  "hash only".padStart(12),
  "parse only".padStart(12)
);
console.log("-".repeat(62));

for (const { label, json } of CASES) {
  const buf = Buffer.from(json);

  const combined = bench(
    label,
    () => {
      const p = JSON.parse(json);
      const _ = {
        width: p.w,
        height: p.h,
        frameRate: p.fr,
        layerCount: p.layers?.length ?? 0,
        durationSeconds: p.fr > 0 ? (p.op - p.ip) / p.fr : 0,
      };
      createHash("sha256").update(buf).digest("hex");
    },
    RUNS
  );

  const hashOnly = bench(
    label,
    () => createHash("sha256").update(buf).digest("hex"),
    RUNS
  );

  const parseOnly = bench(
    label,
    () => {
      const p = JSON.parse(json);
      return p.layers?.length;
    },
    RUNS
  );

  console.log(
    label.padEnd(26),
    (combined.toFixed(3) + " ms").padStart(12),
    (hashOnly.toFixed(4) + " ms").padStart(12),
    (parseOnly.toFixed(3) + " ms").padStart(12)
  );
}

console.log("\nAll times are per-call averages over", RUNS, "iterations.");
console.log(
  "SHA-256 uses Node's built-in OpenSSL — this is the fastest JS can go."
);
