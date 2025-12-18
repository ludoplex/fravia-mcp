import { describe, it, expect } from "vitest";
import { getPhaseMenu, PHASES, NOISE_FILTERS } from "../src/phases.js";

describe("PHASES", () => {
  it("should have 8 phases defined", () => {
    expect(PHASES).toHaveLength(8);
  });

  it("should have S1-S8 IDs", () => {
    PHASES.forEach((phase, i) => {
      expect(phase.id).toBe(`S${i + 1}`);
    });
  });
});

describe("NOISE_FILTERS", () => {
  it("should have 7 filters defined", () => {
    expect(NOISE_FILTERS).toHaveLength(7);
  });

  it("should have codes s,f,t,u,c,l,a", () => {
    const codes = NOISE_FILTERS.map((f) => f.code);
    expect(codes).toEqual(["s", "f", "t", "u", "c", "l", "a"]);
  });

  it("should all default to ON", () => {
    NOISE_FILTERS.forEach((f) => {
      expect(f.default).toBe("ON");
    });
  });
});

describe("getPhaseMenu", () => {
  it("should return menu for valid phase", () => {
    const menu = getPhaseMenu(1);
    expect(menu.phase).toBe(1);
    expect(menu.id).toBe("S1");
    expect(menu.name).toBe("Reconnaissance");
  });

  it("should include noise filters", () => {
    const menu = getPhaseMenu(1);
    expect(menu.noiseFilters).toHaveLength(7);
  });

  it("should include building blocks", () => {
    const menu = getPhaseMenu(1);
    expect(menu.buildingBlocks.length).toBeGreaterThan(0);
  });

  it("should include engine nuances with G: prefix", () => {
    const menu = getPhaseMenu(1);
    expect(menu.engineNuances.google).toMatch(/^G:/);
    expect(menu.engineNuances.bing).toMatch(/^G:/);
    expect(menu.engineNuances.yandex).toMatch(/^G:/);
  });

  it("should have precombinations for S1", () => {
    const menu = getPhaseMenu(1);
    expect(menu.precombinations.length).toBeGreaterThan(0);
    expect(menu.precombinations[0].code).toBe("X");
  });

  it("should return minimal menu for invalid phase", () => {
    const menu = getPhaseMenu(99);
    expect(menu.buildingBlocks).toHaveLength(0);
  });
});

