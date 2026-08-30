import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import * as NodeServices from "@effect/platform-node/NodeServices";
import {
  Array as Arr,
  Clock,
  Config,
  Context,
  Data,
  Effect,
  FileSystem,
  Layer,
  Match,
  Option,
  pipe,
  Schema as S,
  Sink,
  Stream,
} from "effect";
import { HttpClient, HttpClientRequest, UrlParams } from "effect/unstable/http";
import { KeyValueStore } from "effect/unstable/persistence";
import { resolveModelQuery } from "../domain/modelNormalizer.js";
import {
  ApiResponse,
  MarketCheckResponse,
  CachedListings,
  type AutoDevListing,
} from "../schema.js";

const AUTO_DEV_BASE_URL = "https://api.auto.dev/listings";
const MARKETCHECK_BASE_URL = "https://api.marketcheck.com/v2/search/car/active";
const BLOCKED_DEALERS_FILE = "./blocked-dealers.json";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const AUTO_DEV_PAGE_SIZE = 100;
const MARKETCHECK_PAGE_SIZE = 50;
const MARKETCHECK_MAX_RADIUS = 100;
const BlockedDealersSchema = S.Array(S.String);
const BlockedDealersJson = S.fromJsonString(BlockedDealersSchema);
const ApiResponseJson = S.fromJsonString(S.Unknown);
const CachedListingsJson = S.fromJsonString(CachedListings);
const ApiErrorPayload = S.Struct({
  error: S.String.pipe(S.optional),
  message: S.String.pipe(S.optional),
  detail: S.String.pipe(S.optional),
});
const MAX_ERROR_BODY_PREVIEW = 400;
type SearchProvider = "auto.dev" | "marketcheck";

type ProviderSelection = Data.TaggedEnum<{
  AutoDev: { readonly apiKey: string };
  MarketCheck: { readonly apiKey: string };
  Missing: { readonly reason: "NoApiKeys" };
}>;

const ProviderSelection = Data.taggedEnum<ProviderSelection>();

class ApiRequestError extends Data.TaggedError("ApiRequestError")<{
  readonly message: string;
  readonly provider: SearchProvider;
  readonly status: number;
  readonly page: number;
}> {}

export interface SearchParams {
  zip: string;
  distance: number;
  engine?: string;
  brand?: string;
  model?: string;
  milesRange?: string;
  priceRange?: string;
  state?: string;
  yearRange?: string;
  blockDealers?: string[];
}

export interface ListingsSnapshot {
  readonly listings: readonly AutoDevListing[];
  readonly status: string;
}

const formatError = (error: unknown): string =>
  Match.value(error).pipe(
    Match.when(Match.instanceOf(Error), (cause) => cause.message),
    Match.orElse(String),
  );

const toTruncatedJsonText = (body: string) =>
  Match.value(body.length <= MAX_ERROR_BODY_PREVIEW).pipe(
    Match.when(true, () => body),
    Match.orElse(() => `${body.slice(0, MAX_ERROR_BODY_PREVIEW)}...`),
  );

const extractApiErrorMessage = (payload: unknown): string | undefined =>
  pipe(
    payload,
    S.decodeUnknownOption(ApiErrorPayload),
    Option.flatMap(({ detail, error, message }) =>
      Arr.findFirst(
        [error, message, detail],
        (value): value is string =>
          value !== undefined && value.trim().length > 0,
      ),
    ),
    Option.map((value) => value.trim()),
    Option.getOrUndefined,
  );

const createApiError = (
  provider: SearchProvider,
  status: number,
  page: number,
  message: string,
): ApiRequestError =>
  new ApiRequestError({
    message,
    provider,
    status,
    page,
  });

const parseApiBody = ({
  body,
  page,
  provider,
  status,
}: {
  body: string;
  page: number;
  provider: SearchProvider;
  status: number;
}) =>
  Effect.gen(function* () {
    const parsed = yield* S.decodeUnknownEffect(ApiResponseJson)(body).pipe(
      Effect.mapError(
        (error) =>
          new Error(
            `Failed to parse ${provider} API response for page ${page} (HTTP ${status}): ${formatError(error)}. Body: ${toTruncatedJsonText(body)}`,
          ),
      ),
    );
    return yield* Match.value(status >= 400).pipe(
      Match.when(true, () =>
        Effect.fail(
          createApiError(
            provider,
            status,
            page,
            `${provider} API request failed on page ${page} (HTTP ${status}): ${
              extractApiErrorMessage(parsed) ??
              `Unexpected body format: ${toTruncatedJsonText(body)}`
            }`,
          ),
        ),
      ),
      Match.orElse(() => Effect.succeed(parsed)),
    );
  });

const isAutoDevQuotaError = (error: unknown): boolean =>
  Match.value(error).pipe(
    Match.whenAnd(
      Match.instanceOf(ApiRequestError),
      { _tag: "ApiRequestError", provider: "auto.dev", status: 429 },
      () => true,
    ),
    Match.whenAnd(
      Match.instanceOf(ApiRequestError),
      {
        provider: "auto.dev",
        message: (message: string) =>
          /too many requests|rate limit|quota|insufficient credits/i.test(
            message,
          ),
      },
      () => true,
    ),
    Match.orElse(() => false),
  );

const selectProvider = (
  autoDevApiKey: string | undefined,
  marketcheckApiKey: string | undefined,
): ProviderSelection =>
  Match.value({ autoDevApiKey, marketcheckApiKey }).pipe(
    Match.when({ autoDevApiKey: Match.string }, ({ autoDevApiKey }) =>
      ProviderSelection.AutoDev({ apiKey: autoDevApiKey }),
    ),
    Match.when({ marketcheckApiKey: Match.string }, ({ marketcheckApiKey }) =>
      ProviderSelection.MarketCheck({ apiKey: marketcheckApiKey }),
    ),
    Match.orElse(() => ProviderSelection.Missing({ reason: "NoApiKeys" })),
  );

const toCacheKey = ({
  zip,
  distance,
  engine,
  brand,
  model,
  milesRange,
  priceRange,
  state,
  yearRange,
}: SearchParams) =>
  pipe(
    [
      "listings",
      zip,
      String(distance),
      engine,
      brand,
      model,
      milesRange,
      priceRange,
      state,
      yearRange,
    ],
    Arr.map(Option.fromNullishOr),
    Arr.map(Option.getOrElse(() => "any")),
    Arr.join("_"),
  );

const normalizeEngineFilter = (
  engine: string | undefined,
): string | undefined =>
  pipe(
    engine,
    Option.fromNullishOr,
    Option.map((value) => value.trim().toLowerCase()),
    Option.filter((value) => value.length > 0),
    Option.getOrUndefined,
  );

const normalizeStateFilter = (state: string | undefined): string =>
  pipe(
    state,
    Option.fromNullishOr,
    Option.map((value) => value.trim().toUpperCase()),
    Option.filter((value) => value.length > 0),
    Option.getOrElse(() => ""),
  );

const normalizeDealerName = (dealer: string): string =>
  dealer.trim().toLowerCase();

const normalizeDealerNames = (dealers: readonly string[]): string[] =>
  pipe(
    dealers,
    Arr.map((dealer) => normalizeDealerName(dealer)),
    Arr.filter((dealer) => dealer.length > 0),
    Arr.dedupe,
  );

const clampToMarketcheckRadius = (distance: number): number =>
  Math.min(Math.max(distance, 1), MARKETCHECK_MAX_RADIUS);

const toYearRange = (yearRange: string | undefined): string =>
  yearRange?.trim() ?? "2023-2026";

const toMarketCheckEngineFilter = (
  engine: string | undefined,
): string | undefined =>
  Match.value(normalizeEngineFilter(engine)).pipe(
    Match.when(undefined, () => undefined),
    Match.when("ev", () => "electric"),
    Match.when("phev", () => "hybrid"),
    Match.when("gas", () => "gasoline"),
    Match.orElse((normalized) => normalized),
  );

const loadBlockedDealers = (fs: FileSystem.FileSystem) =>
  fs.readFileString(BLOCKED_DEALERS_FILE).pipe(
    Effect.flatMap((body) =>
      S.decodeUnknownEffect(BlockedDealersJson)(body).pipe(
        Effect.map(normalizeDealerNames),
      ),
    ),
    Effect.catch(() => Effect.succeed([] as string[])),
  );

const saveBlockedDealers = (
  fs: FileSystem.FileSystem,
  blockDealers: readonly string[],
) =>
  fs.writeFileString(
    BLOCKED_DEALERS_FILE,
    S.encodeSync(BlockedDealersJson)(blockDealers),
  );

const getNextPage = (url: string): Option.Option<number> =>
  pipe(
    url.match(/[?&]page=(\d+)\b/),
    Option.fromNullishOr,
    Option.flatMap((match) => Option.fromNullishOr(match[1])),
    Option.map(Number),
    Option.filter((page) => Number.isInteger(page) && page > 0),
  );

const getNextPageFromTotal = (
  page: number,
  total: number | undefined,
): Option.Option<number> =>
  pipe(
    total,
    Option.fromNullishOr,
    Option.filter((count) => page * AUTO_DEV_PAGE_SIZE < count),
    Option.map(() => page + 1),
  );

const matchesEngineFilter = (
  engine: string | undefined,
  listing: AutoDevListing,
): boolean =>
  Match.value({
    normalizedEngine: normalizeEngineFilter(engine),
    fuel: listing.vehicle.fuel.toLowerCase(),
    type: pipe(
      listing.vehicle.type,
      Option.fromNullishOr,
      Option.map((value) => value.toLowerCase()),
      Option.getOrElse(() => ""),
    ),
    series: pipe(
      listing.vehicle.series,
      Option.fromNullishOr,
      Option.map((value) => value.toLowerCase()),
      Option.getOrElse(() => ""),
    ),
  }).pipe(
    Match.when({ normalizedEngine: undefined }, () => true),
    Match.when(
      ({ normalizedEngine }) =>
        normalizedEngine === "electric" || normalizedEngine === "ev",
      ({ fuel, type }) => fuel === "electric" || type === "electric",
    ),
    Match.when(
      ({ normalizedEngine }) =>
        normalizedEngine === "hybrid" || normalizedEngine === "phev",
      ({ series, type }) =>
        type === "hybrid" ||
        series.includes("gas/electric hybrid") ||
        series.includes("plug-in hybrid"),
    ),
    Match.when(
      ({ normalizedEngine }) =>
        normalizedEngine === "gas" || normalizedEngine === "gasoline",
      ({ fuel, series, type }) =>
        fuel !== "electric" &&
        type !== "electric" &&
        type !== "hybrid" &&
        !series.includes("gas/electric hybrid") &&
        !series.includes("plug-in hybrid"),
    ),
    Match.orElse(
      ({ fuel, normalizedEngine, type }) =>
        fuel === normalizedEngine || type === normalizedEngine,
    ),
  );

const isBlockedDealer = (
  blockedDealers: ReadonlySet<string>,
  listing: AutoDevListing,
): boolean =>
  pipe(
    listing.retailListing.dealer,
    Option.fromNullishOr,
    Option.map(normalizeDealerName),
    Option.exists((dealer) => blockedDealers.has(dealer)),
  );

export class ListingsService extends Context.Service<ListingsService>()(
  "ListingsService",
  {
    make: Effect.all([
      Config.option(Config.string("AUTO_DEV_API_KEY")),
      Config.option(Config.string("MARKETCHECK_API_KEY")),
      KeyValueStore.KeyValueStore,
      HttpClient.HttpClient,
      FileSystem.FileSystem,
    ]).pipe(
      Effect.map(
        ([autoDevApiKeyOption, marketcheckApiKeyOption, kv, http, fs]) => {
          const autoDevApiKey = Option.getOrUndefined(autoDevApiKeyOption);
          const marketcheckApiKey = Option.getOrUndefined(
            marketcheckApiKeyOption,
          );
          return {
            fetch: (params: SearchParams) => {
              const normalizedEngine = normalizeEngineFilter(params.engine);
              const normalizedState = normalizeStateFilter(params.state);
              const normalizedZip = params.zip.trim();
              const normalizedBlockDealers = normalizeDealerNames(
                params.blockDealers ?? [],
              );
              const queryModels = pipe(
                params.model,
                Option.fromNullishOr,
                Option.map(resolveModelQuery),
                Option.map(Arr.join(",")),
                Option.getOrUndefined,
              );
              const marketCheckFuelFilter = toMarketCheckEngineFilter(
                params.engine,
              );
              const cacheKey = toCacheKey(params);
              const filterResponse =
                (blockedDealers: Set<string>) =>
                (
                  listings: readonly AutoDevListing[],
                ): readonly AutoDevListing[] =>
                  pipe(
                    listings,
                    Arr.filter(
                      (listing) =>
                        matchesEngineFilter(normalizedEngine, listing) &&
                        !isBlockedDealer(blockedDealers, listing),
                    ),
                  );

              const fetchFromAutoDevPage = (
                page: number,
                blockedDealers: Set<string>,
              ) =>
                pipe(
                  Match.value(autoDevApiKey).pipe(
                    Match.when(undefined, () =>
                      HttpClientRequest.get(AUTO_DEV_BASE_URL),
                    ),
                    Match.orElse((apiKey) =>
                      HttpClientRequest.bearerToken(
                        HttpClientRequest.get(AUTO_DEV_BASE_URL),
                        apiKey,
                      ),
                    ),
                  ),
                  HttpClientRequest.setUrlParams(
                    UrlParams.fromInput({
                      zip: Option.getOrUndefined(
                        Option.liftPredicate(
                          normalizedZip,
                          (zip) => zip.length > 0,
                        ),
                      ),
                      includes: "total",
                      limit: String(AUTO_DEV_PAGE_SIZE),
                      page: String(page),
                      distance: String(params.distance),
                      "retailListing.miles": params.milesRange ?? "0-25100",
                      "retailListing.price": params.priceRange ?? "0-50000",
                      "vehicle.year": toYearRange(params.yearRange),
                      "retailListing.state": Option.getOrUndefined(
                        Option.liftPredicate(
                          normalizedState,
                          (state) =>
                            state.length > 0 && normalizedZip.length === 0,
                        ),
                      ),
                      "vehicle.fuel": params.engine,
                      "vehicle.make": params.brand,
                      "vehicle.model": queryModels,
                    }),
                  ),
                  http.execute,
                  Effect.flatMap((response) =>
                    response.text.pipe(
                      Effect.tap((body) =>
                        fs.writeFileString(
                          `./cache/raw_page_${page}.json`,
                          body,
                        ),
                      ),
                      Effect.flatMap((body) =>
                        parseApiBody({
                          body,
                          status: response.status,
                          provider: "auto.dev",
                          page,
                        }),
                      ),
                    ),
                  ),
                  Effect.flatMap((json) =>
                    S.decodeUnknownEffect(ApiResponse)(json).pipe(
                      Effect.map((response) => ({
                        response,
                        filtered: filterResponse(blockedDealers)(response.data),
                      })),
                    ),
                  ),
                );

              const fetchFromMarketCheckPage = (
                start: number,
                blockedDealers: Set<string>,
              ) =>
                HttpClientRequest.get(MARKETCHECK_BASE_URL).pipe(
                  HttpClientRequest.setUrlParams(
                    UrlParams.fromInput({
                      api_key: marketcheckApiKey,
                      model: queryModels,
                      make: params.brand,
                      start: String(start),
                      rows: String(MARKETCHECK_PAGE_SIZE),
                      radius: String(clampToMarketcheckRadius(params.distance)),
                      year_range: toYearRange(params.yearRange),
                      state: Option.getOrUndefined(
                        Option.liftPredicate(
                          normalizedState,
                          (state) =>
                            state.length > 0 && normalizedZip.length === 0,
                        ),
                      ),
                      zip: Option.getOrUndefined(
                        Option.liftPredicate(
                          normalizedZip,
                          (zip) => zip.length > 0,
                        ),
                      ),
                      miles_range: params.milesRange,
                      price_range: params.priceRange,
                      fuel_type: marketCheckFuelFilter,
                    }),
                  ),
                  http.execute,
                  Effect.flatMap((response) =>
                    response.text.pipe(
                      Effect.tap((body) =>
                        fs.writeFileString(
                          `./cache/raw_marketcheck_${start}.json`,
                          body,
                        ),
                      ),
                      Effect.flatMap((body) =>
                        parseApiBody({
                          body,
                          status: response.status,
                          provider: "marketcheck",
                          page: start,
                        }),
                      ),
                    ),
                  ),
                  Effect.flatMap((json) =>
                    S.decodeUnknownEffect(MarketCheckResponse)(json).pipe(
                      Effect.map((response) => ({
                        response,
                        filtered: filterResponse(blockedDealers)(
                          response.listings,
                        ),
                      })),
                    ),
                  ),
                );

              const fetchAutoDev = (blockedDealers: Set<string>) =>
                Stream.paginate(1, (page) =>
                  fetchFromAutoDevPage(page, blockedDealers).pipe(
                    Effect.map(
                      (responseWithFilter) =>
                        [
                          [responseWithFilter],
                          Match.value(
                            responseWithFilter.response.data.length,
                          ).pipe(
                            Match.when(0, () => Option.none<number>()),
                            Match.orElse(() =>
                              Option.orElse(
                                getNextPageFromTotal(
                                  page,
                                  responseWithFilter.response.total,
                                ),
                                () =>
                                  Option.flatMap(
                                    Option.fromNullishOr(
                                      responseWithFilter.response.links?.next,
                                    ),
                                    getNextPage,
                                  ),
                              ),
                            ),
                          ),
                        ] as const,
                    ),
                  ),
                ).pipe(
                  Stream.mapAccum(
                    () => [] as AutoDevListing[],
                    (acc, responseWithFilter) => {
                      const listings = Arr.appendAll(
                        acc,
                        responseWithFilter.filtered,
                      );
                      const snapshot: ListingsSnapshot = {
                        listings,
                        status: `AUTO.dev loaded ${listings.length}${Option.getOrElse(
                          Option.map(
                            Option.fromNullishOr(
                              responseWithFilter.response.total,
                            ),
                            (total) => ` / ${total}`,
                          ),
                          () => "",
                        )}`,
                      };
                      return [listings, [snapshot]] as const;
                    },
                  ),
                  Stream.prepend<ListingsSnapshot>([
                    { listings: [], status: "Querying AUTO.dev API" },
                  ]),
                );

              const getMarketCheckNextStart = (
                start: number,
                total: number | undefined,
                listingCount: number,
              ): Option.Option<number> =>
                pipe(
                  total,
                  Option.fromNullishOr,
                  Option.filter(() => listingCount >= MARKETCHECK_PAGE_SIZE),
                  Option.filter((count) => start + listingCount < count),
                  Option.map(() => start + MARKETCHECK_PAGE_SIZE),
                );

              const fetchMarketCheck = (blockedDealers: Set<string>) =>
                Stream.paginate(0, (start) =>
                  fetchFromMarketCheckPage(start, blockedDealers).pipe(
                    Effect.map(
                      (responseWithFilter) =>
                        [
                          [responseWithFilter],
                          getMarketCheckNextStart(
                            start,
                            responseWithFilter.response.total,
                            responseWithFilter.response.listings.length,
                          ),
                        ] as const,
                    ),
                  ),
                ).pipe(
                  Stream.mapAccum(
                    () => [] as AutoDevListing[],
                    (acc, responseWithFilter) => {
                      const listings = Arr.appendAll(
                        acc,
                        responseWithFilter.filtered,
                      );
                      const snapshot: ListingsSnapshot = {
                        listings,
                        status: `MarketCheck loaded ${listings.length}${Option.getOrElse(
                          Option.map(
                            Option.fromNullishOr(
                              responseWithFilter.response.total,
                            ),
                            (total) => ` / ${total}`,
                          ),
                          () => "",
                        )}`,
                      };
                      return [listings, [snapshot]] as const;
                    },
                  ),
                  Stream.prepend<ListingsSnapshot>([
                    { listings: [], status: "Querying MarketCheck API" },
                  ]),
                );

              const fetchFromProviders = (blockedDealers: Set<string>) =>
                ProviderSelection.$match(
                  selectProvider(autoDevApiKey, marketcheckApiKey),
                  {
                    Missing: () =>
                      Stream.fail(
                        new Error(
                          "No API keys configured. Set AUTO_DEV_API_KEY or MARKETCHECK_API_KEY.",
                        ),
                      ),
                    MarketCheck: () => fetchMarketCheck(blockedDealers),
                    AutoDev: () =>
                      fetchAutoDev(blockedDealers).pipe(
                        Stream.catchIf(isAutoDevQuotaError, (error) =>
                          Option.match(
                            Option.fromNullishOr(marketcheckApiKey),
                            {
                              onNone: () =>
                                Stream.fail(
                                  new Error(
                                    `Auto.dev quota/rate limit hit, but MARKETCHECK_API_KEY is not configured. ${formatError(error)}`,
                                  ),
                                ),
                              onSome: () => fetchMarketCheck(blockedDealers),
                            },
                          ),
                        ),
                      ),
                  },
                ).pipe(
                  Stream.tapSink(
                    Sink.last<ListingsSnapshot>().pipe(
                      Sink.mapEffect(
                        Option.match({
                          onNone: () => Effect.void,
                          onSome: ({ listings }) =>
                            Clock.currentTimeMillis.pipe(
                              Effect.flatMap((timestamp) =>
                                kv.set(
                                  toCacheKey(params),
                                  S.encodeSync(CachedListingsJson)({
                                    timestamp,
                                    listings,
                                  }),
                                ),
                              ),
                            ),
                        }),
                      ),
                    ),
                  ),
                );

              return Stream.unwrap(
                Effect.gen(function* () {
                  const storedBlockDealers = yield* loadBlockedDealers(fs);
                  const mergedBlockDealers = pipe(
                    storedBlockDealers,
                    Arr.appendAll(normalizedBlockDealers),
                    normalizeDealerNames,
                  );
                  const blockedDealers = new Set(mergedBlockDealers);
                  yield* saveBlockedDealers(fs, mergedBlockDealers).pipe(
                    Effect.orElseSucceed(() => undefined),
                    Effect.when(
                      Effect.succeed(normalizedBlockDealers.length > 0),
                    ),
                  );
                  return yield* kv.get(cacheKey).pipe(
                    Effect.flatMap(Effect.fromNullishOr),
                    Effect.mapError(() => new Error("cache miss")),
                    Effect.flatMap((data) =>
                      Clock.currentTimeMillis.pipe(
                        Effect.flatMap((currentTimeMillis) =>
                          S.decodeUnknownEffect(
                            S.fromJsonString(CachedListings),
                          )(data).pipe(
                            Effect.filterOrFail(
                              (cache) =>
                                currentTimeMillis - cache.timestamp <
                                CACHE_TTL_MS,
                              () => new Error("cache expired"),
                            ),
                          ),
                        ),
                      ),
                    ),
                    Effect.map((cache) => {
                      const snapshot: ListingsSnapshot = {
                        listings: filterResponse(blockedDealers)(
                          cache.listings,
                        ),
                        status: "Loaded from cache",
                      };
                      return Stream.make(snapshot);
                    }),
                    Effect.orElseSucceed(() =>
                      fetchFromProviders(blockedDealers),
                    ),
                  );
                }),
              );
            },
            listBlockedDealers: () => loadBlockedDealers(fs),
            addBlockedDealers: (blockDealers: readonly string[]) =>
              Effect.gen(function* () {
                const normalizedBlockDealers =
                  normalizeDealerNames(blockDealers);
                const stored = yield* loadBlockedDealers(fs);
                const merged = pipe(
                  stored,
                  Arr.appendAll(normalizedBlockDealers),
                  normalizeDealerNames,
                );
                yield* saveBlockedDealers(fs, merged);
                return merged;
              }),
            removeBlockedDealers: (blockDealers: readonly string[]) =>
              Effect.gen(function* () {
                const normalizedBlockDealers =
                  normalizeDealerNames(blockDealers);
                const removeSet = new Set(normalizedBlockDealers);
                const stored = yield* loadBlockedDealers(fs);
                const remaining = normalizeDealerNames(
                  pipe(
                    stored,
                    Arr.filter((dealer) => !removeSet.has(dealer)),
                  ),
                );
                yield* saveBlockedDealers(fs, remaining);
                return remaining;
              }),
            clearBlockedDealers: () =>
              Effect.gen(function* () {
                yield* saveBlockedDealers(fs, []);
                return [];
              }),
          };
        },
      ),
    ),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(
      Layer.mergeAll(
        KeyValueStore.layerFileSystem("./cache").pipe(
          Layer.provide(NodeServices.layer),
        ),
        NodeHttpClient.layerUndici,
        NodeServices.layer,
      ),
    ),
  );
}
