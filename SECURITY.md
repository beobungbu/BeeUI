# Security Policy

BeeUI is a source-owned React Native UI system: most consumers copy component source into
their own project (via `pnpm beeui -- add <component>`) rather than depending on a published
package. Security responsibility is therefore split between what BeeUI ships and what a
consumer subsequently owns and builds.

## Supported versions

BeeUI has not published a stable `1.0.0` release yet (see
[`docs/roadmap.md`](docs/roadmap.md) and program tracker
[#114](https://github.com/beobungbu/BeeUI/issues/114)). Packages are `private: true` and are
not published to npm; there is no npm dist-tag or GitHub release to carry a supported-version
promise.

Until a public `1.0.0` is released:

- security fixes are made against the `main` branch only;
- there is no long-term-support branch and no backport policy;
- the compatibility baseline (peer dependency versions actually tested) is
  [`docs/compatibility-matrix.md`](docs/compatibility-matrix.md); reports assuming an
  untested peer combination will be triaged against that baseline first.

Once BeeUI publishes `1.0.0`, this section will be updated with a concrete supported-version
table before or in the same change that ships the first stable release.

## Reporting a vulnerability

**Do not open a public GitHub issue for a security report.** Public issues are indexed and
notify every watcher, including before a fix exists.

Report privately through GitHub's built-in advisory workflow:

1. Go to the repository's **Security** tab → **Report a vulnerability**
   (`https://github.com/beobungbu/BeeUI/security/advisories/new`), or use **Security advisories** listed above.
2. This opens a private draft security advisory visible only to the repository owner and
   people explicitly added to it — GitHub Private Vulnerability Reporting. It does not
   require you to already have a public exploit or proof-of-concept write-up; a clear
   description, affected component/file, and reproduction steps are enough to start triage.

If the GitHub advisory workflow is ever unavailable to you (for example, you are not a
GitHub user), open a normal issue that says only "security report pending — requesting a
private contact channel" with no vulnerability detail, and a maintainer will follow up with
a private channel.

Because this repository is currently **private**, only collaborators can see it at all;
GitHub private vulnerability reporting still works for private repositories and is the
correct channel for both current collaborators and, later, any external contributor once the
repository is made public.

### What to include

- affected file(s)/component(s) and, if known, the exact commit SHA;
- whether the issue affects generated component source that consumers copy, the
  `@beemvp/beeui-core`/`@beemvp/beeui-tokens`/`@beemvp/beeui-ui` workspace packages, the Registry/CLI
  (`scripts/beeui.mjs`, `registry/registry.json`), or CI/release tooling;
- minimal reproduction (code snippet, failing test, or steps);
- impact assessment if you have one (data exposure, arbitrary code execution, supply-chain
  risk, denial of service, accessibility-blocking regression is **not** a security issue —
  file that as a normal accessibility bug instead).

## Response and triage expectations

BeeUI is currently maintained by a small team without a dedicated security team or a
contractual SLA. As a good-faith target, not a guarantee:

- initial acknowledgement of a private report: best-effort within a few business days;
- triage outcome (confirmed / not applicable / needs more information): communicated in the
  private advisory thread once the report is reviewed;
- a fix timeline is set after triage and depends on severity and whether the affected code is
  BeeUI-owned or comes from an upstream dependency.

No specific response-time SLA is promised. If you receive no acknowledgement within a
reasonable time, it is acceptable to follow up on the same private advisory thread.

## Supply-chain and dependency policy

- `pnpm-lock.yaml` is committed and the canonical source of truth for resolved versions;
  install with `pnpm install --frozen-lockfile` in CI and when verifying a report.
- Registry entries (`registry/registry.json`) are JSON data only — a Registry entry cannot
  execute JavaScript or arbitrary commands, and the CLI (`pnpm beeui`) never fetches or
  executes remote code; it copies files already present in this repository. Reports of a
  Registry entry attempting to escape the target project path, write outside a configured
  `componentsDir`/`libDir`, or otherwise perform path traversal are treated as security
  issues.
- Native-runtime and CI secrets/tokens are never committed; if you find a leaked credential
  in the repository history, report it as a vulnerability so it can be rotated and purged.
- Dependency vulnerabilities reported by GitHub Dependabot/`npm audit` against a workspace
  package are triaged like any other security report; a vulnerability only in a dependency
  that BeeUI's shipped source does not actually exercise at runtime is documented as a
  non-issue rather than silently ignored.

## Disclosure coordination

BeeUI follows coordinated disclosure: the reporter and maintainer agree on a disclosure
timeline once a fix is available or the issue is confirmed as won't-fix, and public
disclosure (a GitHub Security Advisory, changelog entry, or both) happens after a fix is
released or by mutual agreement if no fix is forthcoming. Credit is given to the reporter
in the published advisory unless the reporter asks to remain anonymous.

## Guidance for source-owned consumers

Because most BeeUI usage is source-owned (copied via the Registry/CLI, not `npm install`ed),
a security fix in this repository does not automatically reach a consumer's project. If a
security advisory affects a component you have already copied:

- the advisory will name the affected component(s)/file(s) and the corrected source;
- re-run `pnpm beeui -- add <component>` (or manually re-apply the diff) against the fixed
  version, then re-review any local modifications you layered on top of the copied file;
- `pnpm beeui -- doctor` can help detect drift between your copy and the current registry
  source, but it does not itself apply a security fix.

Consumers who instead depend on the workspace packages directly (`@beemvp/beeui-core`,
`@beemvp/beeui-tokens`, `@beemvp/beeui-ui`) once they are published should upgrade the package version
named in the advisory.
