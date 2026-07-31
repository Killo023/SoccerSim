import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"
import { execSync } from "child_process"

const buildId = (() => {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim()
  } catch {
    return "dev"
  }
})()

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
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
})
