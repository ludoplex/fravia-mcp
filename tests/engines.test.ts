import { describe, it, expect } from "bun:test";
import { 
  loadEngines, 
  getAvailableEngines, 
  buildSearchUrl,
  generateBrowserInstructions,
  generateApiInstructions 
} from "../src/engines.js";

describe("loadEngines", () => {
  it("should load engines from config file", async () => {
    const engines = await loadEngines();
    expect(engines.size).toBeGreaterThan(0);
  });

  it("should have google engine", async () => {
    const engines = await loadEngines();
    const google = engines.get("google");
    expect(google).toBeDefined();
    expect(google?.type).toBe("api");
  });

  it("should have searx browser engine", async () => {
    const engines = await loadEngines();
    const searx = engines.get("searx");
    expect(searx).toBeDefined();
    expect(searx?.type).toBe("browser");
  });
});

describe("getAvailableEngines", () => {
  it("should return list of engines", async () => {
    const engines = await getAvailableEngines();
    expect(engines.length).toBeGreaterThan(0);
    expect(engines[0]).toHaveProperty("id");
    expect(engines[0]).toHaveProperty("name");
    expect(engines[0]).toHaveProperty("type");
  });
});

describe("buildSearchUrl", () => {
  it("should build browser engine URL", async () => {
    const engines = await loadEngines();
    const searx = engines.get("searx");
    if (searx) {
      const url = buildSearchUrl(searx, "test query");
      expect(url).toContain("searx");
      expect(url).toContain("test%20query");
    }
  });

  it("should build API engine URL", async () => {
    const engines = await loadEngines();
    const github = engines.get("github");
    if (github) {
      const url = buildSearchUrl(github, "typescript");
      expect(url).toContain("github");
      expect(url).toContain("typescript");
    }
  });
});

describe("generateBrowserInstructions", () => {
  it("should generate instructions for browser engines", async () => {
    const instructions = await generateBrowserInstructions([
      { engine: "searx", query: "test" },
      { engine: "yandex", query: "test" },
    ]);

    expect(instructions.length).toBe(2);
    expect(instructions[0].engine).toBe("searx");
    expect(instructions[0].instructions.length).toBeGreaterThan(0);
    expect(instructions[0].selectors).toBeDefined();
  });

  it("should skip non-browser engines", async () => {
    const instructions = await generateBrowserInstructions([
      { engine: "google", query: "test" }, // API engine
    ]);

    expect(instructions.length).toBe(0);
  });
});

describe("generateApiInstructions", () => {
  it("should generate instructions for API engines", async () => {
    const instructions = await generateApiInstructions([
      { engine: "google", query: "test" },
      { engine: "github", query: "test" },
    ]);

    expect(instructions.length).toBe(2);
    expect(instructions[0].engine).toBe("google");
    expect(instructions[0].method).toBe("GET");
  });

  it("should skip browser engines", async () => {
    const instructions = await generateApiInstructions([
      { engine: "searx", query: "test" }, // Browser engine
    ]);

    expect(instructions.length).toBe(0);
  });
});

