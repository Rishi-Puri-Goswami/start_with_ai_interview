import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['onnxruntime-web'], // Pre-bundle ONNX
  },
  assetsInclude: ['**/*.wasm', '**/*.onnx'], // Treat as static assets
  build: {
    assetsInlineLimit: 0, // Don't inline large WASM
  },
  server: {
    fs: {
      allow: ['..'], // Allow serving from parent dirs if needed
    },
  },
});