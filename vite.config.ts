import { VitePWA } from "vite-plugin-pwa"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import * as path from "node:path"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,

      pwaAssets: {
        disabled: false,
        config: true,
      },

      manifest: {
        name: "Receipts",
        short_name: "Receipts",
        description: "A simple receipt tracking app",
        theme_color: "#0a0a0a",
      },

      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 3_000_000,
      },

      devOptions: {
        enabled: false,
        navigateFallback: "index.html",
        suppressWarnings: true,
        type: "module",
      },
    }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
})
