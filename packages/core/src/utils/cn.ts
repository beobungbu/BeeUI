import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// The BeeUI type scale is declared as `--text-<step>` theme variables, so Tailwind emits
// `text-caption` … `text-display` as font-size + line-height utilities. tailwind-merge only
// knows t-shirt font sizes and files any other `text-<word>` under text colour, which made a
// `text-caption` override evict the component's colour class and leave its default size in
// place. Registering the steps as font sizes makes them replace the size (and, through
// tailwind-merge's font-size/leading conflict, the line height) instead.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['caption', 'label', 'body', 'heading', 'title', 'display'],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
