/**
 * Fravia Search Phases S1-S8
 * Each phase has building blocks, precombinations, and engine nuances
 */

export interface NoiseFilter {
  code: string;
  name: string;
  applies: string;
  default: "ON" | "OFF";
}

export interface BuildingBlock {
  code: string;
  name: string;
  description: string;
  engines: Record<string, string[]>;
}

export interface Precombination {
  code: string;
  name: string;
  expandsTo: string[];
  description: string;
}

export interface Phase {
  id: string;
  name: string;
  purpose: string;
}

export interface PhaseMenu {
  phase: number;
  id: string;
  name: string;
  purpose: string;
  noiseFilters: NoiseFilter[];
  buildingBlocks: BuildingBlock[];
  precombinations: Precombination[];
  engineNuances: Record<string, string>;
}

// Standard noise filters (same across all phases)
export const NOISE_FILTERS: NoiseFilter[] = [
  { code: "s", name: "Social/Forum", applies: "Pinterest, Reddit, Quora, Facebook, Twitter", default: "ON" },
  { code: "f", name: "Free Hosting/Blogs", applies: "Blogspot, Wix, Weebly, Tumblr, WordPress.com", default: "ON" },
  { code: "t", name: "Spam TLDs", applies: ".info, .xyz, .top, .click, .online, .site, .space, .icu, .buzz", default: "ON" },
  { code: "u", name: "Structural Cruft", applies: "/tag/, /category/, /page/, /archive/, ?p=, ?page=", default: "ON" },
  { code: "c", name: "Commercial/Affiliate", applies: "affiliate tracking, 'we may earn', Amazon associate", default: "ON" },
  { code: "l", name: "Clickbait/Listicles", applies: "top 10, best X for Y, ultimate guide", default: "ON" },
  { code: "a", name: "Generic AI Slop", applies: "comprehensive guide, let's dive in, without further ado", default: "ON" },
];

// Phase definitions
export const PHASES: Phase[] = [
  { id: "S1", name: "Reconnaissance", purpose: "Map vocabulary, key actors, obvious authority and garbage" },
  { id: "S2", name: "Surface Scan", purpose: "Clean, high-signal overview of known information" },
  { id: "S3", name: "Deep Documents", purpose: "Extract PDFs, XLS, technical artifacts" },
  { id: "S4", name: "Structural Mapping", purpose: "APIs, subdomains, infrastructure discovery" },
  { id: "S5", name: "Filtered High-Signal", purpose: "Maximum filter strictness, authority sources only" },
  { id: "S6", name: "Negative-Space", purpose: "Failures, contradictions, what's missing" },
  { id: "S7", name: "Temporal Evolution", purpose: "Historical analysis, time-bounded searches" },
  { id: "S8", name: "Language/Regional Lateral", purpose: "Cross-language, regional engine exploration" },
];

// Phase-specific menus
const PHASE_MENUS: Record<number, Omit<PhaseMenu, "phase" | "noiseFilters">> = {
  1: {
    id: "S1",
    name: "Reconnaissance",
    purpose: "Map vocabulary, key actors, obvious authority and obvious garbage around the topic.",
    buildingBlocks: [
      {
        code: "A",
        name: "Broad term+synonym sweep",
        description: "Use topic + all synonyms to discover how the web names this thing.",
        engines: {
          google: ['"<0>" OR "<1>" OR "<2>"'],
          bing: ['"<0>" OR "<1>" OR "<2>"'],
          yandex: ['"<0>" | "<1>" | "<2>"'],
        },
      },
      {
        code: "B",
        name: "Term + context word",
        description: "Pair main subject with generic context (overview, definition) to bias intros.",
        engines: {
          google: ['"<0>" "overview"', '"<0>" "definition"'],
          bing: ['"<0>" "introduction"'],
          yandex: ['"<0>" & "what is"'],
        },
      },
      {
        code: "C",
        name: "Entity co-mention",
        description: "Find entities that appear near your subject to identify linked products/companies.",
        engines: {
          google: ['"<0>" AROUND(8) "cloud"', '"<0>" AROUND(8) "GPU"'],
          bing: ['"<0>" near:8 "server"'],
          yandex: ['"<0>" /5 "technology"'],
        },
      },
    ],
    precombinations: [
      { code: "X", name: "Standard Recon Combo", expandsTo: ["A", "B"], description: "Broad sweep + definition focus" },
      { code: "Y", name: "Infra-tinged Recon", expandsTo: ["A", "C"], description: "Broad sweep + entity co-mentions" },
    ],
    engineNuances: {
      google: "G: Text & entity co-occurrence. AROUND(n) for concept binding. High SEO noise at reconnaissance.",
      bing: "G: Alternate view of same space. May surface smaller or regional sites Google buries.",
      yandex: "G: Early hint of regional (RU/CIS) coverage. Structural TLD distribution.",
    },
  },
  2: {
    id: "S2",
    name: "Surface Scan",
    purpose: "Obtain a clean, higher-signal overview of what is known about the topic.",
    buildingBlocks: [
      {
        code: "A",
        name: "Authority overview (edu/gov/org)",
        description: "Bias towards official or academic overview material.",
        engines: {
          google: ['"<0>" overview OR introduction (site:edu OR site:gov OR site:org)'],
          bing: ['"<0>" (overview OR definition) (site:edu OR site:gov OR site:org)'],
          yandex: ['"<0>" & (overview | introduction) (site:*.edu | site:*.gov)'],
        },
      },
      {
        code: "B",
        name: "Current state / recent developments",
        description: "Emphasize recency to see what has changed lately.",
        engines: {
          google: ['"<0>" "current state" OR "recent developments" after:2023-01-01'],
          bing: ['"<0>" "recent" OR "latest" language:en'],
          yandex: ['"<0>" date:>20230101'],
        },
      },
      {
        code: "C",
        name: "Practice & usage",
        description: "How the topic is used in the field (developer docs, guides).",
        engines: {
          google: ['"<0>" "developer guide" OR "getting started"'],
          bing: ['"<0>" "documentation" (site:docs.* OR site:developer.*)'],
          yandex: ['"<0>" & (documentation | guide) domain:com'],
        },
      },
    ],
    precombinations: [
      { code: "X", name: "Balanced Surface Overview", expandsTo: ["A", "C"], description: "Authority + practical usage" },
      { code: "Y", name: "Recency-Biased Overview", expandsTo: ["A", "B"], description: "Authority + recent focus" },
    ],
    engineNuances: {
      google: "G: Will tend to show polished explainers and official docs first once noise is suppressed.",
      bing: "G: Good for finding Microsoft/industry whitepapers or niche docs that Google buries.",
      yandex: "G: Useful to see whether there is a significant non-English body of overview material.",
    },
  },
  3: {
    id: "S3",
    name: "Deep Documents",
    purpose: "Extract non-HTML artifacts: PDFs, spreadsheets, presentations, data files.",
    buildingBlocks: [
      {
        code: "A",
        name: "PDF Extraction (All Engines)",
        description: "Find PDF documents across all engines.",
        engines: {
          google: ['"<0>" filetype:pdf'],
          bing: ['"<0>" contains:pdf'],
          yandex: ['"<0>" mime:pdf'],
        },
      },
      {
        code: "B",
        name: "Data/Config Files (XLS/JSON)",
        description: "Find spreadsheets, data files, configuration files.",
        engines: {
          google: ['"<0>" (filetype:xls OR filetype:xlsx OR filetype:json)'],
          bing: ['"<0>" contains:xlsx'],
          yandex: ['"<0>" (mime:xls | mime:json)'],
        },
      },
      {
        code: "C",
        name: "Academic PDFs Only",
        description: "PDFs from academic sources.",
        engines: {
          google: ['"<0>" filetype:pdf site:edu'],
          bing: ['"<0>" contains:pdf site:edu'],
          yandex: ['"<0>" mime:pdf site:*.edu'],
        },
      },
      {
        code: "D",
        name: "Presentations",
        description: "PowerPoint and presentation files.",
        engines: {
          google: ['"<0>" (filetype:ppt OR filetype:pptx)'],
          bing: ['"<0>" contains:pptx'],
          yandex: ['"<0>" mime:ppt'],
        },
      },
    ],
    precombinations: [
      { code: "X", name: "Full Document Sweep", expandsTo: ["A", "B", "D"], description: "All document types" },
      { code: "Y", name: "Academic Focus", expandsTo: ["A", "C"], description: "PDFs with academic bias" },
    ],
    engineNuances: {
      google: "G: Text inside PDF searchable. filetype: operator.",
      bing: "G: contains: finds pages hosting files.",
      yandex: "G: mime: for raw file type matching.",
    },
  },
  4: {
    id: "S4",
    name: "Structural Mapping",
    purpose: "Map digital layout: APIs, subdomains, infrastructure.",
    buildingBlocks: [
      {
        code: "A",
        name: "Subdomain Map",
        description: "Discover subdomains of target domain.",
        engines: {
          yandex: ['rhost:com.<0>.*'],
          bing: ['site:<0>'],
          google: ['site:*.<0>'],
        },
      },
      {
        code: "B",
        name: "API/Docs Discovery",
        description: "Find API documentation and developer resources.",
        engines: {
          google: ['site:<0> inurl:api OR inurl:docs'],
          bing: ['site:<0> inurl:api'],
          yandex: ['site:<0> & (api | docs)'],
        },
      },
      {
        code: "C",
        name: "Directory Listings",
        description: "Find exposed directory listings.",
        engines: {
          google: ['intitle:"index of" "<0>"'],
          bing: ['intitle:"index of" "<0>"'],
          yandex: ['title:"index of" "<0>"'],
        },
      },
    ],
    precombinations: [
      { code: "X", name: "Infrastructure Sweep", expandsTo: ["A", "B"], description: "Subdomains + APIs" },
    ],
    engineNuances: {
      bing: "G: ip: finds neighbors on same IP.",
      yandex: "G: rhost: reverse host for subdomain discovery.",
      google: "G: site:*.domain for wildcard subdomain.",
    },
  },
  5: {
    id: "S5",
    name: "Filtered High-Signal",
    purpose: "Maximum filter strictness, authority sources only.",
    buildingBlocks: [
      {
        code: "A",
        name: "Academic Authority Lock",
        description: "Only .edu, .ac.*, research institutions.",
        engines: {
          google: ['"<0>" (site:edu OR site:ac.* OR site:arxiv.org OR site:researchgate.net)'],
          bing: ['"<0>" (site:edu OR site:ac.*)'],
          yandex: ['"<0>" (site:*.edu | site:*.ac.*)'],
        },
      },
      {
        code: "B",
        name: "Government Authority Lock",
        description: "Only .gov, .mil, official government sources.",
        engines: {
          google: ['"<0>" (site:gov OR site:gov.* OR site:mil)'],
          bing: ['"<0>" (site:gov OR site:gov.*)'],
          yandex: ['"<0>" (site:*.gov | site:*.mil)'],
        },
      },
      {
        code: "C",
        name: "Technical Authority Lock",
        description: "GitHub, StackOverflow, official docs.",
        engines: {
          google: ['"<0>" (site:github.com OR site:stackoverflow.com OR site:developer.*)'],
          bing: ['"<0>" (site:github.com OR site:stackoverflow.com)'],
          yandex: ['"<0>" (site:github.com | site:stackoverflow.com)'],
        },
      },
    ],
    precombinations: [
      { code: "X", name: "All Authority", expandsTo: ["A", "B", "C"], description: "Academic + Gov + Tech" },
    ],
    engineNuances: {
      google: "G: Combine with date filters for authoritative recent.",
      bing: "G: prefer: boosts but doesn't exclude.",
      yandex: "G: domain: for TLD-only filtering.",
    },
  },
  6: {
    id: "S6",
    name: "Negative-Space",
    purpose: "Find failures, contradictions, criticism, what is missing.",
    buildingBlocks: [
      {
        code: "A",
        name: "Failure/Problem Search",
        description: "Find discussions of problems, failures, issues.",
        engines: {
          google: ['"<0>" (failed OR failure OR problem OR issue OR bug)'],
          bing: ['"<0>" (problem OR issue OR failure)'],
          yandex: ['"<0>" & (problem | failure | bug)'],
        },
      },
      {
        code: "B",
        name: "Criticism/Controversy",
        description: "Find critical perspectives and controversies.",
        engines: {
          google: ['"<0>" (criticism OR controversy OR debate OR questioned)'],
          bing: ['"<0>" (criticism OR controversy)'],
          yandex: ['"<0>" & (criticism | controversy)'],
        },
      },
      {
        code: "C",
        name: "Exclude Dominant Sources",
        description: "Find obscure sources by excluding major ones.",
        engines: {
          google: ['"<0>" -site:wikipedia.org -site:britannica.com -site:medium.com'],
          bing: ['"<0>" NOT site:wikipedia.org NOT site:medium.com'],
          yandex: ['"<0>" -site:wikipedia.org -site:medium.com'],
        },
      },
    ],
    precombinations: [
      { code: "X", name: "Full Negative Space", expandsTo: ["A", "B", "C"], description: "Problems + Criticism + Obscure" },
    ],
    engineNuances: {
      google: "G: AROUND(n) to find terms near 'problem' or 'failure'.",
      bing: "G: NOT for exclusion, near: for proximity.",
      yandex: "G: - prefix for exclusion.",
    },
  },
  7: {
    id: "S7",
    name: "Temporal Evolution",
    purpose: "Historical analysis, time-bounded searches, evolution of topic.",
    buildingBlocks: [
      {
        code: "A",
        name: "Recent Only (Last Year)",
        description: "Content from the last year only.",
        engines: {
          google: ['"<0>" after:2024-01-01'],
          bing: ['"<0>"'], // Use Bing's freshness filter in UI
          yandex: ['"<0>" date:>20240101'],
        },
      },
      {
        code: "B",
        name: "Historical (Pre-2020)",
        description: "Older content before recent hype cycles.",
        engines: {
          google: ['"<0>" before:2020-01-01'],
          bing: ['"<0>"'], // Use date filter
          yandex: ['"<0>" date:<20200101'],
        },
      },
      {
        code: "C",
        name: "Wayback Machine",
        description: "Search Internet Archive for historical snapshots.",
        engines: {
          archive: ['<0>'],
          google: ['site:web.archive.org "<0>"'],
        },
      },
    ],
    precombinations: [
      { code: "X", name: "Time Contrast", expandsTo: ["A", "B"], description: "Compare recent vs historical" },
    ],
    engineNuances: {
      google: "G: before:/after: for date filtering.",
      bing: "G: Use freshness parameter in API.",
      yandex: "G: date: with comparison operators.",
      archive: "G: CDX API for programmatic access.",
    },
  },
  8: {
    id: "S8",
    name: "Language/Regional Lateral",
    purpose: "Cross-language exploration, regional engines, non-English sources.",
    buildingBlocks: [
      {
        code: "A",
        name: "Russian/CIS Sources",
        description: "Search Russian-language and CIS region sources.",
        engines: {
          yandex: ['"<0>" lang:ru', '"<0>" domain:ru'],
          google: ['"<0>" site:ru'],
        },
      },
      {
        code: "B",
        name: "Chinese Sources",
        description: "Search Chinese-language sources.",
        engines: {
          baidu: ['"<0>"'],
          google: ['"<0>" site:cn'],
        },
      },
      {
        code: "C",
        name: "European Sources",
        description: "Search European language sources.",
        engines: {
          google: ['"<0>" (site:de OR site:fr OR site:es OR site:it)'],
          yandex: ['"<0>" (domain:de | domain:fr | domain:es)'],
        },
      },
      {
        code: "D",
        name: "Academic Cross-Language",
        description: "Academic sources in multiple languages.",
        engines: {
          google: ['"<0>" (site:edu.* OR site:ac.* OR site:uni-*)'],
          scholar: ['"<0>"'],
        },
      },
    ],
    precombinations: [
      { code: "X", name: "Global Sweep", expandsTo: ["A", "B", "C"], description: "All regional sources" },
      { code: "Y", name: "Academic Global", expandsTo: ["A", "D"], description: "Russian + Academic" },
    ],
    engineNuances: {
      yandex: "G: Strongest for Russian/CIS, lang: and domain: operators.",
      baidu: "G: Required for Chinese sources, different operator syntax.",
      google: "G: site:TLD for regional filtering.",
      scholar: "G: Cross-language academic search.",
    },
  },
};

/**
 * Get the full menu for a specific phase
 */
export function getPhaseMenu(phase: number): PhaseMenu {
  const phaseData = PHASE_MENUS[phase];
  
  if (!phaseData) {
    // Return minimal menu for undefined phases
    return {
      phase,
      id: `S${phase}`,
      name: PHASES[phase - 1]?.name || "Unknown",
      purpose: PHASES[phase - 1]?.purpose || "Not defined",
      noiseFilters: NOISE_FILTERS,
      buildingBlocks: [],
      precombinations: [],
      engineNuances: {},
    };
  }

  return {
    phase,
    ...phaseData,
    noiseFilters: NOISE_FILTERS,
  };
}

