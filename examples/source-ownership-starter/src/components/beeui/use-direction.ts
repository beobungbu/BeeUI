import type { AnchoredOverlayDirection } from '../../lib/beeui/core/index';
import { I18nManager, Platform } from 'react-native';

// Single stateless logical-direction resolver for `@beemvp/beeui-ui` (ADR-004).
//
// Before this file, `Popover`, `DropdownMenu`, and `Select` each duplicated the
// identical inline expression `I18nManager.isRTL ? 'rtl' : 'ltr'` to default their
// public `direction` prop. That duplication (a) reads only the native ambient
// authority even on Web, where the correct ambient authority is the DOM `dir`
// attribute, and (b) means any future anchored-geometry component would invent a
// fourth copy. This module collapses those reads into one precedence contract.
//
// Precedence (highest to lowest), per ADR-004 "Direction source precedence":
//   1. explicit value (a per-component `direction` prop), when provided
//   2a. native ambient: `I18nManager.isRTL` (iOS/Android)
//   2b. Web ambient: `document.documentElement.dir === 'rtl'`
//   3. `'ltr'` fallback
//
// Native and Web never both apply: the resolver branches on `Platform.OS`, so
// exactly one ambient source is consulted per platform. BeeUI only ever *reads*
// these authorities; it never writes `I18nManager.forceRTL()` or sets the DOM
// `dir` attribute (that stays the host application's responsibility).
//
// No React context, module-level mutable store, or subscription/observer is
// introduced here — the hard invariant of ADR-004/#139. The resolver simply
// re-reads the ambient authority on every call, so it is correct immediately
// after the host application has reloaded (native) or re-rendered the affected
// subtree (Web) with a new direction.

/**
 * Ambient direction inputs, injectable so the precedence logic is unit-testable
 * without mutating real global platform state (ADR-004 "Testing seams"). When an
 * input is omitted the resolver reads the real platform authority.
 */
export type DirectionAmbientInputs = {
  /** Overrides `Platform.OS`. */
  platformOS?: typeof Platform.OS;
  /** Overrides the native ambient read (`I18nManager.isRTL`). */
  nativeIsRTL?: boolean;
  /** Overrides the Web ambient read (`document.documentElement.dir`). */
  webDocumentDir?: string | null;
};

// Minimal structural view of the one DOM surface this resolver reads. `@beemvp/beeui-ui`
// targets React Native and does not include the DOM lib, so we reach the Web
// ambient authority through `globalThis` with a narrow type instead of the global
// `document` (which is absent on native and untyped here).
type WebDocumentLike = { documentElement?: { dir?: string } | null };

function readWebDocumentDir(): string | null {
  const doc = (globalThis as { document?: WebDocumentLike }).document;
  if (!doc) return null;
  return doc.documentElement?.dir ?? null;
}

/**
 * Resolve the ambient direction for the current platform (precedence 2a/2b/3),
 * ignoring any explicit per-component override. Use {@link resolveDirection}
 * when an explicit value may be present.
 */
export function readAmbientDirection(
  inputs?: DirectionAmbientInputs,
): AnchoredOverlayDirection {
  const platformOS = inputs?.platformOS ?? Platform.OS;

  if (platformOS === 'web') {
    const dir = inputs?.webDocumentDir !== undefined ? inputs.webDocumentDir : readWebDocumentDir();
    return dir === 'rtl' ? 'rtl' : 'ltr';
  }

  const isRTL = inputs?.nativeIsRTL !== undefined ? inputs.nativeIsRTL : I18nManager.isRTL;
  return isRTL ? 'rtl' : 'ltr';
}

/**
 * Resolve the effective direction: an explicit per-component value always wins
 * (precedence 1); otherwise the platform's ambient authority is read
 * (precedence 2a/2b), falling back to `'ltr'` (precedence 3).
 */
export function resolveDirection(
  explicit?: AnchoredOverlayDirection,
  inputs?: DirectionAmbientInputs,
): AnchoredOverlayDirection {
  return explicit ?? readAmbientDirection(inputs);
}

/**
 * Hook form of {@link resolveDirection} for use in component render. Re-reads the
 * ambient authority on every render (no subscription), consistent with ADR-004's
 * change/reload expectations: the host application owns triggering the re-render
 * (Web) or reload (native) when the ambient direction changes.
 */
export function useDirection(
  explicit?: AnchoredOverlayDirection,
): AnchoredOverlayDirection {
  return resolveDirection(explicit);
}
