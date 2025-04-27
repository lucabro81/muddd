import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/server.ts'),
      name: 'server',
      fileName: 'main',
      formats: ['es', 'umd']
    },
    sourcemap: process.env.KEEP_SOURCE_MAP === 'true',
    minify: 'esbuild'
  },
  plugins: [
    dts({
      insertTypesEntry: true,
    })
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});