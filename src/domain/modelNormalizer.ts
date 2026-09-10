import {
  Array as Arr,
  Match,
  Option,
  pipe,
  Schema as S,
  SchemaTransformation,
  String as Str,
} from "effect";

// Models to exclude from results
const stopList = new Set([
  "solterra",
  "promaster",
  "hardtop",
  "e-transit",
  "ocean",
  "vf8",
  "smart",
  "fortwo",
]);

type NormalizationRule = {
  pattern: RegExp;
  replace: string | ((value: string) => string);
};

const rules: NormalizationRule[] = [
  // Tesla: "2", "3", "4" => "Model 2", "Model 3", "Model 4"
  { pattern: /^([234])$/i, replace: (value) => `Model ${value}` },

  // Bolt variants => Bolt
  { pattern: /^bolt\s+.+$/i, replace: "Bolt" },

  // Hummer variants => Hummer
  { pattern: /^hummer\s+.+$/i, replace: "Hummer" },

  // Q4/Q8 e-tron variants => Q4/Q8
  {
    pattern: /^(q\d+)\s+.+$/i,
    replace: (value) => value.split(/\s+/, 1)[0].toUpperCase(),
  },

  // SQ6 e-tron => SQ6
  {
    pattern: /^(sq\d+)\s+.+$/i,
    replace: (value) => value.split(/\s+/, 1)[0].toUpperCase(),
  },

  // C40 recharge => C40
  {
    pattern: /^(c\d+)\s+.+$/i,
    replace: (value) => value.split(/\s+/, 1)[0].toUpperCase(),
  },

  // E-tron variants => E-tron
  { pattern: /^e-tron\s+.+$/i, replace: "E-tron" },

  // Id.4 => ID.4
  {
    pattern: /^id\.\d+$/i,
    replace: (value) => pipe(value, Str.replace(/^id\./i, "ID.")),
  },

  // Mustang mach-e => Mach-E
  { pattern: /^mustang\s+mach-e$/i, replace: "Mach-E" },

  // Escalade iq/iql => Escalade
  { pattern: /^escalade\s+.+$/i, replace: "Escalade" },

  // Sierra ev => Sierra
  { pattern: /^sierra\s+.+$/i, replace: "Sierra" },

  // Silverado ev => Silverado
  { pattern: /^silverado\s+.+$/i, replace: "Silverado" },

  // Equinox ev => Equinox
  { pattern: /^equinox\s+.+$/i, replace: "Equinox" },

  // Blazer ev => Blazer
  { pattern: /^blazer\s+.+$/i, replace: "Blazer" },

  // F-150 lightning => F-150
  { pattern: /^f-150\s+.+$/i, replace: "F-150" },

  // Niro ev => Niro
  { pattern: /^niro\s+.+$/i, replace: "Niro" },

  // Lyriq-v => Lyriq
  { pattern: /^lyriq.+$/i, replace: "Lyriq" },

  // Filter garbage (length < 2)
  { pattern: /^.{0,1}$/, replace: "" },

  { pattern: /^Kona.+$/, replace: "Kona" },
];

// Capitalize each word: "IONIQ 6" -> "Ioniq 6", "ARIYA" -> "Ariya"
const capitalizeWords = (s: string): string =>
  pipe(
    s.toLowerCase().split(/\s+/),
    Arr.map((word) => word.charAt(0).toUpperCase() + word.slice(1)),
    Arr.join(" "),
  );

const isRuleTransformer = (
  replace: NormalizationRule["replace"],
): replace is (value: string) => string => typeof replace === "function";

const applyRule = (rule: NormalizationRule, value: string): string =>
  Match.value(rule.replace).pipe(
    Match.when(isRuleTransformer, (replace) => replace(value)),
    Match.orElse((replace) => replace),
  );

const normalizeWithRule = (value: string): string =>
  Option.match(
    Arr.findFirst(rules, (rule) => rule.pattern.test(value)),
    {
      onNone: () => capitalizeWords(value),
      onSome: (rule) => applyRule(rule, value),
    },
  );

export const normalizeModelName = (value: string): string => {
  const trimmed = value.trim();

  return Match.value(stopList.has(trimmed.toLowerCase())).pipe(
    Match.when(true, () => ""),
    Match.orElse(() => normalizeWithRule(trimmed)),
  );
};

const modelQueryFamilies: Record<string, readonly string[]> = {
  Ioniq: ["Ioniq 5", "Ioniq 6", "Ioniq 9"],
};

export const resolveModelQuery = (value: string): readonly string[] => {
  const normalizedValue = normalizeModelName(value);
  return modelQueryFamilies[normalizedValue] ?? [normalizedValue];
};

export const NormalizedModelName = S.Union([S.String, S.Number]).pipe(
  S.decodeTo(
    S.String,
    SchemaTransformation.transform({
      decode: (value) => normalizeModelName(String(value)),
      encode: (value) => value,
    }),
  ),
);
