import { Match, Option, Order, Array as A, pipe } from "effect";
import type { AutoDevListing } from "../schema.js";

export type SortKey = "price" | "miles" | "year" | "listed";
export type SortDir = "asc" | "desc";

const orderByPrice: Order.Order<AutoDevListing> = Order.mapInput(
  Order.Number,
  (l: AutoDevListing) => l.retailListing.price ?? Number.MAX_SAFE_INTEGER,
);

const orderByMiles: Order.Order<AutoDevListing> = Order.mapInput(
  Order.Number,
  (l: AutoDevListing) => l.retailListing.miles ?? 0,
);

const orderByYear: Order.Order<AutoDevListing> = Order.mapInput(
  Order.Number,
  (l: AutoDevListing) => l.vehicle.year,
);

const orderByListed: Order.Order<AutoDevListing> = Order.mapInput(
  Order.Number,
  (l: AutoDevListing) => Date.parse(l.createdAt),
);

const orderMap: Record<SortKey, Order.Order<AutoDevListing>> = {
  price: orderByPrice,
  miles: orderByMiles,
  year: orderByYear,
  listed: orderByListed,
};

export const getOrder = (key: SortKey): Order.Order<AutoDevListing> =>
  orderMap[key];

const matchesSearch = (search: string) => {
  const needle = search.toLowerCase();
  return (l: AutoDevListing): boolean =>
    String(l.vehicle.trim ?? "")
      .toLowerCase()
      .includes(needle) ||
    l.vehicle.model.toLowerCase().includes(needle) ||
    String(l.vehicle.exteriorColor ?? "")
      .toLowerCase()
      .includes(needle) ||
    l.retailListing.city.toLowerCase().includes(needle) ||
    (l.retailListing.dealer ?? "").toLowerCase().includes(needle);
};

export const meetsMinimumYear = (
  minimumYear: number | null,
  listing: AutoDevListing,
): boolean =>
  pipe(
    minimumYear,
    Option.fromNullishOr,
    Option.match({
      onNone: () => true,
      onSome: (year) =>
        Order.isGreaterThanOrEqualTo(Order.Number)(listing.vehicle.year, year),
    }),
  );

export const filterListings = (
  listings: readonly AutoDevListing[],
  search: string,
  cpoOnly: boolean,
  brandFilter: string | null,
  modelFilter: string | null,
  yearFilter: number | null,
  fuelFilter: string | null,
): readonly AutoDevListing[] =>
  pipe(
    listings,
    A.filter(
      (listing) =>
        (brandFilter === null || listing.vehicle.make === brandFilter) &&
        (modelFilter === null || listing.vehicle.model === modelFilter) &&
        meetsMinimumYear(yearFilter, listing) &&
        (fuelFilter === null || listing.vehicle.fuel === fuelFilter) &&
        (search.length === 0 || matchesSearch(search)(listing)) &&
        (!cpoOnly || Boolean(listing.retailListing.cpo)),
    ),
  );

const applyDirection = (
  sorted: AutoDevListing[],
  dir: SortDir,
): AutoDevListing[] =>
  Match.value(dir).pipe(
    Match.when("desc", () => A.reverse(sorted)),
    Match.orElse(() => sorted),
  );

export const sortListings = (
  listings: readonly AutoDevListing[],
  key: SortKey | null,
  dir: SortDir,
): AutoDevListing[] =>
  Option.match(Option.fromNullishOr(key), {
    onNone: () => A.fromIterable(listings),
    onSome: (sortKey) =>
      applyDirection(A.sort(listings, getOrder(sortKey)), dir),
  });
