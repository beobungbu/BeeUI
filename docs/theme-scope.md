# Scoped theming (`BeeThemeScope`)

Status: typed scoped-theme wrapper on top of Theme/token v2 (PR #56).
Tracking issue: #68. Depends on the extensible typed registry from #67
(`packages/tokens/src/registry.ts`, `defineThemeRegistry`).

## What this is

`BeeThemeScope` (`@beemvp/beeui-ui`) is a thin typed wrapper around Uniwind's own
`ScopedTheme` component. It maps a typed `{ brand, appearance }` selection — or
an already-resolved runtime-theme name — through a `@beemvp/beeui-tokens` theme
registry, and forwards the resulting Uniwind runtime-theme name to Uniwind's
`ScopedTheme`. **Uniwind remains the sole runtime theme authority.**
`BeeThemeScope` owns no React context, no state, and no propagation logic of
its own; nesting, precedence, and portal behavior are exactly whatever
Uniwind's `ScopedTheme` defines.

This is not a second theme engine and not a general style-override API. It
answers one narrow question: *"theme this one subtree independently of the
rest of the app."*

## When to use this vs. `Uniwind.setTheme()`

- **Application-level theme switching** — a user's light/dark or brand
  preference for the whole app — stays an explicit `Uniwind.setTheme(...)`
  call the application owns. `BeeThemeScope` does not change that contract;
  see `ThemeInspector`/`ShowcaseRoot`'s `applyRuntimeTheme` for the existing
  pattern.
- **`BeeThemeScope`** themes one subtree independently of the application
  theme: an embedded preview, a white-label widget, a docs example, a dark
  sidebar in a light app, or a brand A/B comparison rendered side by side.

## API

Two typed forms, both narrowed to the supplied (or default) registry:

```tsx
import { BeeThemeScope } from '@beemvp/beeui-ui';

// 1. Registry selection — brand + appearance, resolved through a registry.
// Omitting `registry` uses the default beeThemeRegistry (Bee + Violet, #67).
<BeeThemeScope brand="violet" appearance="dark">
  <Card>...</Card>
</BeeThemeScope>

// A consumer-defined registry from defineThemeRegistry (#67) narrows `brand`
// and `appearance` to that registry's own vocabulary — no BeeUI source edit.
<BeeThemeScope registry={acmeRegistry} brand="acme" appearance="dark">
  <Card>...</Card>
</BeeThemeScope>

// 2. Resolved runtime-theme name — for callers that already hold a Uniwind
// runtime-theme name (e.g. round-tripped through `registry.selectionFor`).
// Still typed against, and validated against, the supplied/default registry.
<BeeThemeScope theme="violet-dark">
  <Card>...</Card>
</BeeThemeScope>
```

### Unknown/unsupported selections

There is no silent fallback to the wrong brand:

- an unknown `brand`/`appearance` pair throws from the registry's own
  `resolve()` (see `defineThemeRegistry`, #67, `packages/tokens/src/registry.ts`);
- an unrecognized `theme` name throws from `BeeThemeScope` itself, listing the
  registry's known runtime-theme names.

Both throw synchronously during render, before `Uniwind.setTheme`/`ScopedTheme`
ever sees an invalid name.

### Nesting and sibling scopes

Nesting and precedence are exactly Uniwind's `ScopedTheme` semantics —
`BeeThemeScope` does not reimplement them. In practice:

- a nested `BeeThemeScope` overrides its parent scope for its own subtree;
- sibling subtrees outside a scope never see that scope's value;
- an explicit child scope is not overridden by a later, unrelated
  `Uniwind.setTheme()` call — the scope is a React-tree-scoped value, not a
  snapshot of the global theme at mount time.

These are proven deterministically in
`apps/showcase/__tests__/issue-68-theme-scope.test.tsx`.

### Component and overlay state

Changing `brand`/`appearance`/`theme` only ever changes the `theme` value
passed to Uniwind's `ScopedTheme` — `children` are forwarded as-is, in the same
position, with no additional wrapping component, conditional remount, or `key`
change. Local component state and open overlay state inside the scope survive
a scope change the same way they would survive any other prop update
(`apps/showcase/__tests__/issue-68-theme-scope.test.tsx`, "component state
preservation").

## Portals and overlays (Dialog, Popover, DropdownMenu, Select)

This is the high-risk area the #68 contract calls out explicitly, so it is
proven rather than assumed. BeeUI's overlay primitives — `Dialog`,
`AlertDialog`, `Popover`, `DropdownMenu`, `Select` — all deliver their
portal-able content through the shared overlay transport documented in
[`docs/anchored-overlays.md`](./anchored-overlays.md#consumer-react-context-portal-transport).
That transport has three modes, and `BeeThemeScope` inherits their consumer
React context behavior exactly, because Uniwind's `ScopedTheme` is itself a
plain `React.Context.Provider`:

- **`web-dom`** (`ReactDOM.createPortal`) — preserves React context, so a
  scoped theme applied above a `Dialog`/`Popover`/`DropdownMenu`/`Select`
  **is resolved** for its portaled content on web. Proven against the real
  Uniwind runtime in a real browser:
  `apps/visual-regression/tests/overlay-context.spec.ts`
  ("BeeThemeScope resolves inside a web Popover/DropdownMenu portal", "...
  inside a web Dialog").
- **`native-teleport`** (`react-native-teleport`, requires the New
  Architecture and a registered native host view) — content stays in its
  source fiber tree, so context (and the scoped theme) **is preserved**.
  Proven with the same deterministic teleport-availability seam
  `overlay-transport.test.tsx` uses:
  `apps/showcase/__tests__/issue-68-theme-scope.test.tsx`
  ("native-teleport transport preserves the scope").
- **`legacy`** (the defensive store-and-reparent fallback used when neither of
  the above is available — notably JS-only test environments, and a native
  runtime without the New Architecture or without a registered teleport host
  view) — content is stored and re-rendered under a host mounted at
  `BeeUIProvider`, outside any subtree-level `BeeThemeScope`. **On this path a
  scoped theme does not reach portaled overlay content**; the overlay renders
  under whatever theme is active at the application root instead. This is an
  existing, pre-#68 constraint of the overlay transport itself (see
  `packages/ui/src/components/overlay-host-mode.ts`), not something
  `BeeThemeScope` special-cases or works around — it adds no second
  propagation path. Proven deterministically:
  `apps/showcase/__tests__/issue-68-theme-scope.test.tsx`
  ("legacy transport does not cross the portal").

If a subtree's overlay content must stay themed on the legacy path, follow the
same guidance `docs/anchored-overlays.md` already gives for arbitrary consumer
context: put the value above `BeeUIProvider` (i.e. apply it as the
application-level theme instead of a subtree scope), or pass the resolved
runtime-theme name explicitly into the portaled content.

`BeeThemeScope` never modifies focus-trap, dismissal, or event-routing
behavior — it only supplies the `theme` value Uniwind's `ScopedTheme` already
accepts.

## Examples

**Embedded preview / docs example** — theme a code-sample or style-guide
fixture independently of the surrounding page:

```tsx
<BeeThemeScope brand="violet" appearance="dark">
  <Card padding="lg" variant="raised">
    <Text variant="heading">Violet dark preview</Text>
    <Button>Primary action</Button>
  </Card>
</BeeThemeScope>
```

**Dark sidebar in a light app**:

```tsx
<HStack className="flex-1">
  <BeeThemeScope appearance="dark" brand="bee">
    <VStack className="w-64 bg-background">{/* sidebar nav */}</VStack>
  </BeeThemeScope>
  <VStack className="flex-1 bg-background">{/* light main content */}</VStack>
</HStack>
```

**White-label / embedded widget** — a consumer registry (#67) scopes an
embedded surface to a partner brand without touching the host app's theme:

```tsx
<BeeThemeScope registry={partnerRegistry} brand="partnerAcme" appearance="light">
  <EmbeddedWidget />
</BeeThemeScope>
```

The runnable Component Gallery fixture (`apps/showcase/component-gallery/component-gallery.tsx`,
"Scoped theme (BeeThemeScope)" section) exercises nesting, sibling isolation,
and all three overlay primitives together, and is what
`overlay-context.spec.ts` drives in a real browser.

## SSR / web / native

`BeeThemeScope` itself renders nothing platform-specific — it is a pure
pass-through to Uniwind's own `ScopedTheme`, whose web/native/SSR behavior
(including that library's own DOM/host requirements) is documented by Uniwind,
not by BeeUI. BeeUI adds exactly one platform-shaped constraint beyond what
Uniwind itself requires, and it is the one documented above: which overlay
transport mode is active determines whether a scope reaches portaled content.

## No new theme store/provider

`BeeThemeScope` introduces no `React.createContext`, no module-level mutable
state, and no subscription mechanism of its own. It is a stateless function
component that resolves a name through a `@beemvp/beeui-tokens` registry and renders
Uniwind's `ScopedTheme`. `apps/showcase/__tests__/issue-68-theme-scope.test.tsx`
asserts the package export surface is exactly `{ BeeThemeScope }` — no
accompanying provider or hook.

## Out of scope (see issue #68)

- Arbitrary per-component style overrides — this is theme *selection*, not a
  style-override API.
- Replacing global Uniwind theme APIs — `Uniwind.setTheme()` is unchanged.
- A general runtime override API, a runtime token reader, a density scope, or
  a high-contrast product contract (#71, #72, #74, #77) — those are separate,
  independently scoped issues and may or may not choose to reuse this
  primitive later.
