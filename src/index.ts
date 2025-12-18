#!/usr/bin/env node
/**
 * Fravia-Method MCP Search Server
 * Omakase Architecture - Agent orders from menu, never writes queries
 * 
 * Protocol:
 * 1. fravia.get_index() - Returns all phases (S1-S8)
 * 2. fravia.get_menu(phase) - Returns phase-specific options
 * 3. fravia.execute(phase, topics, codes) - Executes search with codes
 * 
 * STOP Hook Integration:
 * After execution, outputs structured results that integrate with
 * Cursor's stop hook to optionally continue the search loop.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadConfig, FraviaConfig } from "./config.js";
import { buildQueries, executeQueries, QueryResult } from "./executor.js";
import { PHASES, NOISE_FILTERS, getPhaseMenu } from "./phases.js";

// Server instance
const server = new Server(
  {
    name: "fravia-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// State management
let config: FraviaConfig;
let subjectMap: Map<string, string> = new Map();
let currentPhase = 1;
let stopRequested = false;

// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "fravia_get_index",
        description: "Get the phase index - list of all 8 Fravia search phases. Call this first to see available phases.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "fravia_get_menu",
        description: "Get the menu for a specific phase. Returns building blocks (A,B,C...), precombinations (X,Y,Z...), and noise filter options (s,f,t,u,c,l,a).",
        inputSchema: {
          type: "object",
          properties: {
            phase: {
              type: "number",
              description: "Phase number 1-8",
              minimum: 1,
              maximum: 8,
            },
          },
          required: ["phase"],
        },
      },
      {
        name: "fravia_execute",
        description: "Execute search queries based on selected codes. Responds with TWO lines: 1) Noise relax codes or '-', 2) Building block codes.",
        inputSchema: {
          type: "object",
          properties: {
            phase: {
              type: "number",
              description: "Phase number 1-8",
              minimum: 1,
              maximum: 8,
            },
            topics: {
              type: "array",
              items: { type: "string" },
              description: "Array of topics/synonyms. Index 0 is main subject, 1+ are synonyms.",
            },
            codes: {
              type: "string",
              description: "Single string of codes. Letters (A-Z) select building blocks/combos. Numbers (1-9) relax noise filters. Example: 'AC' or 'X' or 's AC'",
            },
          },
          required: ["phase", "topics", "codes"],
        },
      },
      {
        name: "fravia_set_subjects",
        description: "Set the subject map (topic 0 = main, 1+ = synonyms). Only needed for S1/S2 phases.",
        inputSchema: {
          type: "object",
          properties: {
            subjects: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  text: { type: "string" },
                },
                required: ["id", "text"],
              },
              description: "Array of {id, text} pairs. id='0' is main subject.",
            },
          },
          required: ["subjects"],
        },
      },
      {
        name: "fravia_stop",
        description: "Signal stop and optionally request followup. Integrates with Cursor stop hook.",
        inputSchema: {
          type: "object",
          properties: {
            continue_to_phase: {
              type: "number",
              description: "Optional: next phase to continue to (1-8)",
            },
            reason: {
              type: "string",
              description: "Reason for stopping or continuing",
            },
          },
          required: [],
        },
      },
    ],
  };
});

// Tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "fravia_get_index":
        return handleGetIndex();
      
      case "fravia_get_menu":
        return handleGetMenu(args?.phase as number);
      
      case "fravia_execute":
        return await handleExecute(
          args?.phase as number,
          args?.topics as string[],
          args?.codes as string
        );
      
      case "fravia_set_subjects":
        return handleSetSubjects(args?.subjects as Array<{id: string, text: string}>);
      
      case "fravia_stop":
        return handleStop(
          args?.continue_to_phase as number | undefined,
          args?.reason as string | undefined
        );
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

function handleGetIndex() {
  const phaseList = PHASES.map((p, i) => ({
    code: String(i + 1),
    id: `S${i + 1}`,
    name: p.name,
    purpose: p.purpose,
  }));

  const response = {
    phases: phaseList,
    nextPhaseCode: String(currentPhase),
    instructions: [
      "1. Call fravia_get_menu(phase=N) to see options for phase N",
      "2. Call fravia_execute with codes to run queries",
      "3. Letters (A,B,C,X,Y,Z) select search strategies",
      "4. Lowercase (s,f,t,u,c,l,a) relax noise filters",
      "5. Numbers (0,1,2) reference topics from subject map",
    ],
  };

  return {
    content: [
      {
        type: "text",
        text: formatPhaseIndex(response),
      },
    ],
  };
}

function handleGetMenu(phase: number) {
  if (phase < 1 || phase > 8) {
    throw new Error("Phase must be 1-8");
  }

  currentPhase = phase;
  const menu = getPhaseMenu(phase);

  return {
    content: [
      {
        type: "text",
        text: formatPhaseMenu(menu),
      },
    ],
  };
}

async function handleExecute(
  phase: number,
  topics: string[],
  codes: string
): Promise<{ content: Array<{ type: string; text: string }> }> {
  if (phase < 1 || phase > 8) {
    throw new Error("Phase must be 1-8");
  }

  if (!topics || topics.length === 0) {
    throw new Error("At least one topic required");
  }

  if (!codes || codes.trim() === "") {
    throw new Error("Codes required (e.g., 'A', 'XY', 's AC')");
  }

  // Update subject map from topics
  topics.forEach((t, i) => subjectMap.set(String(i), t));

  // Build and execute queries
  const queries = buildQueries(phase, topics, codes, config);
  const results = await executeQueries(queries);

  // Format results with STOP integration
  const output = formatExecutionResults(phase, codes, queries, results);

  return {
    content: [
      {
        type: "text",
        text: output,
      },
    ],
  };
}

function handleSetSubjects(subjects: Array<{id: string, text: string}>) {
  subjectMap.clear();
  subjects.forEach(s => subjectMap.set(s.id, s.text));

  return {
    content: [
      {
        type: "text",
        text: `Subject map set:\n${subjects.map(s => `  [${s.id}] ${s.text}`).join('\n')}`,
      },
    ],
  };
}

function handleStop(continueToPhase?: number, reason?: string) {
  stopRequested = true;

  if (continueToPhase && continueToPhase >= 1 && continueToPhase <= 8) {
    currentPhase = continueToPhase;
    return {
      content: [
        {
          type: "text",
          text: `STOP: Phase ${currentPhase - 1} complete. ${reason || ''}\n---FOLLOWUP---\nContinuing to phase ${continueToPhase}: ${PHASES[continueToPhase - 1].name}`,
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text",
        text: `STOP: Search session complete. ${reason || ''}\n---AWAIT_USER_INPUT---`,
      },
    ],
  };
}

// Formatting functions
function formatPhaseIndex(response: {
  phases: Array<{ code: string; id: string; name: string; purpose: string }>;
  nextPhaseCode: string;
  instructions: string[];
}): string {
  let output = "*** FRAVIA SEARCH PHASES ***\n\n";
  
  response.phases.forEach(p => {
    output += `[${p.code}] ${p.id}: ${p.name}\n    ${p.purpose}\n\n`;
  });

  output += "--- INSTRUCTIONS ---\n";
  response.instructions.forEach(i => {
    output += `${i}\n`;
  });

  output += `\nCurrent phase: ${response.nextPhaseCode}\n`;
  output += "Call fravia_get_menu(phase=N) to see menu for phase N\n";

  return output;
}

function formatPhaseMenu(menu: ReturnType<typeof getPhaseMenu>): string {
  let output = `*** PHASE S${menu.phase}: ${menu.name} ***\n`;
  output += `PURPOSE: ${menu.purpose}\n\n`;

  output += "--- ACTIVE HYGIENE (Default: BLOCKED) ---\n";
  menu.noiseFilters.forEach(f => {
    output += `[${f.code}] ${f.name}: ${f.applies}\n`;
  });
  output += "(Send lowercase letter to RELAX this filter)\n\n";

  output += "--- BUILDING BLOCKS ---\n";
  menu.buildingBlocks.forEach(b => {
    output += `[${b.code}] ${b.name}: ${b.description}\n`;
    Object.entries(b.engines).forEach(([engine, queries]) => {
      output += `    ${engine}: ${queries.join(' | ')}\n`;
    });
    output += "\n";
  });

  if (menu.precombinations.length > 0) {
    output += "--- PRECOMBINATIONS ---\n";
    menu.precombinations.forEach(p => {
      output += `[${p.code}] ${p.name} (=${p.expandsTo.join('+')}): ${p.description}\n`;
    });
    output += "\n";
  }

  output += "--- ENGINE NUANCE ---\n";
  Object.entries(menu.engineNuances).forEach(([engine, nuance]) => {
    output += `${engine}: ${nuance}\n`;
  });

  output += "\n--- RESPONSE FORMAT ---\n";
  output += "Reply with: fravia_execute(phase=N, topics=[...], codes='...')\n";
  output += "Example codes: 'A' or 'XY' or 's AC' (s=relax social filter)\n";

  return output;
}

function formatExecutionResults(
  phase: number,
  codes: string,
  queries: Array<{ engine: string; query: string }>,
  results: QueryResult[]
): string {
  let output = `*** PHASE S${phase} EXECUTION ***\n`;
  output += `Codes: ${codes}\n`;
  output += `Queries generated: ${queries.length}\n\n`;

  output += "--- QUERIES ---\n";
  queries.forEach((q, i) => {
    output += `[${q.engine}] ${q.query}\n`;
  });

  output += "\n--- RESULTS ---\n";
  results.forEach((r, i) => {
    output += `\n[${r.engine}] ${r.title}\n`;
    output += `  URL: ${r.url}\n`;
    output += `  Snippet: ${r.snippet}\n`;
  });

  output += "\n--- STOP HOOK ---\n";
  output += `Phase ${phase} complete. Next phase: ${phase < 8 ? phase + 1 : 'COMPLETE'}\n`;
  if (phase < 8) {
    output += `Call fravia_get_menu(phase=${phase + 1}) to continue\n`;
    output += `Or call fravia_stop(continue_to_phase=${phase + 1}) to auto-advance\n`;
  } else {
    output += "---AWAIT_USER_INPUT---\n";
  }

  return output;
}

// Main
async function main() {
  // Load configuration
  config = await loadConfig();

  // Create transport and connect
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Fravia MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

