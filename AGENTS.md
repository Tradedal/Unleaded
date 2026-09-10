# AGENTS.md

## Annoying phrases
Never use or construct
- "So yes,": this is a dumb rehashing

## Scope of work

Always parse carefully user's request into an explicit scope. Always assume scope is narrower than you want to make it. There are no cases for wide repo changes, ever.

Parse the task input into the scope
- Requested outcome or change
- Allowed files, modules, areas
- Forbidden actions and limits

Never expand scope into existing broken imports, failing tests, nearby implementation patterns, deleted prior code, or obvious next steps are not scope expansion triggers.

Existing imports can be dangerous derailment triggers. Deleted code must get ignored unless the user explicitly names it as a reference. Never reconstruct deleted implementations from memory, failing tests, generated diagnostics, surrounding call sites, or prior branch shape. Treat deleted symbols as intentionally absent until the user provides the reference or asks for implementation.

Remember to always assume NARROW scope.

## Specification language guard

Avoid possession-style ('owns') and edge-jargon ('boundary') wording across all content and code. Use neutral terms: responsible, assigned,contract, path, graph and so on.

## Fragmented Coding Guardrail

Prohibited patterns: pre-staging, consts soup, unrelated local cosnts scatter, excessive helpering and wrapping.

Effect logic belongs in continuous, visible blocks. The reader should see the data flow, validation, control path, and final Effect where the work occurs.

The codebase uses declarative Effect composition and data transforms: you must never attempt "staged assembly". Logic should remain inside the pipeline or expression that express the operation. Artificial pre-staging through unrelated local constants is not a valid way to make code pass lint rules.

Loose const collections are invalid code shape. A block that declares a bag of values, then later assembles them into a call, hides the actual flow and fragments the logic. This applies even when the surrounding code already uses that style.

Helper functions are reserved for real domain concepts, shared behavior, or named concepts with standalone value. They are not a place to move branches, temporary values, or Effect steps out of sight.

Inline assembly has the same problem as loose constants. Moving fragments into call arguments without a clear local flow still obscures the operation.

Final returns must not hide composed transforms. Do not return `pipe(...)`, `Ar.map/filterMap/reduce(...)`, native array transforms, object literals, or other computed assemblies inline when the return shape matters. Bind the final contract-shaped value to a local with an explicit domain type, then return that value. This is allowed only for the final operation result, not as a bag of staged inputs.

Existing const-soup flow should be cleaned before additional development in that area. The corrected form keeps the Effect pipeline visible, keeps decisions local to the operation, and removes artificial staging.

One special warning: do not insert manually assembled schemas that "narrow" something to satisfy requirements, or serve as validators for "business logic" requirements. You can use Data.taggedEnum or ADT pattern for actions or decisions, never manually copy/pasted pieces of auto-generated schemas.

## Effect graph guardrail

All effect services, Atoms, projections, and reactivity share one Layer graph and runtime. Side paths, split contexts, and alternate state paths are prohibited.

# Non-Invention Guardrail

hen established patterns or documentation exist, use them as designed. Do not synthesize alternate flows, parallel abstractions, or novel control structures for novelty or perceived elegance. Favor terseness and directness. Assume documented patterns are correct and treat unprompted invention as a failure mode.

Example

Over-engineered, imperative wiring that manually manages state and lifecycle:

```ts
const eventsAtom = runtime.atom(
  Effect.fnUntraced(function* (get) {
    const stream = yield* service.eventStream;

    yield* Effect.forkScoped(
      Stream.runForEach(stream, (event) =>
        Effect.sync(() => get.setSelf(Result.success(event)))
      )
    );

    return Result.initial();
  })
);
```

Correct, minimal, and pattern-aligned wiring that leverages existing abstractions:

```ts
const eventsAtom = runtime
  .atom(() => Stream.unwrap(Service.eventStream))
  .pipe(Atom.keepAlive);
```

# Front-End State Discipline

Do not introduce parallel or ad-hoc state management mechanisms to compensate for architectural misuse. State must flow through the declared runtime, services, and atoms. UI layers consume exposed atoms directly and invoke service-provided actions for mutations. No local snapshots, mirrors, or workaround layers.

# Core Principles

Validation and uncertainty handling belong at schema or decode boundaries.
After successful decode, treat data as production-ready.
Do not scatter defensive checks, fallback values, or extra state layers.
Prefer existing high-level abstractions over custom control flow.
Keep pipelines flat, readable, and auditable.
Avoid helper extraction driven by aesthetics rather than documented need.

# Primary Rule

Never introduce defensive branches, fallback payloads, or speculative states to mask uncertainty. Address uncertainty by correcting the model, schema, or upstream contract.

## Repository Docs

Use these guides for validation and implementation rules:

- `design/testing-spec.md`
- `design/linting-spec.md`

For this repo, testing and lint validation is single-package:

- `./node_modules/.bin/tsgo -p tsconfig.json --noEmit`
- `./node_modules/.bin/biome lint ...`
- `./node_modules/.bin/vitest run`
