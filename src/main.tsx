#!/usr/bin/env node

import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import {
  Array as Arr,
  Effect,
  Layer,
  Match,
  Option,
  pipe,
  Schema as S,
} from "effect";
import {
  Argument as Args,
  Command,
  Flag as Options,
  Prompt,
} from "effect/unstable/cli";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { ListingsService } from "./services/ListingsService.js";
import { renderApp } from "./ui/App.js";
import { listingsLoadAtom } from "./ui/atoms.js";

const parseBlockDealerArg = (value: string): readonly string[] => {
  const trimmed = value.trim();
  return Match.value({
    empty: trimmed.length === 0,
    json: trimmed.startsWith("[") && trimmed.endsWith("]"),
  }).pipe(
    Match.when({ empty: true }, () => []),
    Match.when({ json: true }, () =>
      pipe(
        trimmed,
        S.decodeUnknownOption(S.fromJsonString(S.Array(S.String))),
        Option.getOrElse(() => [trimmed]),
      ),
    ),
    Match.orElse(() => [trimmed]),
  );
};

const normalizeBlockDealers = (values: readonly string[]): string[] =>
  pipe(
    values,
    Arr.flatMap(parseBlockDealerArg),
    Arr.map((dealer) => dealer.trim()),
    Arr.filter((dealer) => dealer.length > 0),
    Arr.dedupeWith((left, right) => left.toLowerCase() === right.toLowerCase()),
  );

const parseYearRange = (yearRange: string) => {
  const trimmed = yearRange.trim();
  return pipe(
    trimmed.match(/^(\d{4})-(\d{4})$/),
    Effect.fromNullishOr,
    Effect.mapError(
      () =>
        new Error(
          `Invalid --yearRange "${yearRange}". Expected format YYYY-YYYY, for example 2023-2026.`,
        ),
    ),
    Effect.filterOrFail(
      (match) => Number(match[1]) <= Number(match[2]),
      () =>
        new Error(
          `Invalid --yearRange "${yearRange}". Start year must be <= end year.`,
        ),
    ),
    Effect.map(() => trimmed),
  );
};

const printBlockedDealers = (blockedDealers: readonly string[]) =>
  Match.value(blockedDealers).pipe(
    Match.when(
      (dealers) => dealers.length === 0,
      () => Effect.log("No blocked dealers configured."),
    ),
    Match.orElse((dealers) =>
      pipe(
        Effect.log("Blocked dealers:"),
        Effect.andThen(
          Effect.forEach(dealers, (dealer) => Effect.log(`- ${dealer}`), {
            discard: true,
          }),
        ),
      ),
    ),
  );

const runSearch = ({
  zip,
  brand,
  model,
  distance,
  engine,
  milesRange,
  priceRange,
  state,
  blockDealer,
  yearRange,
}: {
  zip: Option.Option<string>;
  brand: Option.Option<string>;
  model: Option.Option<string>;
  distance: number;
  engine: Option.Option<string>;
  milesRange: string;
  priceRange: string;
  state: string;
  blockDealer: readonly string[];
  yearRange: string;
}) =>
  Effect.gen(function* () {
    const validatedYearRange = yield* parseYearRange(yearRange);
    const hasStateFilter = state.trim().length > 0;
    const resolvedZip = yield* Option.match(zip, {
      onNone: () =>
        Match.value(hasStateFilter).pipe(
          Match.when(true, () => Effect.succeed("")),
          Match.orElse(() => Prompt.text({ message: "Enter zip (required)" })),
        ),
      onSome: Effect.succeed,
    });
    const registry = AtomRegistry.make();
    const service = yield* ListingsService;
    registry.set(
      listingsLoadAtom,
      service.fetch({
        zip: resolvedZip,
        distance: Math.max(distance, 1),
        engine: Option.getOrUndefined(engine),
        brand: Option.getOrUndefined(brand),
        model: Option.getOrUndefined(model),
        milesRange,
        priceRange,
        state,
        blockDealers: normalizeBlockDealers(blockDealer),
        yearRange: validatedYearRange,
      }),
    );
    yield* renderApp(registry);
  });

const blockedDealersArg = Args.string("dealer").pipe(Args.variadic());

const blockListCommand = Command.make("list", {}, () =>
  Effect.gen(function* () {
    const service = yield* ListingsService;
    const blocked = yield* service.listBlockedDealers();
    yield* printBlockedDealers(blocked);
  }),
);

const blockAddCommand = Command.make(
  "add",
  { dealer: blockedDealersArg },
  ({ dealer }) =>
    Effect.gen(function* () {
      const service = yield* ListingsService;
      const blocked = yield* service.addBlockedDealers(
        normalizeBlockDealers(dealer),
      );
      yield* printBlockedDealers(blocked);
    }),
);

const blockRemoveCommand = Command.make(
  "remove",
  { dealer: blockedDealersArg },
  ({ dealer }) =>
    Effect.gen(function* () {
      const service = yield* ListingsService;
      const blocked = yield* service.removeBlockedDealers(
        normalizeBlockDealers(dealer),
      );
      yield* printBlockedDealers(blocked);
    }),
);

const blockClearCommand = Command.make("clear", {}, () =>
  Effect.gen(function* () {
    const service = yield* ListingsService;
    const blocked = yield* service.clearBlockedDealers();
    yield* printBlockedDealers(blocked);
  }),
);

const blockCommand = Command.make("block", {}, () =>
  Effect.log("Use `unleaded block list|add|remove|clear`"),
).pipe(
  Command.withSubcommands([
    blockListCommand,
    blockAddCommand,
    blockRemoveCommand,
    blockClearCommand,
  ]),
);

const command = Command.make(
  "unleaded",
  {
    zip: Options.string("zip").pipe(
      Options.withAlias("z"),
      Options.withDescription("Zip code for search location"),
      Options.optional,
    ),
    brand: Options.string("brand").pipe(
      Options.withAlias("b"),
      Options.withDescription("Brand/make name (e.g., Hyundai, Tesla)"),
      Options.optional,
    ),
    model: Options.string("model")
      .pipe(
        Options.withAlias("m"),
        Options.withDescription(
          "Model name (e.g., Ioniq 5, Model 3), skip to find all models",
        ),
      )
      .pipe(Options.optional),
    distance: Options.integer("distance").pipe(
      Options.withAlias("d"),
      Options.withDescription("Search radius in miles"),
      Options.withDefault(50),
    ),
    engine: Options.string("engine").pipe(
      Options.withAlias("e"),
      Options.withDescription(
        "Engine type filter (for example: electric, hybrid, gas)",
      ),
      Options.optional,
    ),
    milesRange: Options.string("milesRange").pipe(
      Options.withAlias("M"),
      Options.withDescription("Miles range filter (e.g., 0-25100)"),
      Options.withDefault("0-25100"),
    ),
    priceRange: Options.string("priceRange").pipe(
      Options.withAlias("P"),
      Options.withDescription("Price range filter (e.g., 0-50000)"),
      Options.withDefault("0-50000"),
    ),
    state: Options.string("state").pipe(
      Options.withAlias("s"),
      Options.withDescription(
        "State where vehicle is located (e.g., CA). Use with no zip for state-wide search.",
      ),
      Options.withDefault(""),
    ),
    blockDealer: Options.string("blockDealer")
      .pipe(
        Options.withAlias("block-dealer"),
        Options.withDescription(
          "Dealer names to block (example: '[\"Premium Autos\"]')",
        ),
      )
      .pipe(Options.atMost(Number.MAX_SAFE_INTEGER)),
    yearRange: Options.string("yearRange").pipe(
      Options.withAlias("Y"),
      Options.withDescription("Year range filter (e.g., 2023-2026)"),
      Options.withDefault("2023-2026"),
    ),
  },
  runSearch,
).pipe(Command.withSubcommands([blockCommand]));

const MainLayer = Layer.mergeAll(ListingsService.layer, NodeServices.layer);

NodeRuntime.runMain(
  Command.run(command, { version: "0.1.0" }).pipe(Effect.provide(MainLayer)),
);
