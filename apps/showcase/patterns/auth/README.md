# Authentication + Onboarding patterns

Production-oriented application screens built with the current public `@beeui/ui` API. These patterns are intentionally app-level compositions: they demonstrate how BeeUI primitives can produce polished account flows without moving domain UI into the component library.

## Included screens

- `WelcomeScreen`
- `SignInScreen`
- `SignUpScreen`
- `ForgotPasswordScreen`
- `VerifyCodeScreen`
- `ResetPasswordScreen`
- `PasswordUpdatedScreen`
- `InterestsOnboardingScreen`
- `ProfileSetupScreen`

## Controlled screen contracts

The screens do not own authentication networking, routers, auth SDKs, analytics, or persistence. Callers provide controlled values, loading/error state, and callbacks. OTP countdown text is also caller-owned; the screen does not create a hidden timer. Profile photo selection is caller-owned; the screen only exposes an `onChangePhoto` action.

## Public BeeUI primitives used

The pack imports BeeUI only from `@beeui/ui`. It composes:

- `AlertBanner`
- `Avatar`
- `Box`
- `Button`
- `Card`
- `Checkbox`
- `Chip` / `ChipGroup`
- `Field`
- `HStack` / `VStack`
- `Input`
- `Link`
- `OTPInput`
- `PasswordInput`
- `Progress`
- `Separator`
- `Text`
- `Textarea`

## Preview locally

Temporarily import any screen into `apps/showcase/App.tsx`, render it with controlled fixture props, then run:

```bash
pnpm --filter @beeui/showcase web
```

Recommended review sizes:

- 390 x 844
- 430 x 932
- 360px wide
- a wider React Native Web surface

Review both light and dark themes. Restore `apps/showcase/App.tsx` before committing so the shared showcase entry point remains unchanged.

## Supported states

The screen APIs express:

- Sign In: default, field validation, submitting, server error, disabled
- Sign Up: default, invalid fields/terms, loading, server error
- OTP: incomplete, incorrect code, verifying, resend disabled/enabled
- Password reset: validation, requirements, loading, server error
- Interests onboarding: no selection, selected values, loading
- Profile setup: empty/populated, field errors, loading, optional avatar/username/bio
- Success: confirmation + continuation

## Known local compositions

`components/auth-shared.tsx` contains application-pattern helpers only:

- `AuthShell`
- `AuthHeader`
- `AuthDivider`
- `SocialAuthActions`
- `OnboardingProgress`
- `PasswordRequirements`
- `ServerError`

They remain local because they express this pattern pack rather than stable BeeUI primitive contracts.

## BeeUI gaps discovered

| Gap | Evidence | Current workaround | Issue |
| --- | --- | --- | --- |
| Reusable keyboard-aware form-screen composition | Sign In, Sign Up, Forgot Password, Reset Password, Profile Setup | Local `AuthShell` composes `KeyboardAvoidingView` + `ScrollView` around BeeUI content | #43 |

Issue: https://github.com/beobungbu/BeeUI/issues/43

No anchored-overlay gap was investigated or changed here.

## Non-goals

- authentication backend/API calls
- navigation/router ownership
- Expo Router or React Navigation integration
- auth SDK integration
- analytics or storage
- image-picker ownership
- new BeeUI primitives
- `Popover`, `DropdownMenu`, `Select`, `Tooltip`, or issue #35 work

## Verification

Dedicated typecheck:

```bash
pnpm --filter @beeui/showcase exec tsc -p patterns/auth/tsconfig.json --noEmit
```

Repository verification:

```bash
pnpm typecheck
pnpm test
pnpm release:verify
```
