import { defineConfig } from 'vitest/config';
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

// Determine if we're running worker tests or client tests
// By default we'll return client config unless an env variable indicates we're running worker tests
const isWorkerTest = process.env.WORKER_TEST === 'true';

export default isWorkerTest ? defineWorkersConfig({
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
}) : defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/client/setupTests.ts'],
    globals: true,
  },
});
