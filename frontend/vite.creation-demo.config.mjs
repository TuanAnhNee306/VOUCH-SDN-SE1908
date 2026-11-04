import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config.js';
export default mergeConfig(base, defineConfig({ server: { host: '127.0.0.1', port: 5183, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3101' } } }));
