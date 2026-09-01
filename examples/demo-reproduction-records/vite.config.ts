import tailwindcss from '@tailwindcss/vite';
import { uniwind } from 'uniwind/vite';
import { defineConfig } from 'vite';
import { rnw } from 'vite-plugin-rnw';

// The Vite plugin stack (react-native-web resolution, Tailwind v4, Uniwind) is
// NOT described in the llms.txt family or the cookbook — it was reconstructed
// from the pinned versions in docs/compatibility-matrix.md and the existing
// examples/web-consumer starter. See the report's gap list (G-BUILD).
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
