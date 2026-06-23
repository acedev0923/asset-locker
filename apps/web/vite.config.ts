import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteTsConfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    viteTsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      tsr: {
        appDirectory: "./src",
        routeFileIgnorePattern: "api/",
      },
      server: { preset: "node-server" },
    }),
    react(),
  ],
  assetsInclude: ["**/*.wasm"],
  optimizeDeps: {
    exclude: ["lottie_parser"],
  },
});
