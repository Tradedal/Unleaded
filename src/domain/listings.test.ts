import { describe, expect, it } from "vitest";
import { normalizeModelName, resolveModelQuery } from "./modelNormalizer.js";

describe("listing model normalization", () => {
  it("normalizes provider model variants", () => {
    expect(normalizeModelName("Mustang Mach-E")).toBe("Mach-E");
    expect(normalizeModelName("Q4 e-tron")).toBe("Q4");
  });

  it("expands an Ioniq family search", () => {
    expect(resolveModelQuery("IONIQ")).toEqual([
      "Ioniq 5",
      "Ioniq 6",
      "Ioniq 9",
    ]);
  });
});
