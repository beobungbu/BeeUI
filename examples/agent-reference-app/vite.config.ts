import tailwindcss from '@tailwindcss/vite';
import { uniwind } from 'uniwind/vite';
import { defineConfig } from 'vite';
import { rnw } from 'vite-plugin-rnw';

// The Vite plugin stack (react-native-web resolution, Tailwind v4, Uniwind) is
// NOT described in the llms.txt family — it was reconstructed from the pinned
// versions in docs/compatibility-matrix.md and the existing web starter. See
// AGENT-BUILD-NOTES.md (gap G1).
export default defineConfig({
  plugins: [
    rnw(),
    tailwindcss(),
    uniwind({
      cssEntryFile: './src/global.css',
      dtsFile: './src/uniwind-types.d.ts',
    }),
  ],
});
