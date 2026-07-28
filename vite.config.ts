import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_API_PROXY_TARGET;
  const enablePwa = env.VITE_ENABLE_PWA === "true";

  return {
    plugins: [
      react(),
      ...(enablePwa
        ? [
            VitePWA({
              registerType: "autoUpdate",
              injectRegister: false,
              includeAssets: [
                "admin.webmanifest",
                "apple-touch-icon.png",
                "inspection.webmanifest",
                "pwa-192x192.png",
                "pwa-512x512.png",
                "maskable-icon-512x512.png"
              ],
              manifest: false,
              workbox: {
                globPatterns: ["**/*.{js,css,html,ico,png,svg,webp}"],
                cleanupOutdatedCaches: true,
                skipWaiting: true,
                clientsClaim: true,
                navigateFallbackDenylist: [/^\/api\//],
                runtimeCaching: [
                  {
                    urlPattern: ({ request }) => request.destination === "document",
                    handler: "NetworkFirst",
                    options: {
                      cacheName: "pages",
                      networkTimeoutSeconds: 5
                    }
                  },
                  {
                    urlPattern: ({ request }) => ["style", "script", "worker"].includes(request.destination),
                    handler: "StaleWhileRevalidate",
                    options: {
                      cacheName: "assets"
                    }
                  },
                  {
                    urlPattern: ({ request }) => ["image", "font"].includes(request.destination),
                    handler: "CacheFirst",
                    options: {
                      cacheName: "media",
                      expiration: {
                        maxEntries: 50,
                        maxAgeSeconds: 60 * 60 * 24 * 30
                      }
                    }
                  }
                ]
              }
            })
          ]
        : [])
    ],
    build: {
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, "index.html"),
          admin: path.resolve(__dirname, "admin.html"),
          inspection: path.resolve(__dirname, "inspection.html")
        }
      }
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src")
      }
    },
    server: proxyTarget
      ? {
          proxy: {
            "/api": {
              target: proxyTarget,
              changeOrigin: true,
              secure: true,
              rewrite: (path) => path.replace(/^\/api/, "")
            }
          }
        }
      : undefined
  };
});
