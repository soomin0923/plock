import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // The Firestore SDK chunk (~140KB gzipped) is only loaded after sign-in.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Keep the big Firebase SDK in its own long-cached chunks.
        manualChunks: (id) => {
          if (id.includes('node_modules/@firebase/firestore') || id.includes('node_modules/firebase/firestore')) return 'firestore';
          if (id.includes('node_modules/@firebase') || id.includes('node_modules/firebase')) return 'firebase';
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react';
        },
      },
    },
  },
});
