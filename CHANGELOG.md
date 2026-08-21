# Changelog

All notable consumer-facing changes to BeeUI are recorded here.

## Unreleased

### Added

- Release-package verification via `pnpm release:verify`, including package export checks, packed-manifest validation, clean-consumer installation, and a CI verification artifact.
- A documented release/versioning contract that separates automated Linux verification from macOS/device-only gates.

### Changed

- The bare React Native smoke consumer now installs packed BeeUI tarballs instead of copying package source directly, so Metro/native verification exercises the actual package boundary.
- BeeUI package manifests now define an explicit `src` packed surface while remaining private during the pre-1.0 distribution phase.
