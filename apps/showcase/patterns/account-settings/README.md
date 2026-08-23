# Account, Profile & Settings pattern pack

Production-oriented account chrome built only from the public `@beeui/ui` API. The pack owns presentation and callback contracts; the host application owns routing, persistence, authentication, image picking/uploading, notification permissions, and destructive network actions.

## Screens

1. `ProfileScreen` — profile identity, stats, metadata, and recent activity.
2. `EditProfileScreen` — avatar affordance plus controlled display name, username, bio, and email fields.
3. `SettingsScreen` — production settings home using grouped `SettingsItem` rows, switches, and status badges.
4. `AccountScreen` — identity, contact data, devices, linked accounts, sign out, and a separated delete-account danger zone.
5. `AppearanceScreen` — controlled System / Light / Dark preference with a semantic theme preview.
6. `NotificationSettingsScreen` — master preference, delivery channels, activity, reminders, and product updates with dependent disabled states.
7. `PrivacySecurityScreen` — password, 2FA status, sessions, visibility, discoverability, blocked users, export, and session revocation callbacks.
8. `ChangePasswordScreen` — controlled password fields, requirements, validation, saving, server error, and success states.

## Callback ownership

Every navigation-like row exposes a callback rather than importing a router. Form values and preferences are controlled by the caller. `onChangeAvatar` deliberately stops at the visual affordance; camera/photo-library permissions, picking, cropping, upload, and persistence remain app-owned.

Destructive actions (`onDeleteAccount`, `onRevokeOtherSessions`) expose intent only. Confirmation UI, authentication challenges, networking, retries, and recovery policy remain app-owned.

## State coverage

- Edit Profile: populated, field validation/server error, saving.
- Settings: normal plus notification badge/status state.
- Appearance: system, light, and dark controlled selection.
- Notifications: enabled plus master-disabled dependent switches.
- Privacy & Security: 2FA on/off representations.
- Change Password: default, invalid/server error, saving, and success callback state.

## Pattern-local abstractions

- `SettingsScreenShell` — bounded scroll surface; optionally composes React Native keyboard avoidance for form-heavy screens.
- `SettingsSection` — repeated section title/description rhythm.
- `PreferenceRow` — `SettingsItem` + controlled BeeUI `Switch` composition.
- `ProfileHeader` — profile identity composition.
- `AccountSummary` — account metadata composition.
- `DangerZone` — deliberately local destructive-action presentation.

These are composition examples, not new BeeUI primitives.

## Accessibility

- BeeUI `Field` supplies labels, invalid state, and error announcements to the form controls.
- Switches receive explicit accessibility labels and disabled/checked state from BeeUI.
- Navigation rows use explicit labels where their visible descriptions would otherwise create noisy inferred names.
- Destructive actions use semantic destructive styling and remain separate from routine account controls.
- Long names, email addresses, and descriptions are allowed to wrap rather than relying on fixed single-line layouts.

## Unresolved gaps

### Keyboard-aware form screen composition

`EditProfileScreen` and `ChangePasswordScreen` repeat the same mobile keyboard/scroll concerns already identified by the auth/onboarding pattern pack. This pack keeps a local workaround in `SettingsScreenShell` and adds evidence to existing issue #43 rather than creating a duplicate. No implementation of a generalized `KeyboardAwareScreen` is included here.

No generalized picker gap is opened: Appearance uses `SegmentedControl`, while navigation-style preferences can be delegated to future screens. `DangerZone` remains local because this pack does not establish cross-domain evidence that it belongs in BeeUI core.

## Non-goals

- Router/navigation ownership
- Authentication or security backend implementation
- Notification permission APIs
- Native image picker/camera/cropping/upload
- Select, Tooltip, or Sheet
- Global theme state
- Changes to `packages/**`
- Anchored overlay architecture or issue #35
