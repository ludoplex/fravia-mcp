/**
 * Fravia MCP Configuration Loader
 * Loads fravia_menu.conf and parses phase-specific options
 */

import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface FilterConfig {
  code: string;
  name: string;
  google: string;
  bing: string;
  yandex: string;
  ddg: string;
}

export interface OptionConfig {
  code: string;
  description: string;
  value: string;
}

export interface PhaseConfig {
  description: string;
  nuance: string;
  options: Map<string, OptionConfig>;
}

export interface FraviaConfig {
  version: string;
  filters: Map<string, FilterConfig>;
  phases: Map<string, PhaseConfig>;
}

/**
 * Parse INI-style configuration file
 */
export async function loadConfig(): Promise<FraviaConfig> {
  const configPath = join(__dirname, "..", "..", "fravia_menu.conf");
  
  let content: string;
  try {
    content = await readFile(configPath, "utf-8");
  } catch {
    // Return default config if file not found
    return getDefaultConfig();
  }

  return parseConfig(content);
}

function parseConfig(content: string): FraviaConfig {
  const config: FraviaConfig = {
    version: "5.0",
    filters: new Map(),
    phases: new Map(),
  };

  let currentSection = "";
  let currentPhase: PhaseConfig | null = null;

  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Section header
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      currentSection = trimmed.slice(1, -1);

      if (currentSection.startsWith("S") && /^S\d+$/.test(currentSection)) {
        currentPhase = {
          description: "",
          nuance: "",
          options: new Map(),
        };
        config.phases.set(currentSection, currentPhase);
      } else {
        currentPhase = null;
      }
      continue;
    }

    // Key-value pairs
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();

    if (currentSection === "meta") {
      if (key === "version") config.version = value;
    } else if (currentSection === "filters") {
      // Format: 1_SOCIAL=-site:pinterest.* ...
      // Config file uses Google-style syntax; we apply to all engines
      const parts = key.split("_");
      if (parts.length >= 2) {
        const code = parts[0];
        const name = parts.slice(1).join("_");
        config.filters.set(code, { 
          code, 
          name, 
          google: value,
          bing: value.replace(/-site:/g, "NOT site:").replace(/-inurl:/g, "NOT url:").replace(/-intitle:/g, "NOT intitle:").replace(/-"/g, "NOT \""),
          yandex: value,
          ddg: value.replace(/-site:/g, "-site:").replace(/-inurl:/g, "-inurl:")
        });
      }
    } else if (currentPhase) {
      if (key === "desc") {
        currentPhase.description = value;
      } else if (key === "nuance") {
        currentPhase.nuance = value;
      } else if (key.startsWith("option_") && key.endsWith("_desc")) {
        const optCode = key.slice(7, -5); // Extract letter from option_X_desc
        const existing = currentPhase.options.get(optCode) || {
          code: optCode,
          description: "",
          value: "",
        };
        existing.description = value;
        currentPhase.options.set(optCode, existing);
      } else if (key.startsWith("option_") && key.endsWith("_val")) {
        const optCode = key.slice(7, -4); // Extract letter from option_X_val
        const existing = currentPhase.options.get(optCode) || {
          code: optCode,
          description: "",
          value: "",
        };
        existing.value = value;
        currentPhase.options.set(optCode, existing);
      }
    }
  }

  return config;
}

function getDefaultConfig(): FraviaConfig {
  return {
    version: "5.0",
    filters: new Map([
      // GD/BD/YD/DD engine-specific noise exclusion patterns
      ["1", { 
        code: "s", name: "SOCIAL",
        google: "-site:pinterest.* -site:twitter.com -site:facebook.com -site:reddit.com -site:quora.com",
        bing: "NOT site:pinterest.com NOT site:twitter.com NOT site:facebook.com NOT site:reddit.com",
        yandex: "-site:pinterest.com -site:twitter.com -site:facebook.com -site:reddit.com",
        ddg: "-site:pinterest.com -site:twitter.com -site:facebook.com -site:reddit.com"
      }],
      ["2", { 
        code: "f", name: "FREE_HOSTING",
        google: "-site:blogspot.* -site:*.wixsite.com -site:weebly.com -site:tumblr.com -site:*.wordpress.com -site:sites.google.com",
        bing: "NOT site:blogspot.com NOT url:wixsite NOT url:weebly NOT site:tumblr.com",
        yandex: "-rhost:com.blogspot.* -rhost:com.wixsite.* -rhost:com.weebly.* -site:tumblr.com",
        ddg: "-blogspot -wixsite -weebly -tumblr"
      }],
      ["3", { 
        code: "t", name: "SPAM_TLDS",
        google: "-site:.info -site:.xyz -site:.top -site:.click -site:.online -site:.site -site:.space -site:.icu -site:.buzz",
        bing: "NOT site:.info NOT site:.xyz NOT site:.top NOT site:.click NOT site:.online",
        yandex: "-domain:info -domain:xyz -domain:top -domain:click -domain:online",
        ddg: "-site:.info -site:.xyz -site:.top -site:.click -site:.online"
      }],
      ["4", { 
        code: "u", name: "STRUCTURAL_CRUFT",
        google: "-inurl:/tag/ -inurl:/category/ -inurl:/page/ -inurl:/archive/ -inurl:?p= -inurl:?page=",
        bing: "NOT url:tag NOT url:category NOT url:page NOT url:archive",
        yandex: "-inurl:/tag/ -inurl:/category/ -inurl:/page/",
        ddg: "-inurl:/tag/ -inurl:/category/ -inurl:/page/"
      }],
      ["5", { 
        code: "c", name: "COMMERCIAL",
        google: "-\"affiliate\" -\"we may earn\" -\"as an amazon associate\" -inurl:affiliate -inurl:sponsored",
        bing: "NOT \"affiliate\" NOT \"we may earn\" NOT inbody:\"taboola\" NOT inbody:\"outbrain\"",
        yandex: "-\"affiliate\" -\"we may earn\"",
        ddg: "-\"affiliate\" -\"sponsored\" -\"commission\""
      }],
      ["6", { 
        code: "l", name: "LISTICLES",
        google: "-intitle:\"top 10\" -intitle:\"top 20\" -intitle:\"best of\" -intitle:\"ultimate guide\"",
        bing: "NOT intitle:\"top 10\" NOT intitle:\"best of\"",
        yandex: "-title:\"top 10\" -title:\"best of\"",
        ddg: "-\"top 10\" -\"best of\" -\"ultimate guide\""
      }],
      ["7", { 
        code: "a", name: "AI_SLOP",
        google: "-\"in this comprehensive guide\" -\"let's dive in\" -\"without further ado\" -\"in today's fast-paced world\"",
        bing: "NOT \"let's dive in\" NOT \"comprehensive guide\"",
        yandex: "-\"let's dive in\" -\"comprehensive guide\"",
        ddg: "-\"let's dive in\" -\"without further ado\""
      }],
    ]),
    phases: new Map(),
  };
}

/**
 * Get engine-specific filter exclusion string based on which filters are NOT relaxed
 */
export function getActiveFilters(codes: string, config: FraviaConfig, engine: string = "google"): string {
  const relaxedCodes = new Set<string>();
  
  // Map lowercase letters to filter numbers
  const codeToNumber: Record<string, string> = {
    "s": "1", "f": "2", "t": "3", "u": "4", "c": "5", "l": "6", "a": "7"
  };

  for (const char of codes.toLowerCase()) {
    if (codeToNumber[char]) {
      relaxedCodes.add(codeToNumber[char]);
    }
  }

  // Normalize engine name
  const engineKey = engine.toLowerCase() as keyof FilterConfig;
  const validEngines = ["google", "bing", "yandex", "ddg"];
  const targetEngine = validEngines.includes(engineKey) ? engineKey : "google";

  // Build exclusion string from non-relaxed filters using engine-specific syntax
  const exclusions: string[] = [];
  for (const [num, filter] of config.filters) {
    if (!relaxedCodes.has(num)) {
      const filterValue = filter[targetEngine as keyof Omit<FilterConfig, "code" | "name">];
      if (filterValue) {
        exclusions.push(filterValue);
      }
    }
  }

  return exclusions.join(" ");
}

