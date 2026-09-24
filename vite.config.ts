import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      // Los estándares son archivos de datos y pueden estar abiertos en Excel/Word.
      ignored: /\.(xlsx?|pdf|docx?)$/i,
    },
  },
})
