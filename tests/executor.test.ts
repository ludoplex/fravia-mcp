import { describe, it, expect } from "vitest";
import { buildQueries } from "../src/executor.js";
import { loadConfig } from "../src/config.js";

describe("buildQueries", () => {
  it("should build queries for phase 1 block A", async () => {
    const config = await loadConfig();
    const queries = buildQueries(1, ["test topic"], "A", config);

    expect(queries.length).toBeGreaterThan(0);
    expect(queries[0].phase).toBe(1);
    expect(queries[0].blockCode).toBe("A");
  });

  it("should substitute topic placeholders", async () => {
    const config = await loadConfig();
    const queries = buildQueries(1, ["neural networks", "deep learning"], "A", config);

    const googleQuery = queries.find((q) => q.engine === "google");
    expect(googleQuery?.query).toContain("neural networks");
  });

  it("should expand precombinations", async () => {
    const config = await loadConfig();
    const queries = buildQueries(1, ["test"], "X", config);

    // X expands to A+B
    const blockCodes = [...new Set(queries.map((q) => q.blockCode))];
    expect(blockCodes).toContain("A");
    expect(blockCodes).toContain("B");
  });

  it("should apply engine-specific hygiene", async () => {
    const config = await loadConfig();
    const queries = buildQueries(1, ["test"], "A", config);

    const googleQuery = queries.find((q) => q.engine === "google");
    const bingQuery = queries.find((q) => q.engine === "bing");

    expect(googleQuery?.query).toContain("-site:");
    expect(bingQuery?.query).toContain("NOT site:");
  });

  it("should deduplicate identical queries", async () => {
    const config = await loadConfig();
    const queries = buildQueries(1, ["test", "test"], "A", config);

    const uniqueQueries = new Set(queries.map((q) => `${q.engine}:${q.query}`));
    expect(queries.length).toBe(uniqueQueries.size);
  });
});

