import { defineConfig } from 'vite';

export default defineConfig({
  // Use root path for Vercel, subdirectory for GitHub Pages
  base: process.env.VERCEL ? '/' : '/Beaver-Bathroom/',
});
