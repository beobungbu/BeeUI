---
title: Forms model
description: How Field, controls, messages and submit compose — and why validation, values and submission stay yours.
---

BeeUI gives you the **presentation and accessibility wiring of a form** — label, control, description, error, grouping and keyboard-aware layout — while values, validation rules and submission stay entirely in your application.

## Why the concept exists

Form libraries are opinionated by nature: they decide when validation runs, what an error is, how async checks resolve and what a submit lifecycle looks like. Those are product decisions, and a UI library that made them would force every consumer onto one form architecture.

So BeeUI stops at a line that is easy to state: **it renders `invalid`; it does not decide what invalid means.** Everything on your side of that line composes with any form library, or with plain `useState`.

## The composition

```
FormGroup  legend, group-level description/error        (optional — related fields)
└── Field  label, description, error, invalid, required, disabled
    └── control        Input · Textarea · PasswordInput · SearchInput
                       Select · Checkbox · Switch · RadioGroup
                       DatePicker · DateTimePicker · OTPInput
                                                    ▲
                                 field context ─────┘  the control reads label id,
                                                       invalid and disabled from Field

FormMessage / HelperText   standalone message surfaces, for text outside a Field
KeyboardAwareScreen        the screen shell: scrolling, keyboard avoidance, measure
```

`Field` is the association boundary. It renders the label, wires the control's accessible name to it through context, and renders either the error (when `invalid` and `error` are both set) or the description underneath — announced politely when it is an error.

```tsx
import * as React from 'react';
import { Button, Field, Input, KeyboardAwareScreen } from '@beemvp/beeui-ui';

export function EmailForm({ onSubmit }: EmailFormProps) {
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState<string | undefined>();

  // Your rule, your timing, your error string.
  const submit = () => {
    const message = email.includes('@') ? undefined : 'Enter a valid email address.';
    setError(message);
    if (!message) onSubmit(email);
  };

  return (
    <KeyboardAwareScreen contentWidth="sm" safeAreaEdges={['top', 'bottom']}>
      <Field
        error={error}
        invalid={error !== undefined}
        label="Email"
        description="We use this for receipts only."
        required
      >
        <Input
          autoComplete="email"
          inputMode="email"
          onChangeText={setEmail}
          value={email}
        />
      </Field>
      <Button onPress={submit}>Continue</Button>
    </KeyboardAwareScreen>
  );
}
```

Note what BeeUI did and did not do. It associated the label, exposed the required state, rendered the error as a polite live region and kept the focused input above the keyboard. It never looked at the value, never decided when to validate, and never owned submission.

## Rules and invariants

1. **`Field` needs a `label`.** It is a required prop, because an unlabelled control is not a form field.
2. **`invalid` and `error` work together.** `Field` shows the error only when `invalid` is true *and* `error` is a string; otherwise it shows the description. Setting one without the other is the most common reason an error "does not appear".
3. **Controls inherit `invalid` and `disabled` from `Field`.** Text inputs and the date pickers read field context, so you set the state once on the `Field` rather than repeating it on the control.
4. **One control per `Field`.** Use `FormGroup` with a `legend` when several related controls — a radio set, a group of checkboxes — need a shared label and a shared error.
5. **Values are always yours.** Text inputs follow React Native `TextInput` semantics, and the selection controls follow the shapes in the [state model](/docs/learn/state-model/). BeeUI ships no form engine.
6. **`KeyboardAwareScreen` owns viewport composition, not form state.** It handles scrolling, keyboard avoidance, tap-through and a bounded content measure. It does not validate.
7. **Error text is announced, so write it as a sentence.** It reaches assistive technology as a live region, not as decoration.

## Consequences for application code

- **Map your form library to props, not to internals.** Whatever produces your errors — Zod, Yup, a resolver, a server response — the integration is the same three props: `invalid`, `error`, and the control's value/callback pair.
- **Decide validation timing yourself, and be consistent.** On blur, on submit, or on change after the first submit — BeeUI renders whichever you choose.
- **Server errors are just errors.** A failed mutation sets the same `error` prop; there is no separate channel.
- **Bound the measure on wide viewports.** `contentWidth="sm"` keeps a long-line form readable on tablet and Web.
- **Set `safeAreaEdges` deliberately.** `KeyboardAwareScreen` leaves it unset by default precisely so a screen composed under a shell that already owns insets does not double them — see [Ownership model](/docs/learn/ownership-model/).
- **Use `FormMessage` and `HelperText` for text outside a `Field`** — a form-level failure summary, or a note attached to a section rather than to one control.

## Common misconception

> "`Field` validates for me."

It does not, and the symptom is a form where nothing ever turns red: `error` was set but `invalid` stayed false, or validation was never run at all because the component was expected to run it. `Field` is a renderer of validation *results*.

The related anti-pattern is putting a whole group of controls inside a single `Field` to get one label. That produces a control whose accessible name points at several inputs at once. Use `FormGroup` for grouping and keep one control per `Field`.

## Where to go next

- [State model](/docs/learn/state-model/) — controlled and uncontrolled controls.
- [Composition model](/docs/learn/composition-model/) — why the parts must stay together.
- [Accessibility model](/docs/learn/accessibility-model/) — label, error and announcement obligations.
- [Field](/docs/components/reference/field/) · [Input](/docs/components/reference/input/) · [Select](/docs/components/reference/select/) · [Keyboard-aware screen](/docs/components/reference/keyboard-aware-screen/) — exact props and types.
- [Date & time guide](/docs/guides/date-time/) — timezone, locale and storage rules for date fields.
- [Patterns](/docs/patterns/) — sign-in, sign-up and settings forms already composed.

## Source authority

- [`packages/ui/src/components/field.tsx`](https://github.com/beobungbu/BeeUI/blob/main/packages/ui/src/components/field.tsx) — the association and message contract.
- [`packages/ui/src/components/keyboard-aware-screen.tsx`](https://github.com/beobungbu/BeeUI/blob/main/packages/ui/src/components/keyboard-aware-screen.tsx) — screen-level keyboard composition.
- [`docs/components.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/components.md) — the canonical behavior catalog.
