# Linting Discipline

Linting enforces explicit, declarative flows and catches fragile patterns early.

### Scope

This repo uses single-package checks in:

- `design/testing-spec.md` for test scope/quality,
- `tsconfig.json` / `node_modules/@effect/language-service` + `@catenarycloud/linteffect` for Effect diagnostics,
- `@biomejs/biome` for style and local correctness checks.

### Rewrite method

When lint fails, rewrite to one clear flow in the target method.

- keep decision logic explicit and local,
- avoid nested wrappers, nested `pipe` towers, and unnecessary helper-only functions,
- do not patch around diagnostics with ad-hoc guards.

### Non-compliant patterns

- helper wrappers that exist only to return an `Effect`,
- nested control-flow constructs that hide branch decisions,
- fallback defaults after decode that mask source contract,
- duplicating state ownership outside service/runtime boundaries.

### Lint workflow

Docs-only edits under `design/`/`attempts/` skip Biome.

For code changes:

- File-level: `./node_modules/.bin/biome lint <file>`
- Directory pass (final status check only): `./node_modules/.bin/biome lint <dir> --reporter=summary`

Run one pass; keep scope tight to touched files.

### Compile checks

Effect/TypeScript gate:

- `./node_modules/.bin/tsgo -p tsconfig.json --noEmit`

Fallback when tsgo is not usable:

- `./node_modules/.bin/tsc -p tsconfig.json --noEmit`

### Effect language-service checks

Use workspace-local diagnostics when lint/tsgo output needs context:

- `./node_modules/.bin/effect-language-service diagnostics --file <absolute-file-path> --format text --severity error,warning`

Use this as context before changes; always finish with tsgo/jest checks relevant to the edited scope.

### Completion criteria

- touched files are clean under Biome and tsgo,
- no local workarounds in place to silence diagnostics,
- remaining behavior is covered by updated tests where applicable.
