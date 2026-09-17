import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@radix-ui/react-dialog@1.1.6': '@radix-ui/react-dialog', 'lucide-react@0.487.0': 'lucide-react' } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
