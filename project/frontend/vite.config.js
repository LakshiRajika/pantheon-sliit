import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 5173 sits inside a Windows Hyper-V reserved port range (5118-5217) on this machine.
  server: { port: 3000, strictPort: true },
  // The landing page's 3D scene (three.js) is a deliberate, lazily loaded ~575 kB chunk.
  build: { chunkSizeWarningLimit: 650 },
})
