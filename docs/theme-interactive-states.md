# Filled interaction-state token contract

Status: additive hardening on top of Theme/token v2 (PR #56).
Tracking issue: #65.

## Why this exists

BeeUI v2 already defined `primary-hover` and `primary-pressed`, but the filled Button state contract was incomplete: secondary had no pressed token, destructive had no hover/pressed tokens, and some filled states used `active:opacity-*` instead of a semantic background value. Opacity-based state styling makes effective foreground contrast depend on the surface behind the control.

This hardening makes every filled Button background state explicit and keeps the component brand-blind.

## Public semantic state vocabulary

The 30 legacy semantic color names remain unchanged. Three additive public tokens are introduced:

- `secondary-pressed`
- `destructive-hover`
- `destructive-pressed`

The filled-action state matrix is now:

| Variant | Default | Hover | Pressed | Foreground |
| --- | --- | --- | --- | --- |
| primary | `primary` | `primary-hover` | `primary-pressed` | `primary-foreground` |
| secondary | `secondary` | `secondary-hover` | `secondary-pressed` | `secondary-foreground` |
| destructive | `destructive` | `destructive-hover` | `destructive-pressed` | `destructive-foreground` |

Outline and ghost Buttons continue to use the existing semantic `surface-muted` hover and `muted` pressed backgrounds. They do not need new component-specific state tokens.

Disabled/loading presentation remains a separate disabled-state contract and intentionally keeps the existing disabled opacity treatment; disabled content is not used as the mechanism for communicating an enabled interaction state.

## Contrast contract

For every shipped runtime theme, every default/hover/pressed filled Button background must provide at least 4.5:1 contrast against its semantic foreground.

The minimum measured contrast by variant after this change is:

| Runtime theme | Primary min | Secondary min | Destructive min |
| --- | ---: | ---: | ---: |
| Bee light | 4.61:1 | 10.31:1 | 4.83:1 |
| Bee dark | 4.61:1 | 6.99:1 | 5.17:1 |
| Violet light | 5.70:1 | 10.95:1 | 4.83:1 |
| Violet dark | 4.80:1 | 9.51:1 | 5.17:1 |

Deterministic tests compute these ratios from the actual theme CSS for every state/theme combination. Do not replace these checks with hand-maintained expected numbers.

## Button consumption rules

Filled Button variants must express hover/pressed state with semantic background tokens, not `active:opacity-*`.

```text
primary     -> bg-primary / hover primary-hover / pressed primary-pressed
secondary   -> bg-secondary / hover secondary-hover / pressed secondary-pressed
destructive -> bg-destructive / hover destructive-hover / pressed destructive-pressed
```

Reusable Button source must not branch on Bee/Violet identity and must not introduce raw state colors.

## Compatibility and migration

This is an additive semantic-token change. Existing public token names and Button props are preserved.

Two existing state values change intentionally to satisfy the contract while preserving default Button appearance:

- Bee-light primary hover becomes `#e58a05` and primary pressed becomes the previous hover value `#d97706`; the old pressed `#b45309` could not reach 4.5:1 with the current dark foreground.
- Violet-dark primary pressed becomes `#9066f4`; the previous `#8b5cf6` measured below 4.5:1 against `primary-foreground`.

Theme authors extending BeeUI must define all three newly added semantic state tokens in every runtime theme. Runtime overrides that change a filled Button background or foreground are responsible for preserving the same state-pair contrast relationship.

## Required verification

A change to filled interaction-state tokens or Button consumption is incomplete until all of the following pass:

1. semantic token completeness for every runtime theme;
2. deterministic 4.5:1 state/foreground contrast matrix;
3. Button utility regression tests proving explicit default/hover/pressed state classes and no filled `active:opacity-*` fallback;
4. Component Gallery and Brand A/B visual acceptance;
5. full Pattern Gallery acceptance matrix;
6. typecheck, tests, release verification, web/Android/iOS exports, bare Android consumer, and iOS simulator verification for cross-platform Button changes.
