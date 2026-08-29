# Interactive control-boundary token contract

Status: accessibility hardening on top of Theme/token v2 (PR #56).
Tracking issue: #66.

## Why this exists

BeeUI previously used `border-strong` for both structural borders and interactive text-entry controls. That conflated two intents:

- structural borders such as cards, dividers, badges, and decorative containers can remain subtle;
- an unfocused text-entry control may rely on its boundary to be visually identifiable and therefore needs stronger non-text contrast against its adjacent input surface.

In the v2 themes, `border-strong` against `input` measured only about 1.5–2.0:1. Globally darkening `border-strong` would unnecessarily make the rest of the interface heavier, so this hardening adds one semantic role instead.

## Public semantic token

`control-border` is the default boundary color for input-like interactive controls.

It is intentionally separate from:

- `border`: subtle structural/divider boundary;
- `border-strong`: stronger structural boundary;
- `focus-ring`: keyboard/platform focus indication;
- `destructive`: invalid/error boundary;
- `disabled`: disabled surface.

The current Input family (`Input`, `SearchInput`, `PasswordInput`, `OTPInput`, and `Textarea`) inherits this contract through `Input` rather than defining component-specific border colors.

## Contrast contract

The required default control boundary is at least 3:1 against `input` in every shipped runtime theme.

| Runtime theme | `control-border` | `input` | Contrast |
| --- | --- | --- | ---: |
| Bee light | `#8590a2` | `#ffffff` | 3.23:1 |
| Bee dark | `#667085` | `#121820` | 3.59:1 |
| Violet light | `#9488a4` | `#ffffff` | 3.32:1 |
| Violet dark | `#786d87` | `#171126` | 3.79:1 |

Focus and invalid states have separate deterministic checks against their adjacent surfaces:

| Runtime theme | Focus vs input | Focus vs muted surface | Invalid vs input |
| --- | ---: | ---: | ---: |
| Bee light | 5.02:1 | 4.81:1 | 4.83:1 |
| Bee dark | 10.69:1 | 10.05:1 | 6.45:1 |
| Violet light | 5.70:1 | 5.41:1 | 4.83:1 |
| Violet dark | 9.94:1 | 9.37:1 | 6.63:1 |

Tests compute the required ratios from the actual theme CSS. The table above is documentation, not a substitute for executable checks.

## State consumption

Default enabled input:

```text
border-control-border bg-input
```

Focused input:

```text
focus:border-focus-ring + web:focus-visible:bee-focus-ring
```

Invalid input:

```text
border-destructive focus:border-destructive
```

An invalid `Field` also renders its error message with `role="alert"` and the Input receives the field error as accessibility guidance, so invalid state is not communicated by border color alone.

Disabled input keeps the semantic control boundary while retaining the existing disabled surface, disabled foreground, opacity treatment, `editable=false`, and accessibility disabled state. Inactive controls are not used as the 3:1 enabled-control boundary contract.

## Compatibility

This is an additive semantic-token change. Existing `border` and `border-strong` values do not change, so structural Card/divider/badge styling does not become heavier.

Input geometry, size variants, `numberOfLines`, public props, focus behavior, and Field composition remain unchanged.

Theme authors extending BeeUI must define `--color-control-border` for every runtime theme and keep the enabled boundary at or above the same 3:1 relationship with `--color-input`.

## Required verification

A control-boundary change is incomplete until all of the following pass:

1. semantic token completeness across every runtime theme;
2. default `control-border` vs `input` >= 3:1;
3. focus-ring vs input/surface/muted-surface >= 3:1;
4. destructive invalid boundary vs input >= 3:1;
5. Input utility regression tests for default, focus, invalid, and disabled states;
6. real-browser Input and Textarea boundary assertions across Bee/Violet light/dark;
7. canonical Forms visual regression plus Component/Pattern Gallery acceptance;
8. typecheck, tests, release verification, web/Android/iOS exports, bare Android consumer, and iOS simulator verification.
