import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import tailwindcss from "@tailwindcss/vite"
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      target: 'node18',
      rollupOptions: {
        output: {
          entryFileNames: '[name].js'
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      target: 'node18',
      rollupOptions: {
        output: {
          entryFileNames: '[name].mjs'
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        "@": resolve('src/renderer/src'),
      }
    },
    build: {
      target: 'esnext'
    },
    plugins: [react(),tailwindcss()]
  },
})
