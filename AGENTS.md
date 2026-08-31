# BeeUI agent rules

These rules apply to all generated or hand-written BeeUI code.

## Toolchain

- Use Node.js `24.13.1` exactly for local development, CI, release verification, Expo prebuild, and native consumer verification.
- Use pnpm `10.15.0` through Corepack.
- Do not lower, float, or independently change the Node.js version in package metadata, version-manager files, CI workflows, or native build scripts.

## Architecture

- Keep stable behavior, semantic, and variant APIs independent from Uniwind, Expo, routers, storage, networking, and business logic.
- `className` is an optional styling escape hatch tied to the current implementation; do not make application logic depend on it and do not treat it as a portability guarantee.
- Engine-only bridge props such as `colorClassName`, `trackColorOnClassName`, or `placeholderTextColorClassName` must remain internal and must not appear in BeeUI component props.
- `packages/ui` may depend on React Native primitives and `@beemvp/beeui-core`; it must not import from `expo-*`.
- Treat Uniwind as a replaceable implementation detail behind BeeUI's stable component contracts.
- Prefer semantic tokens (`bg-primary`, `text-foreground`, `border-border`) over palette or literal colors.
- Do not introduce arbitrary color values in component source.
- Domain-specific compositions do not belong in `packages/ui`.

## Components

- Forward refs for primitive-like components.
- Preserve native props where possible.
- Include accessibility roles/states for interactive components and prevent callers from accidentally overriding required semantics.
- Merge caller-provided accessibility state/value with BeeUI-required state rather than discarding it.
- Support disabled, pressed/focus states where relevant.
- Keep variants explicit and typed.
- Avoid new dependencies unless they materially reduce complexity.

## Styling

- Tailwind/Uniwind utility names must be statically discoverable at build time.
- Never construct utilities dynamically (for example `bg-${color}-500`). Map dynamic state to complete, literal class strings instead.
- Prefer semantic utilities backed by the BeeUI token contract.
- Keep platform-specific utilities explicit (`web:`, `ios:`, `android:`) and test each affected platform.
- Prefer typed variants and semantic props over consumer `className` overrides for reusable application UI.

## Performance

- Prefer direct `className` styling for normal UI implementation.
- Do not resolve class names dynamically in list hot paths.
- Use `StyleSheet.create` and/or Reanimated for high-frequency animation, gesture, camera, chart, canvas, or other measured hot paths.
- Performance escape hatches must not change the component's stable behavior/variant API.

## Theme

- Every semantic color token must exist in every theme.
- Brand changes happen in tokens/themes, not component implementation.
- Light and dark must remain first-class and testable.

## Definition of done for a new primitive

- typed public API
- ref forwarding when applicable
- accessibility semantics
- semantic-token-only styling
- light/dark behavior
- showcase example
- contract test for behavior/accessibility where applicable
- typecheck and tests pass when CI execution is available
