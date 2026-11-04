import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// /api duoc chuyen tiep toi backend Express (cong 3000) khi chay local
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: { '/api': 'http://localhost:3000' },
  },
});
