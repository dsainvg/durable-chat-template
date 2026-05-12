import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        main: './src/server/index.ts',
        miniflare: {
          compatibilityDate: '2024-11-01',
          compatibilityFlags: ['nodejs_compat'],
          d1Databases: {
            DB: "4d0da6f1-b2a1-4837-a2f5-2b0bfd422c1a"
          },
          durableObjects: {
            Chat: "Chat"
          },
          serviceBindings: {
            ASSETS: () => new Response("Asset Not Found", { status: 404 })
          }
        }
      },
    },
  },
});