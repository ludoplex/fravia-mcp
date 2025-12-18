/**
 * Fravia Query Builder and Executor
 * Builds queries from codes and executes against search engines
 */

import { FraviaConfig, getActiveFilters } from "./config.js";
import { getPhaseMenu } from "./phases.js";

export interface Query {
  engine: string;
  query: string;
  phase: number;
  blockCode: string;
}

export interface QueryResult {
  engine: string;
  query: string;
  title: string;
  url: string;
  snippet: string;
  timestamp: string;
}

/**
 * Build queries from phase, topics, and codes
 */
export function buildQueries(
  phase: number,
  topics: string[],
  codes: string,
  config: FraviaConfig
): Query[] {
  const queries: Query[] = [];
  const menu = getPhaseMenu(phase);

  // Parse codes - separate uppercase (blocks) from lowercase (filters)
  const blockCodes = codes.replace(/[^A-Z]/g, "").split("");

  // Expand precombinations
  const expandedCodes = new Set<string>();
  for (const code of blockCodes) {
    // Check if it's a precombination
    const precombo = menu.precombinations.find(p => p.code === code);
    if (precombo) {
      precombo.expandsTo.forEach(c => expandedCodes.add(c));
    } else {
      expandedCodes.add(code);
    }
  }

  // Build queries for each expanded code
  for (const code of expandedCodes) {
    const block = menu.buildingBlocks.find(b => b.code === code);
    if (!block) continue;

    // For each engine in the block
    for (const [engine, templates] of Object.entries(block.engines)) {
      // Get engine-specific hygiene string (GD/BD/YD/DD patterns)
      const hygieneString = getActiveFilters(codes, config, engine);

      // For each template
      for (const template of templates) {
        // For each topic, substitute <0>, <1>, etc.
        for (let i = 0; i < topics.length; i++) {
          let query = template;
          
          // Replace all topic placeholders
          topics.forEach((topic, j) => {
            query = query.replace(new RegExp(`<${j}>`, "g"), topic);
          });

          // If template still has unreplaced placeholders, use primary topic
          query = query.replace(/<\d+>/g, topics[0]);

          // Append engine-specific hygiene string
          if (hygieneString) {
            query = `${query} ${hygieneString}`;
          }

          queries.push({
            engine,
            query,
            phase,
            blockCode: code,
          });
        }
      }
    }
  }

  // Deduplicate queries
  const seen = new Set<string>();
  return queries.filter(q => {
    const key = `${q.engine}:${q.query}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Execute queries and return execution plan
 * Uses engines module to generate browser/API instructions
 */
export async function executeQueries(queries: Query[]): Promise<QueryResult[]> {
  const { loadEngines, buildSearchUrl, generateBrowserInstructions, generateApiInstructions } = await import("./engines.js");
  const engines = await loadEngines();
  const results: QueryResult[] = [];

  // Group queries by engine type
  const browserQueries: Query[] = [];
  const apiQueries: Query[] = [];

  for (const q of queries) {
    const engine = engines.get(q.engine);
    if (!engine) {
      // Unknown engine - treat as browser-based
      browserQueries.push(q);
    } else if (engine.type === "browser") {
      browserQueries.push(q);
    } else {
      apiQueries.push(q);
    }
  }

  // Generate browser automation instructions
  if (browserQueries.length > 0) {
    const browserInstructions = await generateBrowserInstructions(
      browserQueries.map(q => ({ engine: q.engine, query: q.query }))
    );
    
    for (const inst of browserInstructions) {
      results.push({
        engine: inst.engine,
        query: inst.navigateUrl,
        title: `[BROWSER] ${inst.engine}`,
        url: inst.navigateUrl,
        snippet: inst.instructions.join("\n"),
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Generate API instructions
  if (apiQueries.length > 0) {
    const apiInstructions = await generateApiInstructions(
      apiQueries.map(q => ({ engine: q.engine, query: q.query }))
    );
    
    for (const inst of apiInstructions) {
      results.push({
        engine: inst.engine,
        query: inst.url,
        title: `[API] ${inst.engine}`,
        url: inst.url,
        snippet: `Method: ${inst.method}\nHeaders: ${JSON.stringify(inst.headers)}\n${inst.notes}`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Fallback for queries without engine config
  for (const q of queries) {
    const hasResult = results.some(r => r.engine === q.engine);
    if (!hasResult) {
      results.push({
        engine: q.engine,
        query: q.query,
        title: `[${q.engine.toUpperCase()}] Query prepared`,
        url: getSearchUrl(q.engine, q.query),
        snippet: `Execute manually: ${q.query}`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return results;
}

/**
 * Generate direct search URL for manual execution
 */
function getSearchUrl(engine: string, query: string): string {
  const encoded = encodeURIComponent(query);
  
  switch (engine.toLowerCase()) {
    case "google":
      return `https://www.google.com/search?q=${encoded}`;
    case "bing":
      return `https://www.bing.com/search?q=${encoded}`;
    case "yandex":
      return `https://yandex.com/search/?text=${encoded}`;
    case "duckduckgo":
    case "ddg":
      return `https://duckduckgo.com/?q=${encoded}`;
    case "brave":
      return `https://search.brave.com/search?q=${encoded}`;
    case "baidu":
      return `https://www.baidu.com/s?wd=${encoded}`;
    case "github":
      return `https://github.com/search?q=${encoded}`;
    case "scholar":
      return `https://scholar.google.com/scholar?q=${encoded}`;
    case "archive":
    case "wayback":
      return `https://web.archive.org/web/*/${encoded}`;
    default:
      return `https://www.google.com/search?q=${encoded}`;
  }
}

/**
 * Parse search API responses (stub for future implementation)
 */
export function parseSearchResponse(
  engine: string,
  response: unknown
): QueryResult[] {
  // This would parse actual API responses
  // Implementation depends on which APIs are used
  return [];
}

