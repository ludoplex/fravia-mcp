/**
 * Fravia Multi-Engine Search
 * Loads engine configurations from engines.txt and provides search execution
 */

import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface EngineConfig {
  id: string;
  type: "api" | "browser";
  name: string;
  baseUrl: string;
  selectors: {
    result: string;
    title: string;
    url: string;
    snippet: string;
  };
}

export interface SearchResult {
  engine: string;
  title: string;
  url: string;
  snippet: string;
}

export interface SearchRequest {
  engine: string;
  query: string;
  maxResults?: number;
}

export interface BrowserSearchInstruction {
  engine: string;
  navigateUrl: string;
  waitTime: number;
  selectors: EngineConfig["selectors"];
  instructions: string[];
}

let engineCache: Map<string, EngineConfig> | null = null;

/**
 * Load engine configurations from engines.txt
 */
export async function loadEngines(): Promise<Map<string, EngineConfig>> {
  if (engineCache) return engineCache;

  const configPath = join(__dirname, "..", "engines.txt");
  let content: string;

  try {
    content = await readFile(configPath, "utf-8");
  } catch {
    console.error("engines.txt not found, using defaults");
    return getDefaultEngines();
  }

  const engines = new Map<string, EngineConfig>();
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const parts = trimmed.split("|");
    if (parts.length < 8) continue;

    const [id, type, name, baseUrl, resultSel, titleSel, urlSel, snippetSel] = parts;

    engines.set(id, {
      id,
      type: type as "api" | "browser",
      name,
      baseUrl,
      selectors: {
        result: resultSel,
        title: titleSel,
        url: urlSel,
        snippet: snippetSel,
      },
    });
  }

  engineCache = engines;
  return engines;
}

function getDefaultEngines(): Map<string, EngineConfig> {
  return new Map([
    ["google", {
      id: "google",
      type: "api",
      name: "Google Custom Search",
      baseUrl: "https://www.googleapis.com/customsearch/v1",
      selectors: { result: "items", title: "title", url: "link", snippet: "snippet" },
    }],
    ["bing", {
      id: "bing",
      type: "api",
      name: "Bing Search",
      baseUrl: "https://api.bing.microsoft.com/v7.0/search",
      selectors: { result: "webPages.value", title: "name", url: "url", snippet: "snippet" },
    }],
    ["searx", {
      id: "searx",
      type: "browser",
      name: "Searx",
      baseUrl: "https://searx.be/search?q=",
      selectors: { result: ".result", title: ".result h3 a", url: ".result .url", snippet: ".result .content" },
    }],
  ]);
}

/**
 * Get list of available engines
 */
export async function getAvailableEngines(): Promise<{ id: string; name: string; type: string }[]> {
  const engines = await loadEngines();
  return Array.from(engines.values()).map((e) => ({
    id: e.id,
    name: e.name,
    type: e.type,
  }));
}

/**
 * Build search URL for an engine
 */
export function buildSearchUrl(engine: EngineConfig, query: string): string {
  const encodedQuery = encodeURIComponent(query);

  if (engine.type === "browser") {
    return `${engine.baseUrl}${encodedQuery}`;
  }

  // API engines need different handling
  switch (engine.id) {
    case "google":
      return `${engine.baseUrl}?q=${encodedQuery}`;
    case "bing":
      return `${engine.baseUrl}?q=${encodedQuery}`;
    case "brave":
      return `${engine.baseUrl}?q=${encodedQuery}`;
    case "github":
      return `${engine.baseUrl}?q=${encodedQuery}`;
    case "gitlab":
      return `${engine.baseUrl}?search=${encodedQuery}`;
    case "archive":
      return `https://web.archive.org/cdx/search/cdx?url=*${encodedQuery}*&output=json&limit=10`;
    default:
      return `${engine.baseUrl}${encodedQuery}`;
  }
}

/**
 * Generate browser automation instructions for a search
 * Returns instructions that can be executed via MCP browser tools
 */
export async function generateBrowserInstructions(
  requests: SearchRequest[]
): Promise<BrowserSearchInstruction[]> {
  const engines = await loadEngines();
  const instructions: BrowserSearchInstruction[] = [];

  for (const req of requests) {
    const engine = engines.get(req.engine);
    if (!engine) continue;

    if (engine.type !== "browser") continue;

    const url = buildSearchUrl(engine, req.query);

    instructions.push({
      engine: engine.id,
      navigateUrl: url,
      waitTime: 3,
      selectors: engine.selectors,
      instructions: [
        `1. browser_navigate(url="${url}")`,
        `2. browser_wait_for(time=3)`,
        `3. browser_snapshot()`,
        `4. Extract results using selectors:`,
        `   - Results container: ${engine.selectors.result}`,
        `   - Title: ${engine.selectors.title}`,
        `   - URL: ${engine.selectors.url}`,
        `   - Snippet: ${engine.selectors.snippet}`,
      ],
    });
  }

  return instructions;
}

/**
 * Generate API call instructions for a search
 * Returns curl commands or fetch instructions
 */
export async function generateApiInstructions(
  requests: SearchRequest[]
): Promise<{ engine: string; method: string; url: string; headers: Record<string, string>; notes: string }[]> {
  const engines = await loadEngines();
  const instructions: { engine: string; method: string; url: string; headers: Record<string, string>; notes: string }[] = [];

  for (const req of requests) {
    const engine = engines.get(req.engine);
    if (!engine) continue;

    if (engine.type !== "api") continue;

    const url = buildSearchUrl(engine, req.query);
    let headers: Record<string, string> = {};
    let notes = "";

    switch (engine.id) {
      case "google":
        notes = "Requires GOOGLE_API_KEY and GOOGLE_CX environment variables";
        break;
      case "bing":
        headers = { "Ocp-Apim-Subscription-Key": "${BING_API_KEY}" };
        notes = "Requires BING_API_KEY environment variable";
        break;
      case "brave":
        headers = { "X-Subscription-Token": "${BRAVE_API_KEY}" };
        notes = "Requires BRAVE_API_KEY environment variable";
        break;
      case "github":
        headers = { Authorization: "token ${GITHUB_TOKEN}", Accept: "application/vnd.github.v3+json" };
        notes = "Optional GITHUB_TOKEN for higher rate limits";
        break;
      case "gitlab":
        headers = { "PRIVATE-TOKEN": "${GITLAB_TOKEN}" };
        notes = "Optional GITLAB_TOKEN for private projects";
        break;
      case "archive":
        notes = "No authentication required";
        break;
    }

    instructions.push({
      engine: engine.id,
      method: "GET",
      url,
      headers,
      notes,
    });
  }

  return instructions;
}

/**
 * Format search execution plan as readable output
 */
export async function formatExecutionPlan(
  requests: SearchRequest[]
): Promise<string> {
  const browserInstructions = await generateBrowserInstructions(requests);
  const apiInstructions = await generateApiInstructions(requests);

  const lines: string[] = ["=== SEARCH EXECUTION PLAN ===", ""];

  if (apiInstructions.length > 0) {
    lines.push("--- API SEARCHES ---");
    for (const api of apiInstructions) {
      lines.push(`[${api.engine}] GET ${api.url}`);
      if (Object.keys(api.headers).length > 0) {
        lines.push(`  Headers: ${JSON.stringify(api.headers)}`);
      }
      if (api.notes) {
        lines.push(`  Note: ${api.notes}`);
      }
      lines.push("");
    }
  }

  if (browserInstructions.length > 0) {
    lines.push("--- BROWSER AUTOMATION SEARCHES ---");
    for (const browser of browserInstructions) {
      lines.push(`[${browser.engine}] Navigate to: ${browser.navigateUrl}`);
      lines.push(`  Wait: ${browser.waitTime}s`);
      lines.push(`  Selectors: ${JSON.stringify(browser.selectors)}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

