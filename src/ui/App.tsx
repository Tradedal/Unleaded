import { RegistryContext, useAtomValue } from "@effect/atom-react";
import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { formatDistanceToNowStrict } from "date-fns";
import { Array as Arr, Effect, Match, Option, pipe } from "effect";
import { Box, render, Text, useApp, useInput } from "ink";
import Spinner from "ink-spinner";
import type React from "react";
import type { SortDir, SortKey } from "../domain/sorting.js";
import type { AutoDevListing } from "../schema.js";
import { createAppInputHandler, useAppAtomCommands } from "./appCommands.js";
import {
  brandItemsAtom,
  fuelItemsAtom,
  headerAtom,
  loadFailedAtom,
  loadedCountAtom,
  loadingAtom,
  loadingStatusAtom,
  modelItemsAtom,
  viewStateAtom,
  visibleAtom,
  yearItemsAtom,
} from "./atoms.js";

const link = (url: string, text: string) =>
  Match.value(process.stdout.isTTY).pipe(
    Match.when(true, () => `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`),
    Match.orElse(() => text),
  );

const googleVinLink = (vin: string) =>
  `https://www.google.com/search?q=${encodeURIComponent(vin)}`;

const cpoValueLabels = ["No", "Yes"] as const;
const sortDirectionLabels: Record<SortDir, string> = { asc: "↑", desc: "↓" };

const truncate = (value: string, width: number): string =>
  Match.value({ hasWidth: width > 0, fits: value.length <= width }).pipe(
    Match.when({ hasWidth: false }, () => ""),
    Match.when({ fits: true }, () => value),
    Match.orElse(() => `${value.slice(0, Math.max(0, width - 3))}...`),
  );

type SelectItem<T extends string | number | null> = {
  label: string;
  value: T;
};

const MENU_LIMIT = 8;

const selectColor = (selected: boolean): "cyan" | undefined =>
  Match.value(selected).pipe(
    Match.when(true, () => "cyan" as const),
    Match.orElse(() => undefined),
  );

const selectMarker = (selected: boolean): string =>
  Match.value(selected).pipe(
    Match.when(true, () => "> "),
    Match.orElse(() => "  "),
  );

const SelectMenu = <T extends string | number | null>({
  items,
  label,
  selectedIndex,
}: {
  items: readonly SelectItem<T>[];
  label: string;
  selectedIndex: number;
}): React.JSX.Element =>
  Match.value(items.length).pipe(
    Match.when(0, () => (
      <Box marginBottom={1} flexDirection="column">
        <Text color="yellow">{label}</Text>
        <Text color="yellow">No matches available</Text>
      </Box>
    )),
    Match.orElse(() => {
      const maxStart = Math.max(0, items.length - MENU_LIMIT);
      const windowStart = Math.max(
        0,
        Math.min(selectedIndex - Math.floor(MENU_LIMIT / 2), maxStart),
      );
      return (
        <Box marginBottom={1} flexDirection="column">
          <Text color="yellow">{label}</Text>
          {pipe(
            items,
            Arr.drop(windowStart),
            Arr.take(MENU_LIMIT),
            Arr.map((item, index) => (
              <Text
                key={item.label}
                color={selectColor(windowStart + index === selectedIndex)}
              >
                {selectMarker(windowStart + index === selectedIndex)}
                {item.label}
              </Text>
            )),
          )}
          {Match.value(windowStart + MENU_LIMIT < items.length).pipe(
            Match.when(true, () => (
              <Text bold color="cyan">{"  ↓"}</Text>
            )),
            Match.orElse(() => null),
          )}
        </Box>
      );
    }),
  );

type ControlColor = "cyan" | "magenta" | "yellow";

const Shortcut: React.FC<{
  keyName: string;
  label: string;
}> = ({ keyName, label }) => (
  <Text>
    <Text dimColor>[</Text>
    <Text bold>{keyName}</Text>
    <Text dimColor>]</Text>
    {label}
  </Text>
);

const Control: React.FC<{
  emphasizeStatus?: boolean;
  keyName: string;
  label: string;
  status: string;
  width: number;
}> = ({ emphasizeStatus = false, keyName, label, status, width }) => (
  <Box flexDirection="column" width={width} flexShrink={0}>
    <Shortcut keyName={keyName} label={label} />
    <Text bold={emphasizeStatus} wrap="truncate-end">
      {status}
    </Text>
  </Box>
);

const ControlGroup: React.FC<{
  borderRight: boolean;
  children: React.ReactNode;
  color: ControlColor;
  paddingLeft: number;
  title: string;
  width: number;
}> = ({ borderRight, children, color, paddingLeft, title, width }) => (
  <Box
    flexDirection="column"
    flexShrink={0}
    width={width}
    paddingLeft={paddingLeft}
    paddingRight={1}
    borderStyle="single"
    borderTop={false}
    borderBottom={false}
    borderLeft={false}
    borderRight={borderRight}
    borderRightDimColor
  >
    <Text bold color={color}>
      {title}
    </Text>
    <Box>{children}</Box>
  </Box>
);

const Header: React.FC<{
  sortKey: SortKey | null;
  sortDir: SortDir;
  search: string;
  page: number;
  filteredTotal: number;
  total: number;
  pageSize: number;
  cpoOnly: boolean;
  brandFilter: string | null;
  modelFilter: string | null;
  yearFilter: number | null;
  fuelFilter: string | null;
}> = ({
  sortKey,
  sortDir,
  search,
  page,
  filteredTotal,
  total,
  pageSize,
  cpoOnly,
  brandFilter,
  modelFilter,
  yearFilter,
  fuelFilter,
}) => {
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
  const sortDirection = sortDirectionLabels[sortDir];
  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      <Box>
        <Text>
          <Text bold color="cyan">
            EV Search
          </Text>
          {"  "}
          <Text dimColor>│</Text>
          {"  "}Results:{" "}
          <Text bold>
            {filteredTotal}/{total}
          </Text>
          {"  "}
          <Text dimColor>│</Text>
          {"  "}Page:{" "}
          <Text bold>
            {page + 1}/{totalPages}
          </Text>
        </Text>
      </Box>
      <Box flexWrap="wrap" marginTop={1}>
        <ControlGroup
          title="SEARCH"
          color="cyan"
          width={20}
          paddingLeft={0}
          borderRight
        >
          <Control
            keyName="/"
            label="search"
            status={pipe(
              Option.some(search),
              Option.filter((value) => value.length > 0),
              Option.getOrElse(() => " "),
            )}
            width={11}
          />
          <Control keyName="c" label="lear" status=" " width={7} />
        </ControlGroup>
        <ControlGroup
          title="FILTERS"
          color="magenta"
          width={48}
          paddingLeft={1}
          borderRight
        >
          <Control
            keyName="B"
            label="rand"
            status={pipe(
              brandFilter,
              Option.fromNullishOr,
              Option.getOrElse(() => " "),
            )}
            width={9}
          />
          <Control
            keyName="f"
            label="model"
            status={pipe(
              modelFilter,
              Option.fromNullishOr,
              Option.getOrElse(() => " "),
            )}
            width={10}
          />
          <Control
            emphasizeStatus
            keyName="F"
            label="year"
            status={pipe(
              yearFilter,
              Option.fromNullishOr,
              Option.map((value) => `>${value}`),
              Option.getOrElse(() => " "),
            )}
            width={9}
          />
          <Control
            keyName="u"
            label="fuel"
            status={pipe(
              fuelFilter,
              Option.fromNullishOr,
              Option.getOrElse(() => " "),
            )}
            width={9}
          />
          <Control
            emphasizeStatus
            keyName="o"
            label="CPO"
            status={Match.value(cpoOnly).pipe(
              Match.when(true, () => "on"),
              Match.orElse(() => " "),
            )}
            width={8}
          />
        </ControlGroup>
        <ControlGroup
          title="SORT"
          color="yellow"
          width={41}
          paddingLeft={1}
          borderRight
        >
          <Control
            emphasizeStatus
            keyName="p"
            label="rice"
            status={Match.value(sortKey).pipe(
              Match.when("price", () => sortDirection),
              Match.orElse(() => " "),
            )}
            width={9}
          />
          <Control
            emphasizeStatus
            keyName="m"
            label="iles"
            status={Match.value(sortKey).pipe(
              Match.when("miles", () => sortDirection),
              Match.orElse(() => " "),
            )}
            width={9}
          />
          <Control
            emphasizeStatus
            keyName="y"
            label="ear"
            status={Match.value(sortKey).pipe(
              Match.when("year", () => sortDirection),
              Match.orElse(() => " "),
            )}
            width={9}
          />
          <Control
            emphasizeStatus
            keyName="l"
            label="isted"
            status={Match.value(sortKey).pipe(
              Match.when("listed", () => sortDirection),
              Match.orElse(() => " "),
            )}
            width={11}
          />
        </ControlGroup>
        <ControlGroup
          title="NAV"
          color="cyan"
          width={29}
          paddingLeft={1}
          borderRight={false}
        >
          <Control
            keyName="b/n"
            label="page"
            status={`${page + 1}/${totalPages}`}
            width={11}
          />
          <Control keyName="x" label="reset" status=" " width={10} />
          <Control keyName="q" label="uit" status=" " width={6} />
        </ControlGroup>
      </Box>
    </Box>
  );
};

const ListingRow: React.FC<{ listing: AutoDevListing }> = ({ listing }) => {
  const cpoLabel = cpoValueLabels[Number(listing.retailListing.cpo)];
  const locationText = `${listing.retailListing.city}, ${listing.retailListing.state}`;
  const vin = listing.vin;
  return (
    <Box>
      <Box width={6}>
        <Text>{listing.vehicle.year}</Text>
      </Box>
      <Box width={14}>
        <Text>{truncate(listing.vehicle.make, 14)}</Text>
      </Box>
      <Box width={12}>
        <Text>{truncate(String(listing.vehicle.model), 12)}</Text>
      </Box>
      <Box width={14}>
        <Text>{truncate(String(listing.vehicle.trim ?? ""), 14)}</Text>
      </Box>
      <Box width={8}>
        <Text>{truncate(listing.vehicle.exteriorColor ?? "", 8)}</Text>
      </Box>
      <Box width={8}>
        <Text>{listing.retailListing.miles ?? "?"}</Text>
      </Box>
      <Box width={4}>
        <Text>{listing.history?.accidentCount ?? "?"}</Text>
      </Box>
      <Box width={4}>
        <Text>{listing.history?.ownerCount ?? "?"}</Text>
      </Box>
      <Box width={6}>
        <Text>{cpoLabel}</Text>
      </Box>
      <Box width={10}>
        <Text color="green">${listing.retailListing.price}</Text>
      </Box>
      <Box width={20}>
        <Text>{truncate(locationText, 20)}</Text>
      </Box>
      <Box width={24}>
        <Text>{truncate(listing.retailListing.dealer ?? "", 24)}</Text>
      </Box>
      <Box width={14}>
        <Text dimColor>
          {formatDistanceToNowStrict(listing.createdAt, { addSuffix: true })}
        </Text>
      </Box>
      <Box width={22}>
        <Text>{truncate(vin, 22)}</Text>
      </Box>
      <Box width={24}>
        <Text>
          {link(listing.retailListing.carfaxUrl, "carfax")}{" "}
          {link(listing.retailListing.primaryImage, "image")}{" "}
          {link(googleVinLink(vin), "vin")}
        </Text>
      </Box>
    </Box>
  );
};

const TableHeader: React.FC = () => (
  <Box marginBottom={1}>
    <Box width={6}>
      <Text bold>Year</Text>
    </Box>
    <Box width={14}>
      <Text bold>Make</Text>
    </Box>
    <Box width={12}>
      <Text bold>Model</Text>
    </Box>
    <Box width={14}>
      <Text bold>Trim</Text>
    </Box>
    <Box width={8}>
      <Text bold>Color</Text>
    </Box>
    <Box width={8}>
      <Text bold>Miles</Text>
    </Box>
    <Box width={4}>
      <Text bold>Acc</Text>
    </Box>
    <Box width={4}>
      <Text bold>Own</Text>
    </Box>
    <Box width={6}>
      <Text bold>CPO</Text>
    </Box>
    <Box width={10}>
      <Text bold>Price</Text>
    </Box>
    <Box width={20}>
      <Text bold>Location</Text>
    </Box>
    <Box width={24}>
      <Text bold>Dealer</Text>
    </Box>
    <Box width={14}>
      <Text bold>Listed</Text>
    </Box>
    <Box width={18}>
      <Text bold>VIN</Text>
    </Box>
    <Box width={24}>
      <Text bold>Links</Text>
    </Box>
  </Box>
);

export const App: React.FC = () => {
  const { exit } = useApp();
  const header = useAtomValue(headerAtom);
  const visible = useAtomValue(visibleAtom);
  const modelItems = useAtomValue(modelItemsAtom);
  const fuelItems = useAtomValue(fuelItemsAtom);
  const yearItems = useAtomValue(yearItemsAtom);
  const view = useAtomValue(viewStateAtom);
  const searchMode = view.searchMode;
  const searchInput = view.searchInput;
  const brandSelectMode = view.brandSelectMode;
  const modelSelectMode = view.modelSelectMode;
  const yearSelectMode = view.yearSelectMode;
  const fuelSelectMode = view.fuelSelectMode;
  const hasOverlay =
    brandSelectMode ||
    modelSelectMode ||
    yearSelectMode ||
    fuelSelectMode ||
    searchMode;
  const loading = useAtomValue(loadingAtom);
  const loadFailed = useAtomValue(loadFailedAtom);
  const loadedCount = useAtomValue(loadedCountAtom);
  const loadingStatus = useAtomValue(loadingStatusAtom);
  const brandItems = useAtomValue(brandItemsAtom);
  const commands = useAppAtomCommands();
  const selectedIndex = view.selectedIndex;

  const applyBrandSelection = () =>
    Option.match(Option.fromNullishOr(brandItems[selectedIndex]), {
      onNone: () => undefined,
      onSome: (selected) => commands.applyBrandFilter(selected.value),
    });
  const applyModelSelection = () =>
    Option.match(Option.fromNullishOr(modelItems[selectedIndex]), {
      onNone: () => undefined,
      onSome: (selected) => commands.applyModelFilter(selected.value),
    });
  const applyYearSelection = () =>
    Option.match(Option.fromNullishOr(yearItems[selectedIndex]), {
      onNone: () => undefined,
      onSome: (selected) => commands.applyYearFilter(selected.value),
    });
  const applyFuelSelection = () =>
    Option.match(Option.fromNullishOr(fuelItems[selectedIndex]), {
      onNone: () => undefined,
      onSome: (selected) => commands.applyFuelFilter(selected.value),
    });

  const clearAllFilters = () => {
    commands.clearBrandFilter();
    commands.clearModelFilter();
    commands.clearYearFilter();
    commands.clearFuelFilter();
  };

  const handleAppInput = createAppInputHandler(
    {
      searchMode,
      brandSelectMode,
      modelSelectMode,
      yearSelectMode,
      fuelSelectMode,
    },
    {
      exit,
      clearAllFilters,
      closeBrandSelect: commands.closeBrandSelect,
      closeModelSelect: commands.closeModelSelect,
      closeYearSelect: commands.closeYearSelect,
      closeFuelSelect: commands.closeFuelSelect,
      openModelSelect: commands.openModelSelect,
      openBrandSelect: commands.openBrandSelect,
      openYearSelect: commands.openYearSelect,
      openFuelSelect: commands.openFuelSelect,
      applyBrandSelection,
      applyModelSelection,
      applyYearSelection,
      applyFuelSelection,
      moveSelectPrevious: commands.moveSelectPrevious,
      moveSelectNext: commands.moveSelectNext,
      cycleSort: commands.cycleSort,
      nextPage: commands.nextPage,
      prevPage: commands.prevPage,
      toggleCpo: commands.toggleCpo,
      clearSearch: commands.clearSearch,
      startSearch: commands.startSearch,
      cancelSearch: commands.cancelSearch,
      commitSearch: commands.commitSearch,
      appendSelectChar: commands.appendSelectChar,
      appendSearchChar: commands.appendSearchChar,
      deleteSelectChar: commands.deleteSelectChar,
      deleteSearchChar: commands.deleteSearchChar,
    },
  );

  useInput((input, key) => {
    handleAppInput(input, key);
  });

  return (
    <Box flexDirection="column">
      {Match.value({ loadFailed, loading }).pipe(
        Match.when({ loading: true }, () => (
          <Box marginBottom={1}>
            <Text color="green">
              <Spinner type="dots" />
            </Text>
            <Box width={40}>
              <Text color="yellow"> {loadingStatus}</Text>
            </Box>
            <Box width={15}>
              <Text color="cyan">{String(loadedCount).padStart(5)} loaded</Text>
            </Box>
          </Box>
        )),
        Match.when({ loadFailed: true }, () => (
          <Box marginBottom={1}>
            <Text color="red">Load failed: {loadingStatus}</Text>
          </Box>
        )),
        Match.orElse(() => null),
      )}
      <Header
        sortKey={header.sortKey}
        sortDir={header.sortDir}
        search={header.search}
        page={header.page}
        filteredTotal={header.filteredTotal}
        total={header.total}
        pageSize={header.pageSize}
        cpoOnly={header.cpoOnly}
        brandFilter={header.brandFilter}
        modelFilter={header.modelFilter}
        yearFilter={view.yearFilter}
        fuelFilter={header.fuelFilter}
      />
      {brandSelectMode && (
        <SelectMenu
          items={brandItems}
          label={`Select brand: ${view.selectInput}█  (Enter to apply, Esc or [B] to dismiss)`}
          selectedIndex={selectedIndex}
        />
      )}
      {modelSelectMode && (
        <SelectMenu
          items={modelItems}
          label={`Select model: ${view.selectInput}█  (Enter to apply, Esc or [f] to dismiss)`}
          selectedIndex={selectedIndex}
        />
      )}
      {yearSelectMode && (
        <SelectMenu
          items={yearItems}
          label={`Select minimum year: ${view.selectInput}█  (Enter to apply, Esc or [F] to dismiss)`}
          selectedIndex={selectedIndex}
        />
      )}
      {fuelSelectMode && (
        <SelectMenu
          items={fuelItems}
          label={`Select fuel: ${view.selectInput}█  (Enter to apply, Esc or [u] to dismiss)`}
          selectedIndex={selectedIndex}
        />
      )}
      {searchMode && (
        <Box marginBottom={1}>
          <Text color="yellow">Search: {searchInput}█</Text>
        </Box>
      )}
      {!hasOverlay && (
        <>
          <TableHeader />
          {pipe(
            visible,
            Arr.map((listing) => (
              <ListingRow key={listing.vin} listing={listing} />
            )),
          )}
          {Match.value({ loadFailed, visibleCount: visible.length }).pipe(
            Match.when({ loadFailed: true }, () => null),
            Match.when({ visibleCount: 0 }, () => (
              <Text dimColor>No results</Text>
            )),
            Match.orElse(() => null),
          )}
        </>
      )}
    </Box>
  );
};

export const renderApp = (registry: AtomRegistry.AtomRegistry) =>
  Effect.acquireUseRelease(
    Effect.sync(() =>
      process.stdout.write("\u001b[?1049h\u001b[2J\u001b[H"),
    ).pipe(
      Effect.andThen(
        Effect.sync(() =>
          render(
            <RegistryContext.Provider value={registry}>
              <App />
            </RegistryContext.Provider>,
            { exitOnCtrlC: true },
          ),
        ),
      ),
    ),
    (app) => Effect.promise(() => app.waitUntilExit()),
    () => Effect.sync(() => process.stdout.write("\u001b[?1049l")),
  );
