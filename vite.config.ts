import preact from '@preact/preset-vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Relative paths, so the app runs from any folder (GitHub Pages serves it under /sitzplan/).
  base: './',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Everything is precached: the app has to work without a connection, PDF reading included.
        globPatterns: ['**/*.{js,mjs,css,html,png,woff2,webmanifest}'],
        maximumFileSizeToCacheInBytes: 8_000_000,
      },
      manifest: {
        name: 'Sitzplan',
        short_name: 'Sitzplan',
        description: 'Sitzpläne mit Regeln erstellen. Alle Daten bleiben auf dem Gerät.',
        lang: 'de',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        background_color: '#f6f1e2',
        theme_color: '#265442',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
