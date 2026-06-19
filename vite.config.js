import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/Sovereigncity3D/',
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Sovereign City',
        short_name: 'SovCity',
        description: 'Build What You Own — 3D founder simulation',
        theme_color: '#E8C064',
        background_color: '#14120F',
        display: 'fullscreen',
        start_url: '/Sovereigncity3D/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        runtimeCaching: [{
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts-cache',
            expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 }
          }
        }]
      }
    })
  ]
});
