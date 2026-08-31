import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

const envDir = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '');
  const isDesktop = mode === 'desktop' || env.VITE_DESKTOP === '1';
  const apiTarget = env.VITE_DEV_API_PROXY ?? 'http://localhost:4000';

  const plugins: Plugin[] = [...react()];
  if (isDesktop) {
    plugins.push({
      name: 'desktop-pwa-stub',
      resolveId(id: string) {
        if (id === 'virtual:pwa-register/react') return id;
        return null;
      },
      load(id: string) {
        if (id === 'virtual:pwa-register/react') {
          return `export function useRegisterSW() {
  return { needRefresh: [false, () => {}], updateServiceWorker: async () => {} };
}`;
        }
        return null;
      },
    });
  } else {
    plugins.push(
      ...VitePWA({
        registerType: 'prompt',
        injectRegister: null,
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        manifestFilename: 'manifest.webmanifest',
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        },
        manifest: {
          name: 'TetherChat',
          short_name: 'TetherChat',
          description: 'Мессенджер для команд и друзей',
          lang: 'ru',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'any',
          background_color: '#1e1f22',
          theme_color: '#1e1f22',
          categories: ['social', 'communication'],
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            {
              src: '/icons/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          shortcuts: [{ name: 'Личные сообщения', url: '/channels/@me' }],
        },
        devOptions: { enabled: false },
      }),
    );
  }

  return {
    envDir,
    define: isDesktop ? { 'import.meta.env.VITE_DESKTOP': JSON.stringify('1') } : undefined,
    plugins,
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        ...(mode === 'development'
          ? {
              '@tetherchat/shared': fileURLToPath(
                new URL('../../packages/shared/src/index.ts', import.meta.url),
              ),
            }
          : {}),
      },
    },
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/files': { target: apiTarget, changeOrigin: true },
        '/socket.io': { target: apiTarget, ws: true, changeOrigin: true },
      },
    },
    preview: { port: 4173, host: true },
    build: {
      target: 'es2022',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            emoji: ['emoji-mart', '@emoji-mart/react', '@emoji-mart/data'],
            markdown: ['react-markdown', 'remark-gfm'],
            livekit: ['livekit-client'],
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
    },
  };
});
