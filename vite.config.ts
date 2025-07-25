import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  root: fileURLToPath(new URL('./client', import.meta.url)),
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      // Use `import.meta.url` para criar caminhos absolutos em um Módulo ES
      // Isso substitui o uso de `__dirname`
      '@': fileURLToPath(new URL('./client/src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  server: {
    // Necessário para integrar com o servidor Express em desenvolvimento
    middlewareMode: true,
    watch: {
      ignored: ["**/.env"],
    },
  },
  build: {
    // Coloca os arquivos de build do cliente em dist/public
    // para não conflitar com o build do servidor.
    // O caminho é relativo à `root` ('client'), por isso usamos '../'.
    outDir: '../dist/public',
    emptyOutDir: true,
  }
})