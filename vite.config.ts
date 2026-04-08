import { VitePWA } from "vite-plugin-pwa"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import * as path from "node:path"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import tailwindcss from "@tailwindcss/vite"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackRouter(),
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",

      pwaAssets: {
        disabled: false,
        config: true,
      },

      manifest: {
        name: "Receipts",
        short_name: "Receipts",
        description: "A simple receipt tracking app",
        theme_color: "#ffffff",
        shortcuts: [
          {
            name: "Add receipt",
            url: "/?action=add",
            icons: [
              {
                src: "pwa-64x64.png",
                sizes: "64x64",
                type: "image/png",
              },
              {
                src: "pwa-192x192.png",
                sizes: "192x192",
                type: "image/png",
              },
              {
                src: "pwa-512x512.png",
                sizes: "512x512",
                type: "image/png",
              },
              {
                src: "maskable-icon-512x512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "maskable",
              },
            ],
          },
        ],
        share_target: {
          action: "/share",
          method: "POST",
          enctype: "multipart/form-data",
          params: {
            files: [
              {
                name: "images",
                accept: ["image/png", "image/jpeg", "image/webp"],
              },
            ],
          },
        },
      },

      // workbox: {
      //   globPatterns: ["**/*.{js,css,html,svg,png,ico,wasm}"],
      //   cleanupOutdatedCaches: true,
      //   clientsClaim: true,
      //   maximumFileSizeToCacheInBytes: 6_000_000,
      // },

      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,wasm,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 6_000_000,
      },

      devOptions: {
        enabled: false,
        navigateFallback: "index.html",
        suppressWarnings: true,
        type: "module",
      },
    }),
  ],

  build: {
    minify: false,
    terserOptions: {
      compress: false,
      mangle: false,
    },
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
})
