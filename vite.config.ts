import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      fs: path.resolve(__dirname, "src/match/engine/nodeShim.ts"),
      path: path.resolve(__dirname, "src/match/engine/nodeShim.ts"),
      crypto: path.resolve(__dirname, "src/match/engine/nodeShim.ts"),
    }
  },
  optimizeDeps: {
    include: ["footballsimulationengine"],
    esbuildOptions: {
      target: "es2020",
    }
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
})
