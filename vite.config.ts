import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

const vendorChunkGroups: Record<string, string[]> = {
  react: ["react", "react-dom", "react-router-dom"],
  query: ["@tanstack/react-query"],
  ui: [
    "@radix-ui",
    "@floating-ui",
    "class-variance-authority",
    "clsx",
    "tailwind-merge",
    "cmdk",
    "vaul",
  ],
  forms: ["react-hook-form", "@hookform/resolvers", "zod", "input-otp"],
  i18n: ["i18next", "react-i18next", "i18next-browser-languagedetector"],
  icons: ["lucide-react"],
  charts: ["recharts", "victory-vendor"],
  date: ["date-fns"],
  misc: ["sonner", "embla-carousel-react", "react-day-picker", "react-resizable-panels", "next-themes"],
};

const getManualVendorChunk = (id: string): string | undefined => {
  const normalizedId = id.replace(/\\/g, "/");

  if (!normalizedId.includes("/node_modules/")) {
    return undefined;
  }

  for (const [chunkName, packages] of Object.entries(vendorChunkGroups)) {
    if (
      packages.some(
        (pkg) =>
          normalizedId.includes(`/node_modules/${pkg}/`) ||
          normalizedId.includes(`/node_modules/${pkg}.js`) ||
          normalizedId.includes(`/node_modules/${pkg}.mjs`),
      )
    ) {
      return `vendor-${chunkName}`;
    }
  }

  return "vendor-shared";
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\/api\/appointments/,
            handler: "NetworkFirst",
            options: {
              cacheName: "appointments-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
      manifest: false, // We use our own site.webmanifest
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: getManualVendorChunk,
      },
    },
  },
}));
