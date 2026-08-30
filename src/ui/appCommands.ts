import { Match, Option } from "effect";
import { useAtomSet } from "@effect/atom-react";
import type { SortKey } from "../domain/sorting.js";
import {
  appendSearchCharAction,
  applyBrandFilterAction,
  applyFuelFilterAction,
  applyModelFilterAction,
  applyYearFilterAction,
  clearFuelFilterAction,
  clearBrandFilterAction,
  clearModelFilterAction,
  clearSearchAction,
  cancelSearchAction,
  clearYearFilterAction,
  closeBrandSelectAction,
  closeModelSelectAction,
  closeFuelSelectAction,
  closeYearSelectAction,
  commitSearchAction,
  deleteSearchCharAction,
  moveSelectNextAction,
  moveSelectPreviousAction,
  nextPageAction,
  openFuelSelectAction,
  openBrandSelectAction,
  openModelSelectAction,
  openYearSelectAction,
  prevPageAction,
  cycleSortAction,
  startSearchAction,
  toggleCpoAction,
} from "./atoms.js";

type AppSelectMode = "none" | "brand" | "model" | "year" | "fuel";
type ActiveSelectMode = Exclude<AppSelectMode, "none">;

const selectToggleKeys: Record<ActiveSelectMode, string> = {
  brand: "B",
  model: "f",
  year: "F",
  fuel: "u",
};

type KeyMeta = {
  input: string;
  key: {
    return?: boolean;
    escape?: boolean;
    upArrow?: boolean;
    downArrow?: boolean;
    backspace?: boolean;
    delete?: boolean;
    ctrl?: boolean;
    meta?: boolean;
  };
};

type AppCommands = {
  exit: () => void;
  clearAllFilters: () => void;
  closeBrandSelect: () => void;
  closeModelSelect: () => void;
  closeFuelSelect: () => void;
  closeYearSelect: () => void;
  openModelSelect: () => void;
  openBrandSelect: () => void;
  openFuelSelect: () => void;
  openYearSelect: () => void;
  applyBrandSelection: () => void;
  applyFuelSelection: () => void;
  applyModelSelection: () => void;
  applyYearSelection: () => void;
  moveSelectPrevious: () => void;
  moveSelectNext: () => void;
  cycleSort: (key: SortKey) => void;
  nextPage: () => void;
  prevPage: () => void;
  toggleCpo: () => void;
  clearSearch: () => void;
  startSearch: () => void;
  cancelSearch: () => void;
  commitSearch: () => void;
  appendSearchChar: (char: string) => void;
  deleteSearchChar: () => void;
};

export type AppAtomCommands = {
  appendSearchChar: (char: string) => void;
  clearSearch: () => void;
  closeBrandSelect: () => void;
  closeModelSelect: () => void;
  closeYearSelect: () => void;
  closeFuelSelect: () => void;
  commitSearch: () => void;
  deleteSearchChar: () => void;
  applyBrandFilter: (value: string | null) => void;
  applyFuelFilter: (value: string | null) => void;
  applyModelFilter: (value: string | null) => void;
  applyYearFilter: (value: number | null) => void;
  moveSelectPrevious: () => void;
  moveSelectNext: () => void;
  nextPage: () => void;
  openBrandSelect: () => void;
  openModelSelect: () => void;
  openYearSelect: () => void;
  openFuelSelect: () => void;
  prevPage: () => void;
  clearBrandFilter: () => void;
  clearModelFilter: () => void;
  clearYearFilter: () => void;
  clearFuelFilter: () => void;
  cancelSearch: () => void;
  startSearch: () => void;
  cycleSort: (key: SortKey) => void;
  toggleCpo: () => void;
};

export const useAppAtomCommands = (): AppAtomCommands => {
  const cycleSort = useAtomSet(cycleSortAction);
  const nextPage = useAtomSet(nextPageAction);
  const prevPage = useAtomSet(prevPageAction);
  const moveSelectPrevious = useAtomSet(moveSelectPreviousAction);
  const moveSelectNext = useAtomSet(moveSelectNextAction);
  const toggleCpo = useAtomSet(toggleCpoAction);
  const clearSearch = useAtomSet(clearSearchAction);
  const startSearch = useAtomSet(startSearchAction);
  const cancelSearch = useAtomSet(cancelSearchAction);
  const commitSearch = useAtomSet(commitSearchAction);
  const appendSearchChar = useAtomSet(appendSearchCharAction);
  const deleteSearchChar = useAtomSet(deleteSearchCharAction);
  const openModelSelect = useAtomSet(openModelSelectAction);
  const closeModelSelect = useAtomSet(closeModelSelectAction);
  const clearModelFilter = useAtomSet(clearModelFilterAction);
  const openBrandSelect = useAtomSet(openBrandSelectAction);
  const closeBrandSelect = useAtomSet(closeBrandSelectAction);
  const clearBrandFilter = useAtomSet(clearBrandFilterAction);
  const openYearSelect = useAtomSet(openYearSelectAction);
  const closeYearSelect = useAtomSet(closeYearSelectAction);
  const clearYearFilter = useAtomSet(clearYearFilterAction);
  const openFuelSelect = useAtomSet(openFuelSelectAction);
  const closeFuelSelect = useAtomSet(closeFuelSelectAction);
  const clearFuelFilter = useAtomSet(clearFuelFilterAction);
  const applyBrandFilter = useAtomSet(applyBrandFilterAction);
  const applyModelFilter = useAtomSet(applyModelFilterAction);
  const applyYearFilter = useAtomSet(applyYearFilterAction);
  const applyFuelFilter = useAtomSet(applyFuelFilterAction);

  return {
    appendSearchChar: (char) => appendSearchChar(char),
    clearSearch: () => clearSearch(undefined),
    startSearch: () => startSearch(undefined),
    cancelSearch: () => cancelSearch(undefined),
    closeBrandSelect: () => closeBrandSelect(undefined),
    closeModelSelect: () => closeModelSelect(undefined),
    closeYearSelect: () => closeYearSelect(undefined),
    closeFuelSelect: () => closeFuelSelect(undefined),
    commitSearch: () => commitSearch(undefined),
    deleteSearchChar: () => deleteSearchChar(undefined),
    nextPage: () => nextPage(undefined),
    moveSelectPrevious: () => moveSelectPrevious(undefined),
    moveSelectNext: () => moveSelectNext(undefined),
    openBrandSelect: () => openBrandSelect(undefined),
    openModelSelect: () => openModelSelect(undefined),
    openYearSelect: () => openYearSelect(undefined),
    openFuelSelect: () => openFuelSelect(undefined),
    prevPage: () => prevPage(undefined),
    applyBrandFilter: (value: string | null) => applyBrandFilter(value),
    applyFuelFilter: (value: string | null) => applyFuelFilter(value),
    applyModelFilter: (value: string | null) => applyModelFilter(value),
    applyYearFilter: (value: number | null) => applyYearFilter(value),
    clearBrandFilter: () => clearBrandFilter(undefined),
    clearModelFilter: () => clearModelFilter(undefined),
    clearYearFilter: () => clearYearFilter(undefined),
    clearFuelFilter: () => clearFuelFilter(undefined),
    cycleSort: (key: SortKey) => cycleSort(key),
    toggleCpo: () => toggleCpo(undefined),
  };
};

type AppModeState = {
  searchMode: boolean;
  brandSelectMode: boolean;
  modelSelectMode: boolean;
  yearSelectMode: boolean;
  fuelSelectMode: boolean;
};

const resolveSelectMode = (state: AppModeState): AppSelectMode =>
  Match.value(state).pipe(
    Match.when({ brandSelectMode: true }, () => "brand" as const),
    Match.when({ modelSelectMode: true }, () => "model" as const),
    Match.when({ yearSelectMode: true }, () => "year" as const),
    Match.when({ fuelSelectMode: true }, () => "fuel" as const),
    Match.orElse(() => "none" as const),
  );

const isCharInputBlocked = (key: KeyMeta["key"]): boolean =>
  !!(key.ctrl || key.meta || key.return);

const appendSearchInput = (
  input: string,
  key: KeyMeta["key"],
  commands: AppCommands,
): void =>
  Match.value(input.length > 0 && !isCharInputBlocked(key)).pipe(
    Match.when(true, () => commands.appendSearchChar(input)),
    Match.orElse(() => undefined),
  );

const handleSearchMode = (
  input: string,
  key: KeyMeta["key"],
  commands: AppCommands,
): void =>
  Match.value({
    return: key.return,
    escape: key.escape,
    backspace: key.backspace,
    delete: key.delete,
  }).pipe(
    Match.when({ return: true }, () => {
      commands.commitSearch();
    }),
    Match.when({ escape: true }, () => {
      commands.cancelSearch();
    }),
    Match.when({ backspace: true }, () => {
      commands.deleteSearchChar();
    }),
    Match.when({ delete: true }, () => {
      commands.deleteSearchChar();
    }),
    Match.orElse(() => appendSearchInput(input, key, commands)),
  );

const handleSelectMode = (
  input: string,
  key: KeyMeta["key"],
  commands: AppCommands,
  selectMode: ActiveSelectMode,
) => {
  const applySelection = Match.value(selectMode).pipe(
    Match.when("brand", () => commands.applyBrandSelection),
    Match.when("model", () => commands.applyModelSelection),
    Match.when("year", () => commands.applyYearSelection),
    Match.when("fuel", () => commands.applyFuelSelection),
    Match.orElse(() => () => undefined),
  );

  const closeSelection = Match.value(selectMode).pipe(
    Match.when("brand", () => commands.closeBrandSelect),
    Match.when("model", () => commands.closeModelSelect),
    Match.when("year", () => commands.closeYearSelect),
    Match.when("fuel", () => commands.closeFuelSelect),
    Match.orElse(() => () => undefined),
  );

  return Match.value({
    input,
    return: key.return,
    escape: key.escape,
    up: key.upArrow,
    down: key.downArrow,
  }).pipe(
    Match.when({ escape: true }, closeSelection),
    Match.when({ return: true }, () => {
      applySelection();
    }),
    Match.whenOr({ up: true }, { input: "k" }, commands.moveSelectPrevious),
    Match.whenOr({ down: true }, { input: "j" }, commands.moveSelectNext),
    Match.when(
      { input: Match.is(selectToggleKeys[selectMode]) },
      closeSelection,
    ),
    Match.orElse(() => {}),
  );
};

const normalCommands = (commands: AppCommands): Record<string, () => void> => ({
  q: commands.exit,
  f: commands.openModelSelect,
  p: () => commands.cycleSort("price"),
  m: () => commands.cycleSort("miles"),
  y: () => commands.cycleSort("year"),
  l: () => commands.cycleSort("listed"),
  "/": commands.startSearch,
  c: commands.clearSearch,
  o: commands.toggleCpo,
  n: commands.nextPage,
  b: commands.prevPage,
  B: commands.openBrandSelect,
  F: commands.openYearSelect,
  u: commands.openFuelSelect,
  x: commands.clearAllFilters,
});

export const createAppInputHandler =
  (state: AppModeState, commands: AppCommands) =>
  (input: string, key: KeyMeta["key"]) =>
    Match.value({
      searchMode: state.searchMode,
      selectMode: resolveSelectMode(state),
    }).pipe(
      Match.when({ searchMode: true }, () =>
        handleSearchMode(input, key, commands),
      ),
      Match.when({ selectMode: "brand" }, () =>
        handleSelectMode(input, key, commands, "brand"),
      ),
      Match.when({ selectMode: "model" }, () =>
        handleSelectMode(input, key, commands, "model"),
      ),
      Match.when({ selectMode: "year" }, () =>
        handleSelectMode(input, key, commands, "year"),
      ),
      Match.when({ selectMode: "fuel" }, () =>
        handleSelectMode(input, key, commands, "fuel"),
      ),
      Match.orElse(() => {
        Option.match(Option.fromNullishOr(normalCommands(commands)[input]), {
          onNone: () => undefined,
          onSome: (command) => command(),
        });
      }),
    );
