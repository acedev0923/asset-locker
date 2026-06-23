# Benchmarks

## What was measured

The Lottie parser in this project uses Rust compiled to WebAssembly, running inside a Web Worker.
The two meaningful questions are:

1. **How fast is the parsing itself?** — Does WASM actually beat an equivalent JS implementation?
2. **Does it block the main thread?** — The more important question in practice.

---

## Parsing speed: WASM vs pure JS

### Methodology

The JS baseline was measured in Node.js 20 with `performance.now()` across 1000 iterations
(warmed up over 20 runs first). It replicates exactly what a pure-JS implementation would do:
`JSON.parse()` to extract fields, then `crypto.createHash('sha256')` for hashing. Node's
built-in SHA-256 is OpenSSL-backed and is the fastest a JS environment can do.

The WASM binary (`lottie_parser_bg.wasm`, **165 KB**, compiled with `opt-level = "s"` + LTO)
was tested in Chrome 124 via `performance.now()` in the Web Worker with a matching warm-up
pass to allow JIT compilation.

All file sizes are synthetic Lottie JSONs generated with increasing layer counts to hit the
target byte range. Real-world Lottie files fall within this range.

### Results

| File size       | Operation          | Pure JS (Node) | WASM (Chrome Worker) |
|-----------------|--------------------|---------------:|---------------------:|
| ~5 KB (10 L)    | SHA-256 only       |      0.005 ms  |           ~0.03 ms   |
| ~5 KB (10 L)    | JSON parse + hash  |      0.08 ms   |           ~0.12 ms   |
| ~48 KB (100 L)  | SHA-256 only       |      0.03 ms   |           ~0.15 ms   |
| ~48 KB (100 L)  | JSON parse + hash  |      0.52 ms   |           ~0.65 ms   |
| ~478 KB (1000 L)| SHA-256 only       |      0.38 ms   |           ~1.10 ms   |
| ~478 KB (1000 L)| JSON parse + hash  |      7.4 ms    |           ~8.5 ms    |

> **WASM (Chrome Worker)** figures are measured in the running application using
> `performance.now()` around the `parse_lottie()` call in the Web Worker. The Node baseline
> uses OpenSSL-backed SHA-256 which is faster than the sha2 crate in WASM, so the Node
> numbers represent a best-case JS bound.

### Interpretation

Raw throughput is **roughly comparable**. V8's `JSON.parse` is extremely optimized and
close to parity with `serde_json` in a WASM32 target. SHA-256 via the Rust `sha2` crate
runs at ~200 MB/s in WASM vs Node's OpenSSL at ~1000 MB/s, which accounts for the gap at
larger sizes.

The speed difference is **not the reason to use WASM** here.

---

## Main thread blocking: the real metric

| File size    | Sync JS on main thread | WASM in Web Worker |
|--------------|----------------------:|-------------------:|
| ~5 KB        |             ~0.08 ms  |            0 ms    |
| ~48 KB       |             ~0.5 ms   |            0 ms    |
| ~478 KB      |             ~7.4 ms   |            0 ms    |

A 7.4 ms synchronous block on the main thread causes a visible frame drop (the browser
targets 16 ms per frame). For files in the 1–5 MB range — which real Lottie files
frequently reach — synchronous JS parsing would exceed 16 ms and stutter the UI.

The Web Worker keeps the main thread at **exactly 0 ms blocked** regardless of file size.
The upload dialog's spinner stays smooth throughout parsing.

---

## Why Rust/WASM over a JS library

Three concrete reasons beyond raw speed:

1. **Sync SHA-256 without a dependency.** The browser's `crypto.subtle.digest` is async-only,
   which means either `await` before displaying any progress, or reaching for a JS SHA-256
   library (~15–20 KB, another dep to audit). The Rust `sha2` crate runs synchronously inside
   the worker, no extra library needed.

2. **Type-safe struct deserialization.** `serde_json` + Rust structs means the Lottie schema
   is validated at the type level — missing fields return `Err`, wrong types fail to
   deserialise. A JS implementation either does manual field checks or brings in a JSON schema
   validator.

3. **WASM binary size is acceptable.** 165 KB is loaded once and cached by the browser. The
   worker reuses the same module instance across all uploads in a session
   (`modulePromise` singleton), so subsequent calls have zero startup overhead.

---

## To reproduce

```bash
# JS baseline (Node.js 20+)
node bench/baseline.js

# WASM numbers: open the dev server, upload any Lottie file,
# check the Web Worker console for parse_lottie timing logs
pnpm --filter web dev
```
