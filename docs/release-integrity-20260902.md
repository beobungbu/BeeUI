# Release integrity — 2026-09-02

Tracker: #407

## Package version authority

The owner-selected date-version label is `20260902`. npm requires package versions to use SemVer syntax, so BeeUI encodes that label as the lockstep package version **`20260902.0.0`**.

The following manifests are mechanically kept in lockstep:

- workspace root
- `@beemvp/beeui-core`
- `@beemvp/beeui-tokens`
- `@beemvp/beeui-ui`
- `@beemvp/beeui-cli`

## Candidate identity vs verification-harness identity

The historical immutable artifact candidate remains `5cb061f`; it produced the retained hashes documented in `docs/rc-candidate.md`. The Web visual verification harness was subsequently stabilized at `18a6833` without changing package source. These are separate identities and must not be conflated.

The package-version change to `20260902.0.0` means the historical `5cb061f` tarballs are evidence only; they are not publication candidates for the current package set. After #407 lands and required owner/device gates are satisfied, stamp a new immutable candidate and rerun the exact-candidate matrix.

## Release naming authority

Operational release targets are only:

- `@beemvp/beeui-core`
- `@beemvp/beeui-tokens`
- `@beemvp/beeui-ui`
- `@beemvp/beeui-cli`

The superseded legacy scope is historical-only and is rejected from release-critical tracked files by `pnpm release-control-plane:check`.

## Static analysis

A focused ESLint layer checks React Hooks across reusable UI source and the production demo. Existing intentional structural-dependency exceptions are documented locally; actionable dependency omissions are fixed rather than globally disabled.
