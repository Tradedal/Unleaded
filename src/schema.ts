import {
  Array as Arr,
  Match,
  Option,
  pipe,
  Schema as S,
  SchemaTransformation,
  String as Str,
} from "effect";
import { NormalizedModelName } from "./domain/modelNormalizer.js";

const normalizeText = (value: string): string =>
  Str.capitalize(Str.toLowerCase(value));

const NormalizedText = S.String.pipe(
  S.decodeTo(
    S.String,
    SchemaTransformation.transform({
      decode: normalizeText,
      encode: (value) => value,
    }),
  ),
);

export const Location = S.Tuple([S.Number, S.Number]);

export const Vehicle = S.Struct({
  baseInvoice: S.Number.pipe(S.optional),
  baseMsrp: S.Number.pipe(S.optional),
  bodyStyle: S.String.pipe(S.optional),
  confidence: S.Number.pipe(S.optional),
  doors: S.Number.pipe(S.optional),
  drivetrain: S.String.pipe(S.optional),
  engine: S.String.pipe(S.optional),
  exteriorColor: S.String.pipe(S.optional),
  interiorColor: S.String.pipe(S.optional),
  fuel: NormalizedText,
  make: NormalizedText,
  model: NormalizedModelName,
  seats: S.Number.pipe(S.optional),
  series: S.String.pipe(S.optional),
  squishVin: S.String,
  style: S.String.pipe(S.optional),
  transmission: S.String.pipe(S.optional),
  trim: S.Union([S.String, S.Number]).pipe(S.optional),
  type: S.String.pipe(S.optional),
  vin: S.String.pipe(S.optional),
  year: S.Number,
});

export const RetailListing = S.Struct({
  carfaxUrl: S.String,
  city: S.String,
  cpo: S.Boolean.pipe(S.optional),
  dealer: S.String.pipe(S.optional),
  photoCount: S.Number,
  price: S.Number.pipe(S.optional),
  primaryImage: S.String,
  state: S.String,
  used: S.Boolean.pipe(S.optional),
  vdp: S.String,
  zip: S.String.pipe(S.optional),
  miles: S.Number.pipe(S.optional),
});

export const History = S.Struct({
  accidentCount: S.Number.pipe(S.optional),
  accidents: S.Boolean.pipe(S.optional),
  oneOwner: S.Boolean.pipe(S.optional),
  ownerCount: S.Number.pipe(S.optional),
  personalUse: S.Boolean.pipe(S.optional),
  usageType: S.String.pipe(S.optional),
});

export const AutoDevListing = S.Struct({
  "@id": S.String,
  vin: S.String,
  createdAt: S.String,
  location: Location,
  online: S.Boolean.pipe(S.optional),
  vehicle: Vehicle,
  wholesaleListing: S.Null,
  retailListing: RetailListing,
  history: S.NullOr(History),
});

export type AutoDevListing = S.Schema.Type<typeof AutoDevListing>;

export const ApiLinks = S.Struct({
  next: S.String.pipe(S.optional),
  last: S.String.pipe(S.optional),
});

export const ApiResponse = S.Struct({
  links: ApiLinks.pipe(S.optional),
  total: S.Number.pipe(S.optional),
  data: S.Array(AutoDevListing),
});

const MarketCheckYearValue = S.Union([
  S.Number,
  S.String.pipe(
    S.decodeTo(
      S.Number,
      SchemaTransformation.transform({
        decode: Number,
        encode: String,
      }),
    ),
  ),
]);

const parseYearFromHeading = (
  heading: string | undefined,
): number | undefined =>
  pipe(
    heading,
    Option.fromNullishOr,
    Option.flatMap((value) =>
      Option.fromNullishOr(value.match(/(19|20)\d{2}/)),
    ),
    Option.map((match) => Number(match[0])),
    Option.getOrUndefined,
  );

const toLatitudeLongitude = (value: string | number | undefined): number =>
  Match.value(value).pipe(
    Match.when(Match.string, Number),
    Match.when(Match.number, (coordinate) => coordinate),
    Match.orElse(() => 0),
  );

const EMPTY_TIMESTAMP = "1970-01-01T00:00:00.000Z";

const MarketCheckBuild = S.Struct({
  year: MarketCheckYearValue.pipe(S.optional),
  make: S.String.pipe(S.optional),
  model: S.String.pipe(S.optional),
  trim: S.String.pipe(S.optional),
  version: S.String.pipe(S.optional),
  body_type: S.String.pipe(S.optional),
  vehicle_type: S.String.pipe(S.optional),
  transmission: S.String.pipe(S.optional),
  drivetrain: S.String.pipe(S.optional),
  fuel_type: S.String.pipe(S.optional),
  powertrain_type: S.String.pipe(S.optional),
  engine: S.Union([S.String, S.Number]).pipe(S.optional),
  doors: S.Number.pipe(S.optional),
  cylinders: S.Number.pipe(S.optional),
});

const MarketCheckMedia = S.Struct({
  photo_links: S.Array(S.String).pipe(S.optional),
  photo_links_cached: S.Array(S.String).pipe(S.optional),
});

const MarketCheckDealer = S.Struct({
  id: S.Number.pipe(S.optional),
  website: S.String.pipe(S.optional),
  name: S.String.pipe(S.optional),
  city: S.String.pipe(S.optional),
  state: S.String.pipe(S.optional),
  zip: S.String.pipe(S.optional),
  street: S.String.pipe(S.optional),
  latitude: S.Union([S.String, S.Number]).pipe(S.optional),
  longitude: S.Union([S.String, S.Number]).pipe(S.optional),
});

const MarketCheckListing = S.Struct({
  id: S.String,
  vin: S.String.pipe(S.optional),
  heading: S.String.pipe(S.optional),
  price: S.Number.pipe(S.optional),
  miles: S.Number.pipe(S.optional),
  msrp: S.Number.pipe(S.optional),
  data_source: S.String.pipe(S.optional),
  vdp_url: S.String.pipe(S.optional),
  carfax_clean_title: S.Boolean.pipe(S.optional),
  carfax_1_owner: S.Boolean.pipe(S.optional),
  exterior_color: S.String.pipe(S.optional),
  interior_color: S.String.pipe(S.optional),
  base_int_color: S.String.pipe(S.optional),
  base_ext_color: S.String.pipe(S.optional),
  dom: S.Number.pipe(S.optional),
  dom_180: S.Number.pipe(S.optional),
  dom_active: S.Number.pipe(S.optional),
  dos_active: S.Number.pipe(S.optional),
  seller_type: S.String.pipe(S.optional),
  inventory_type: S.String.pipe(S.optional),
  is_certified: S.Number.pipe(S.optional),
  source: S.String.pipe(S.optional),
  last_seen_at_date: S.String.pipe(S.optional),
  first_seen_at_date: S.String.pipe(S.optional),
  scraped_at_date: S.String.pipe(S.optional),
  mc_dealership: MarketCheckDealer.pipe(S.optional),
  media: MarketCheckMedia.pipe(S.optional),
  dealer: MarketCheckDealer.pipe(S.optional),
  build: MarketCheckBuild.pipe(S.optional),
  dist: S.Number.pipe(S.optional),
});

const MarketCheckResponseSource = S.Struct({
  num_found: S.Number,
  listings: S.Array(MarketCheckListing),
});

const MarketCheckResponseTarget = S.Struct({
  total: S.Number,
  listings: S.Array(AutoDevListing),
});

export const MarketCheckResponse = MarketCheckResponseSource.pipe(
  S.decodeTo(
    MarketCheckResponseTarget,
    SchemaTransformation.transform({
      decode: (
        response,
      ): S.Codec.Encoded<typeof MarketCheckResponseTarget> => ({
        total: response.num_found,
        listings: pipe(
          response.listings,
          Arr.map((listing) => {
            const dealer = listing.dealer ?? listing.mc_dealership;
            const photos = pipe(
              listing.media?.photo_links ?? [],
              Arr.appendAll(listing.media?.photo_links_cached ?? []),
              Arr.filter((photo) => photo.trim().length > 0),
              Arr.dedupe,
            );
            const vin = listing.vin ?? listing.id;
            const latitude = toLatitudeLongitude(dealer?.latitude);
            const longitude = toLatitudeLongitude(dealer?.longitude);
            const year =
              listing.build?.year ?? parseYearFromHeading(listing.heading) ?? 0;
            const fuel = Match.value({
              fuelType: listing.build?.fuel_type?.trim().toLowerCase(),
              powertrainType: listing.build?.powertrain_type
                ?.trim()
                .toLowerCase(),
            }).pipe(
              Match.when(
                ({ fuelType, powertrainType }) =>
                  powertrainType === "bev" ||
                  fuelType?.includes("electric") === true,
                () => "Electric",
              ),
              Match.when(
                ({ fuelType, powertrainType }) =>
                  powertrainType === "phev" ||
                  powertrainType === "hev" ||
                  fuelType?.includes("plug-in hybrid") === true ||
                  fuelType?.includes("hybrid") === true,
                () => "Hybrid",
              ),
              Match.when(
                ({ fuelType }) => fuelType?.includes("gasoline") === true,
                () => "Gasoline",
              ),
              Match.orElse(
                () =>
                  listing.build?.fuel_type ??
                  listing.build?.powertrain_type ??
                  "Unknown",
              ),
            );
            const mappedListing: AutoDevListing = {
              "@id": listing.id,
              vin,
              createdAt:
                listing.last_seen_at_date ??
                listing.first_seen_at_date ??
                listing.scraped_at_date ??
                EMPTY_TIMESTAMP,
              location: [
                Match.value(latitude).pipe(
                  Match.whenAnd(
                    Match.number,
                    Number.isFinite,
                    (coordinate) => coordinate,
                  ),
                  Match.orElse(() => 0),
                ),
                Match.value(longitude).pipe(
                  Match.whenAnd(
                    Match.number,
                    Number.isFinite,
                    (coordinate) => coordinate,
                  ),
                  Match.orElse(() => 0),
                ),
              ],
              vehicle: {
                confidence: 1,
                squishVin: vin,
                year,
                make: listing.build?.make ?? "Unknown",
                model: listing.build?.model ?? "Unknown",
                exteriorColor: listing.exterior_color ?? listing.base_ext_color,
                interiorColor: listing.interior_color ?? listing.base_int_color,
                fuel,
                engine: Match.value(listing.build?.engine).pipe(
                  Match.when(Match.number, String),
                  Match.orElse((engine) => engine),
                ),
                drivetrain: listing.build?.drivetrain,
                doors: listing.build?.doors,
                trim: listing.build?.trim,
                type: listing.build?.vehicle_type,
                series: listing.build?.version,
                style: listing.build?.body_type,
                transmission: listing.build?.transmission,
              },
              wholesaleListing: null,
              retailListing: {
                carfaxUrl: "",
                city: dealer?.city ?? "Unknown",
                photoCount: photos.length,
                price: listing.price ?? listing.msrp,
                primaryImage: photos[0] ?? "",
                state: dealer?.state ?? "Unknown",
                vdp: listing.vdp_url ?? "",
                zip: dealer?.zip,
                miles: listing.miles,
                cpo: listing.is_certified === 1,
                dealer: dealer?.name,
                used:
                  listing.inventory_type === "used" ||
                  listing.inventory_type === "certified",
              },
              history: null,
            };
            return mappedListing;
          }),
        ),
      }),
      encode: (value): S.Schema.Type<typeof MarketCheckResponseSource> => ({
        num_found: value.total,
        listings: pipe(
          value.listings,
          Arr.map((listing) => ({
            id: listing["@id"],
            vin: listing.vin,
            price: listing.retailListing.price,
            miles: listing.retailListing.miles,
            vdp_url: listing.retailListing.vdp,
            inventory_type: Match.value(listing.retailListing.used).pipe(
              Match.when(undefined, () => undefined),
              Match.when(true, () => "used"),
              Match.orElse(() => "new"),
            ),
            is_certified: Match.value(listing.retailListing.cpo).pipe(
              Match.when(true, () => 1),
              Match.orElse(() => 0),
            ),
            last_seen_at_date: listing.createdAt,
            media: {
              photo_links: Match.value(listing.retailListing.primaryImage).pipe(
                Match.when("", () => []),
                Match.orElse((image) => [image]),
              ),
            },
            dealer: {
              name: listing.retailListing.dealer,
              city: listing.retailListing.city,
              state: listing.retailListing.state,
              zip: listing.retailListing.zip,
              latitude: listing.location[0],
              longitude: listing.location[1],
            },
            build: {
              year: listing.vehicle.year,
              make: listing.vehicle.make,
              model: String(listing.vehicle.model),
              trim: Match.value(listing.vehicle.trim).pipe(
                Match.when(Match.number, String),
                Match.orElse((trim) => trim),
              ),
              version: listing.vehicle.series,
              body_type: listing.vehicle.style,
              vehicle_type: listing.vehicle.type,
              transmission: listing.vehicle.transmission,
              drivetrain: listing.vehicle.drivetrain,
              fuel_type: listing.vehicle.fuel,
              engine: listing.vehicle.engine,
              doors: listing.vehicle.doors,
            },
          })),
        ),
      }),
    }),
  ),
);

export const CachedListings = S.Struct({
  timestamp: S.Number,
  listings: S.Array(AutoDevListing),
});

export type CachedListings = S.Schema.Type<typeof CachedListings>;
