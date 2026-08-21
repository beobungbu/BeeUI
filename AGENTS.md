# BeeUI agent rules

These rules apply to all generated or hand-written BeeUI code.

## Architecture

- Keep public component APIs independent from Uniwind, Expo, routers, storage, networking, and business logic.
- `packages/ui` may depend on React Native primitives and `@beeui/core`; it must not import from `expo-*`.
- Treat Uniwind as a replaceable implementation detail.
- Prefer semantic tokens (`bg-primary`, `text-foreground`, `border-border`) over palette or literal colors.
- Do not introduce arbitrary color values in component source.
- Domain-specific compositions do not belong in `packages/ui`.

## Components

- Forward refs for primitive-like components.
- Preserve native props where possible.
- Include accessibility roles/states for interactive components.
- Support disabled, pressed/focus states where relevant.
- Keep variants explicit and typed.
- Avoid new dependencies unless they materially reduce complexity.

## Performance

- Prefer direct `className` styling for normal UI.
- Do not resolve class names dynamically in list hot paths.
- Use `StyleSheet.create` and/or Reanimated for high-frequency animation, gesture, camera, chart, canvas, or other measured hot paths.
- Performance escape hatches must not change the component's public API.

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
- typecheck passes
