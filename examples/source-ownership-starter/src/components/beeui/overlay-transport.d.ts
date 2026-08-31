// Types-only module so `import './overlay-transport'` type-checks while Metro
// resolves the platform runtime (overlay-transport.web.tsx / .native.tsx). A base
// runtime `.ts` here would shadow the `.web.tsx` file (Metro tries the `.ts`
// source ext before `.tsx`), so the runtime lives only in the platform files.
export * from './overlay-transport-shared';
import type { OverlayTransport } from './overlay-transport-shared';

export declare function resolveOverlayTransport(): OverlayTransport;
