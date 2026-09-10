# Testing Discipline

This document defines how tests are designed and developed in this repository.

### Scope and hierarchy

`AGENTS.md` defines execution guards.
`design/linting-spec.md` defines lint workflow and compiler checks.

### Test file names

Keep one test file per target service or command surface:

- `listings.test.ts`
- `main.test.ts`

Do not invent extra naming schemes. Test names stay tied to the production surface they validate.

### Test labels

Labels should describe observable outcomes at a boundary:

- `It shows visible listings for the selected filters when a search completes`
- `It keeps the selected car highlighted while navigating list entries`
- `It restores the cached response after API fetch success`

### Test organization

- Keep behavior tests thin: call real entrypoints and assert outcomes.
- Prefer service/command-level tests over asserting internals.
- Build test fixtures once and reuse via shared helpers where possible.
- If no stable fixture exists, start from a production call and assert the resulting state.

### Single-package scope (Unleaded)

This repo is a single package. There are no `backend`/`website` workspaces.

Use shared helpers for:

- normalized input
- mocked API responses
- fixed list payloads for list/filter behavior

Avoid one-off data builders per test when shared values already exist.

### Required validation for non-doc changes

After source/test edits:

1. `./node_modules/.bin/biome lint <changed-file-or-dir> [--reporter=summary]`
2. `./node_modules/.bin/tsgo -p tsconfig.json --noEmit`
3. `./node_modules/.bin/vitest run`

If a change is docs-only (`*.md`, no code edits), skip biome/tsgo/jest and validate only docs placement and references.

### Coverage discipline

For behavior work, start with a narrow failing assertion that reflects the contract you claim to fix.
Then:

- verify the failure is reproducible with a realistic regression scenario,
- apply one scoped fix,
- rerun the same focused checks.

Do not rely on a temporary mock-only test branch to greenify existing behavior.

### CLI/API behavior testing

For API/service logic, tests validate:

- request input normalization,
- command wiring,
- runtime side effects through exported boundaries,
- visible/error outputs.

If the test requires command invocation, invoke the exported command entrypoint directly instead of recreating its internals in test scaffolding.
