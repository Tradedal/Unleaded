import * as Atom from "effect/unstable/reactivity/Atom";
import {
  Array as Arr,
  Effect,
  Layer,
  Match,
  Order,
  pipe,
  Predicate,
  String as Str,
  type Stream,
  Struct,
} from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import {
  filterListings,
  meetsMinimumYear,
  sortListings,
  type SortDir,
  type SortKey,
} from "../domain/sorting.js";
import type { AutoDevListing } from "../schema.js";
import type { ListingsSnapshot } from "../services/ListingsService.js";

const runtime = Atom.runtime(Layer.empty);

export type ViewState = {
  search: string;
  searchInput: string;
  searchMode: boolean;
  sortKey: SortKey | null;
  sortDir: SortDir;
  page: number;
  pageSize: number;
  cpoOnly: boolean;
  brandFilter: string | null;
  brandSelectMode: boolean;
  modelFilter: string | null;
  modelSelectMode: boolean;
  yearFilter: number | null;
  yearSelectMode: boolean;
  fuelFilter: string | null;
  fuelSelectMode: boolean;
  selectInput: string;
  selectedIndex: number;
};

export const initialViewState: ViewState = {
  search: "",
  searchInput: "",
  searchMode: false,
  sortKey: null,
  sortDir: "asc",
  page: 0,
  pageSize: 15,
  cpoOnly: false,
  brandFilter: null,
  brandSelectMode: false,
  modelFilter: null,
  modelSelectMode: false,
  yearFilter: null,
  yearSelectMode: false,
  fuelFilter: null,
  fuelSelectMode: false,
  selectInput: "",
  selectedIndex: 0,
};

export const viewStateAtom = Atom.make<ViewState>(initialViewState);

const selectItemPredicateAtom = Atom.make((get) =>
  pipe(
    get(viewStateAtom).selectInput,
    Str.toLowerCase,
    Str.includes,
    Predicate.mapInput((item: { readonly label: string }) =>
      Str.toLowerCase(item.label),
    ),
  ),
);

const initialListingsSnapshot: ListingsSnapshot = {
  listings: [],
  status: "Loading cache",
};

export const listingsLoadAtom = runtime.fn(
  (stream: Stream.Stream<ListingsSnapshot, Error>) => stream,
  { initialValue: initialListingsSnapshot },
);

export const listingsAtom = Atom.make(
  (get) =>
    AsyncResult.getOrElse(get(listingsLoadAtom), () => initialListingsSnapshot)
      .listings,
);

export const loadingAtom = Atom.make((get) =>
  AsyncResult.isWaiting(get(listingsLoadAtom)),
);

export const loadFailedAtom = Atom.make((get) =>
  AsyncResult.isFailure(get(listingsLoadAtom)),
);

export const loadedCountAtom = Atom.make((get) => get(listingsAtom).length);

export const loadingStatusAtom = Atom.make((get) =>
  AsyncResult.matchWithError(get(listingsLoadAtom), {
    onInitial: () => initialListingsSnapshot.status,
    onError: (error) => error.message,
    onDefect: String,
    onSuccess: ({ value }) => value.status,
  }),
);

export const brandsAtom = Atom.make((get) =>
  pipe(
    get(listingsAtom),
    Arr.map((listing) => listing.vehicle.make),
    Arr.filter((make) => make.length > 0),
    Arr.dedupe,
    Arr.sort(Order.String),
  ),
);

export const brandItemsAtom = Atom.make((get) =>
  pipe(
    get(brandsAtom),
    Arr.map((brand) => ({ label: brand, value: brand })),
    Arr.prepend({ label: "All brands", value: null as string | null }),
    Arr.filter(get(selectItemPredicateAtom)),
  ),
);

export const modelsAtom = Atom.make((get) =>
  pipe(
    get(listingsAtom),
    Arr.filter(
      (listing) =>
        get(viewStateAtom).brandFilter === null ||
        listing.vehicle.make === get(viewStateAtom).brandFilter,
    ),
    Arr.map((listing) => listing.vehicle.model),
    Arr.filter((model) => model.length > 0),
    Arr.dedupe,
    Arr.sort(Order.String),
  ),
);

export const modelItemsAtom = Atom.make((get) =>
  pipe(
    get(modelsAtom),
    Arr.map((model) => ({ label: model, value: model })),
    Arr.prepend({ label: "All models", value: null as string | null }),
    Arr.filter(get(selectItemPredicateAtom)),
  ),
);

export const yearsAtom = Atom.make((get) =>
  pipe(
    get(listingsAtom),
    Arr.map((listing) => listing.vehicle.year),
    Arr.dedupe,
    Arr.sort(Order.flip(Order.Number)),
  ),
);

export const yearItemsAtom = Atom.make((get) =>
  pipe(
    get(yearsAtom),
    Arr.map((year) => ({ label: String(year), value: year })),
    Arr.prepend({ label: "All years", value: null as number | null }),
    Arr.filter(get(selectItemPredicateAtom)),
  ),
);

export const fuelsAtom = Atom.make((get) =>
  pipe(
    get(listingsAtom),
    Arr.filter(
      (listing) =>
        (get(viewStateAtom).brandFilter === null ||
          listing.vehicle.make === get(viewStateAtom).brandFilter) &&
        (get(viewStateAtom).modelFilter === null ||
          listing.vehicle.model === get(viewStateAtom).modelFilter) &&
        meetsMinimumYear(get(viewStateAtom).yearFilter, listing),
    ),
    Arr.map((listing) => listing.vehicle.fuel),
    Arr.dedupe,
    Arr.sort(Order.String),
  ),
);

export const fuelItemsAtom = Atom.make((get) =>
  pipe(
    get(fuelsAtom),
    Arr.map((fuel) => ({ label: fuel, value: fuel })),
    Arr.prepend({ label: "All fuels", value: null as string | null }),
    Arr.filter(get(selectItemPredicateAtom)),
  ),
);

export const appendSelectCharAction = Atom.fnSync((char: string, ctx) =>
  ctx.set(
    viewStateAtom,
    pipe(
      ctx(viewStateAtom),
      Struct.evolve({
        selectInput: (selectInput) => `${selectInput}${char}`,
        selectedIndex: () => 0,
      }),
    ),
  ),
);

export const deleteSelectCharAction = Atom.fnSync((_: undefined, ctx) =>
  ctx.set(
    viewStateAtom,
    pipe(
      ctx(viewStateAtom),
      Struct.evolve({
        selectInput: (selectInput) => selectInput.slice(0, -1),
        selectedIndex: () => 0,
      }),
    ),
  ),
);

const selectItemCountAtom = Atom.make((get) =>
  Match.value(get(viewStateAtom)).pipe(
    Match.when({ brandSelectMode: true }, () => get(brandItemsAtom).length),
    Match.when({ modelSelectMode: true }, () => get(modelItemsAtom).length),
    Match.when({ yearSelectMode: true }, () => get(yearItemsAtom).length),
    Match.when({ fuelSelectMode: true }, () => get(fuelItemsAtom).length),
    Match.orElse(() => 0),
  ),
);

export const filteredAtom = Atom.make((get) =>
  filterListings(
    get(listingsAtom),
    get(viewStateAtom).search,
    get(viewStateAtom).cpoOnly,
    get(viewStateAtom).brandFilter,
    get(viewStateAtom).modelFilter,
    get(viewStateAtom).yearFilter,
    get(viewStateAtom).fuelFilter,
  ),
);

export const sortedAtom = Atom.make((get) =>
  sortListings(
    get(filteredAtom),
    get(viewStateAtom).sortKey,
    get(viewStateAtom).sortDir,
  ),
);

export const totalPagesAtom = Atom.make((get) =>
  Math.max(1, Math.ceil(get(sortedAtom).length / get(viewStateAtom).pageSize)),
);

export const visibleAtom = Atom.make((get) => {
  const { page, pageSize } = get(viewStateAtom);
  const sorted = get(sortedAtom);
  const start = page * pageSize;
  const visible: readonly AutoDevListing[] = pipe(
    sorted,
    Arr.drop(start),
    Arr.take(pageSize),
  );
  return visible;
});

export const headerAtom = Atom.make((get) => ({
  sortKey: get(viewStateAtom).sortKey,
  sortDir: get(viewStateAtom).sortDir,
  search: get(viewStateAtom).search,
  page: get(viewStateAtom).page,
  filteredTotal: get(sortedAtom).length,
  total: get(listingsAtom).length,
  pageSize: get(viewStateAtom).pageSize,
  cpoOnly: get(viewStateAtom).cpoOnly,
  brandFilter: get(viewStateAtom).brandFilter,
  modelFilter: get(viewStateAtom).modelFilter,
  fuelFilter: get(viewStateAtom).fuelFilter,
  totalPages: get(totalPagesAtom),
}));

export const cycleSortAction = Atom.fnSync((key: SortKey, ctx) =>
  ctx.set(
    viewStateAtom,
    Match.value(ctx(viewStateAtom)).pipe(
      Match.when({ sortKey: Match.is(key), sortDir: "asc" }, (state) =>
        Struct.evolve(state, {
          sortDir: () => "desc" as const,
          page: () => 0,
        }),
      ),
      Match.when({ sortKey: Match.is(key), sortDir: "desc" }, (state) =>
        Struct.evolve(state, {
          sortKey: () => null,
          sortDir: () => "asc" as const,
          page: () => 0,
        }),
      ),
      Match.orElse((state) =>
        Struct.evolve(state, {
          sortKey: () => key,
          sortDir: () => "asc" as const,
          page: () => 0,
        }),
      ),
    ),
  ),
);

export const nextPageAction = runtime.fn((_: undefined, ctx) =>
  Effect.sync(() =>
    ctx.set(
      viewStateAtom,
      pipe(
        ctx(viewStateAtom),
        Struct.evolve({
          page: (page) => Math.min(page + 1, ctx(totalPagesAtom) - 1),
        }),
      ),
    ),
  ),
);

export const moveSelectPreviousAction = runtime.fn((_: undefined, ctx) =>
  Effect.sync(() =>
    ctx.set(
      viewStateAtom,
      pipe(
        ctx(viewStateAtom),
        Struct.evolve({
          selectedIndex: (selectedIndex) =>
            Match.value({
              count: ctx(selectItemCountAtom),
              selectedIndex,
            }).pipe(
              Match.when({ count: 0 }, () => 0),
              Match.when({ selectedIndex: 0 }, ({ count }) => count - 1),
              Match.orElse(({ selectedIndex: index }) => index - 1),
            ),
        }),
      ),
    ),
  ),
);

export const moveSelectNextAction = runtime.fn((_: undefined, ctx) =>
  Effect.sync(() =>
    ctx.set(
      viewStateAtom,
      pipe(
        ctx(viewStateAtom),
        Struct.evolve({
          selectedIndex: (selectedIndex) =>
            Match.value({
              count: ctx(selectItemCountAtom),
              selectedIndex,
            }).pipe(
              Match.when({ count: 0 }, () => 0),
              Match.when(
                ({ count, selectedIndex: index }) => index === count - 1,
                () => 0,
              ),
              Match.orElse(({ selectedIndex: index }) => index + 1),
            ),
        }),
      ),
    ),
  ),
);

export const prevPageAction = runtime.fn((_: undefined, ctx) =>
  Effect.sync(() =>
    ctx.set(
      viewStateAtom,
      pipe(
        ctx(viewStateAtom),
        Struct.evolve({ page: (page) => Math.max(page - 1, 0) }),
      ),
    ),
  ),
);

export const toggleCpoAction = runtime.fn((_: undefined, ctx) =>
  Effect.sync(() =>
    ctx.set(
      viewStateAtom,
      pipe(
        ctx(viewStateAtom),
        Struct.evolve({ cpoOnly: (cpoOnly) => !cpoOnly, page: () => 0 }),
      ),
    ),
  ),
);

export const clearSearchAction = runtime.fn((_: undefined, ctx) =>
  Effect.sync(() =>
    ctx.set(
      viewStateAtom,
      pipe(
        ctx(viewStateAtom),
        Struct.evolve({
          search: () => "",
          searchInput: () => "",
          page: () => 0,
        }),
      ),
    ),
  ),
);

export const openBrandSelectAction = runtime.fn((_: undefined, ctx) =>
  Effect.sync(() =>
    ctx.set(
      viewStateAtom,
      pipe(
        ctx(viewStateAtom),
        Struct.evolve({
          brandSelectMode: () => true,
          modelSelectMode: () => false,
          fuelSelectMode: () => false,
          yearSelectMode: () => false,
          selectInput: () => "",
          selectedIndex: () => 0,
        }),
      ),
    ),
  ),
);

export const closeBrandSelectAction = runtime.fn((_: undefined, ctx) =>
  Effect.sync(() =>
    ctx.set(
      viewStateAtom,
      pipe(
        ctx(viewStateAtom),
        Struct.evolve({
          brandSelectMode: () => false,
          selectInput: () => "",
        }),
      ),
    ),
  ),
);

export const applyBrandFilterAction = runtime.fn((value: string | null, ctx) =>
  Effect.sync(() =>
    ctx.set(
      viewStateAtom,
      pipe(
        ctx(viewStateAtom),
        Struct.evolve({
          brandFilter: () => value,
          page: () => 0,
          brandSelectMode: () => false,
          selectInput: () => "",
        }),
      ),
    ),
  ),
);

export const clearBrandFilterAction = runtime.fn((_: undefined, ctx) =>
  Effect.sync(() =>
    ctx.set(
      viewStateAtom,
      pipe(
        ctx(viewStateAtom),
        Struct.evolve({ brandFilter: () => null, page: () => 0 }),
      ),
    ),
  ),
);

export const startSearchAction = runtime.fn((_: undefined, ctx) =>
  Effect.sync(() => {
    const state = ctx(viewStateAtom);
    ctx.set(
      viewStateAtom,
      pipe(
        state,
        Struct.evolve({
          searchMode: () => true,
          searchInput: () => state.search,
        }),
      ),
    );
  }),
);

export const cancelSearchAction = runtime.fn((_: undefined, ctx) =>
  Effect.sync(() => {
    const state = ctx(viewStateAtom);
    ctx.set(
      viewStateAtom,
      pipe(
        state,
        Struct.evolve({
          searchMode: () => false,
          searchInput: () => state.search,
        }),
      ),
    );
  }),
);

export const commitSearchAction = runtime.fn((_: undefined, ctx) =>
  Effect.sync(() => {
    const state = ctx(viewStateAtom);
    ctx.set(
      viewStateAtom,
      pipe(
        state,
        Struct.evolve({
          search: () => state.searchInput,
          searchMode: () => false,
          page: () => 0,
        }),
      ),
    );
  }),
);

export const appendSearchCharAction = runtime.fn((char: string, ctx) =>
  Effect.sync(() =>
    ctx.set(
      viewStateAtom,
      pipe(
        ctx(viewStateAtom),
        Struct.evolve({
          searchInput: (searchInput) => `${searchInput}${char}`,
        }),
      ),
    ),
  ),
);

export const deleteSearchCharAction = runtime.fn((_: undefined, ctx) =>
  Effect.sync(() =>
    ctx.set(
      viewStateAtom,
      pipe(
        ctx(viewStateAtom),
        Struct.evolve({
          searchInput: (searchInput) => searchInput.slice(0, -1),
        }),
      ),
    ),
  ),
);

export const openModelSelectAction = runtime.fn((_: undefined, ctx) =>
  Effect.sync(() =>
    ctx.set(
      viewStateAtom,
      pipe(
        ctx(viewStateAtom),
        Struct.evolve({
          modelSelectMode: () => true,
          brandSelectMode: () => false,
          fuelSelectMode: () => false,
          yearSelectMode: () => false,
          selectInput: () => "",
          selectedIndex: () => 0,
        }),
      ),
    ),
  ),
);

export const closeModelSelectAction = runtime.fn((_: undefined, ctx) =>
  Effect.sync(() =>
    ctx.set(
      viewStateAtom,
      pipe(
        ctx(viewStateAtom),
        Struct.evolve({
          modelSelectMode: () => false,
          selectInput: () => "",
        }),
      ),
    ),
  ),
);

export const applyModelFilterAction = runtime.fn((value: string | null, ctx) =>
  Effect.sync(() =>
    ctx.set(
      viewStateAtom,
      pipe(
        ctx(viewStateAtom),
        Struct.evolve({
          modelFilter: () => value,
          page: () => 0,
          modelSelectMode: () => false,
          selectInput: () => "",
        }),
      ),
    ),
  ),
);

export const clearModelFilterAction = runtime.fn((_: undefined, ctx) =>
  Effect.sync(() =>
    ctx.set(
      viewStateAtom,
      pipe(
        ctx(viewStateAtom),
        Struct.evolve({ modelFilter: () => null, page: () => 0 }),
      ),
    ),
  ),
);

export const openYearSelectAction = runtime.fn((_: undefined, ctx) =>
  Effect.sync(() =>
    ctx.set(
      viewStateAtom,
      pipe(
        ctx(viewStateAtom),
        Struct.evolve({
          yearSelectMode: () => true,
          modelSelectMode: () => false,
          brandSelectMode: () => false,
          fuelSelectMode: () => false,
          selectInput: () => "",
          selectedIndex: () => 0,
        }),
      ),
    ),
  ),
);

export const closeYearSelectAction = runtime.fn((_: undefined, ctx) =>
  Effect.sync(() =>
    ctx.set(
      viewStateAtom,
      pipe(
        ctx(viewStateAtom),
        Struct.evolve({
          yearSelectMode: () => false,
          selectInput: () => "",
        }),
      ),
    ),
  ),
);

export const applyYearFilterAction = runtime.fn((value: number | null, ctx) =>
  Effect.sync(() =>
    ctx.set(
      viewStateAtom,
      pipe(
        ctx(viewStateAtom),
        Struct.evolve({
          yearFilter: () => value,
          page: () => 0,
          yearSelectMode: () => false,
          selectInput: () => "",
        }),
      ),
    ),
  ),
);

export const clearYearFilterAction = runtime.fn((_: undefined, ctx) =>
  Effect.sync(() =>
    ctx.set(
      viewStateAtom,
      pipe(
        ctx(viewStateAtom),
        Struct.evolve({ yearFilter: () => null, page: () => 0 }),
      ),
    ),
  ),
);

export const openFuelSelectAction = runtime.fn((_: undefined, ctx) =>
  Effect.sync(() =>
    ctx.set(
      viewStateAtom,
      pipe(
        ctx(viewStateAtom),
        Struct.evolve({
          fuelSelectMode: () => true,
          modelSelectMode: () => false,
          brandSelectMode: () => false,
          selectedIndex: () => 0,
          selectInput: () => "",
          yearSelectMode: () => false,
        }),
      ),
    ),
  ),
);

export const closeFuelSelectAction = runtime.fn((_: undefined, ctx) =>
  Effect.sync(() =>
    ctx.set(
      viewStateAtom,
      pipe(
        ctx(viewStateAtom),
        Struct.evolve({
          fuelSelectMode: () => false,
          selectInput: () => "",
        }),
      ),
    ),
  ),
);

export const applyFuelFilterAction = runtime.fn((value: string | null, ctx) =>
  Effect.sync(() =>
    ctx.set(
      viewStateAtom,
      pipe(
        ctx(viewStateAtom),
        Struct.evolve({
          fuelFilter: () => value,
          page: () => 0,
          fuelSelectMode: () => false,
          selectInput: () => "",
        }),
      ),
    ),
  ),
);

export const clearFuelFilterAction = runtime.fn((_: undefined, ctx) =>
  Effect.sync(() =>
    ctx.set(
      viewStateAtom,
      pipe(
        ctx(viewStateAtom),
        Struct.evolve({ fuelFilter: () => null, page: () => 0 }),
      ),
    ),
  ),
);
