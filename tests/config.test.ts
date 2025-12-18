import { describe, it, expect } from "bun:test";
import { getActiveFilters, loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("should load default config when file not found", async () => {
    const config = await loadConfig();
    expect(config.version).toBe("5.0");
    expect(config.filters.size).toBe(7);
  });
});

describe("getActiveFilters", () => {
  it("should return all filters when no relaxation codes", async () => {
    const config = await loadConfig();
    const filters = getActiveFilters("A", config, "google");
    expect(filters).toContain("-site:pinterest");
    expect(filters).toContain("-site:blogspot");
  });

  it("should exclude social filter when s is in codes", async () => {
    const config = await loadConfig();
    const filters = getActiveFilters("s A", config, "google");
    expect(filters).not.toContain("-site:pinterest");
    expect(filters).toContain("-site:blogspot");
  });

  it("should use Bing syntax for bing engine", async () => {
    const config = await loadConfig();
    const filters = getActiveFilters("A", config, "bing");
    expect(filters).toContain("NOT site:");
  });

  it("should use Yandex syntax for yandex engine", async () => {
    const config = await loadConfig();
    const filters = getActiveFilters("A", config, "yandex");
    expect(filters).toContain("-rhost:");
  });

  it("should use DDG syntax for ddg engine", async () => {
    const config = await loadConfig();
    const filters = getActiveFilters("A", config, "ddg");
    expect(filters).toContain("-blogspot");
  });

  it("should default to google for unknown engine", async () => {
    const config = await loadConfig();
    const filters = getActiveFilters("A", config, "unknownengine");
    expect(filters).toContain("-site:pinterest");
  });
});

