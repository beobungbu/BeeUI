// Repository-local re-export of the shared BeeUI registry/source-ownership
// engine. The canonical implementation lives in packages/cli/src/registry-lib.mjs
// (the publishable @beemvp/beeui-cli package's source, #209); this file exists only
// so `pnpm registry:verify`/`pnpm registry:test` and any other repo-local
// script can keep importing `./registry-lib.mjs` without a build step.
export * from '../packages/cli/src/registry-lib.mjs';
