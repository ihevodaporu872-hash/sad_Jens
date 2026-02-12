/**
 * Merge 3 n8n workflows from global.txt into a single unified workflow
 * - Remove duplicate nodes (suffixed with "1", "2")
 * - Keep the most feature-complete version
 * - Replace Artem Boiko paths with kuklev.d.s paths
 * - Insert real API keys
 * - Fix connections
 */

import { readFileSync, writeFileSync } from 'fs';

const INPUT = './test/global.txt';
const OUTPUT = './workflow-unified.json';

// ============================================================
// 1. Parse the original workflow
// ============================================================
const raw = readFileSync(INPUT, 'utf-8');
const workflow = JSON.parse(raw);

console.log(`Loaded: ${workflow.nodes.length} nodes`);
console.log(`Connections keys: ${Object.keys(workflow.connections || {}).length}`);

// ============================================================
// 2. Identify duplicate nodes
//    Nodes ending with "1" or "2" that have a base version
// ============================================================

const nodesByName = new Map();
for (const node of workflow.nodes) {
  nodesByName.set(node.name, node);
}

// Find nodes that are duplicates (name ends with "1" or "2" and base exists)
const duplicateNames = new Set();
const renameMap = new Map(); // old name -> new name (for connection fixup)

for (const node of workflow.nodes) {
  const name = node.name;

  // Check for numbered suffix pattern (e.g., "Config1", "Main1", "Telegram Trigger1")
  const match = name.match(/^(.+?)(\d)$/);
  if (match) {
    const baseName = match[1].trim();
    const suffix = match[2];

    // Check if base version exists
    if (nodesByName.has(baseName)) {
      duplicateNames.add(name);
      renameMap.set(name, baseName);
      console.log(`  Duplicate: "${name}" -> base: "${baseName}"`);
    }
  }
}

// Also check for pattern "Name1" where base is "Name" (without space)
for (const node of workflow.nodes) {
  const name = node.name;
  const match = name.match(/^(.+[^\d])(\d)$/);
  if (match && !duplicateNames.has(name)) {
    const baseName = match[1];
    if (nodesByName.has(baseName) && baseName !== name) {
      duplicateNames.add(name);
      renameMap.set(name, baseName);
      console.log(`  Duplicate: "${name}" -> base: "${baseName}"`);
    }
  }
}

console.log(`\nFound ${duplicateNames.size} duplicate nodes to remove`);

// ============================================================
// 3. Filter out duplicate nodes, keep base versions
// ============================================================
const filteredNodes = workflow.nodes.filter(n => !duplicateNames.has(n.name));
console.log(`After dedup: ${filteredNodes.length} nodes (removed ${workflow.nodes.length - filteredNodes.length})`);

// ============================================================
// 4. Replace Artem Boiko paths
// ============================================================

const PATH_REPLACEMENTS = [
  // Converter path
  {
    from: 'C:\\\\Users\\\\Artem Boiko\\\\Desktop\\\\n8n\\\\cad2data-Revit-IFC-DWG-DGN-pipeline-with-conversion-validation-qto-main\\\\cad2data-Revit-IFC-DWG-DGN-pipeline-with-conversion-validation-qto-main\\\\DDC_Converter_Revit\\\\datadrivenlibs\\\\RvtExporter.exe',
    to: 'C:\\\\Users\\\\kuklev.d.s\\\\Documents\\\\GitHub\\\\ML-data-BIM\\\\DDC_CONVERTER_REVIT\\\\datadrivenlibs\\\\RvtExporter.exe'
  },
  {
    from: 'C:\\\\Users\\\\Artem Boiko\\\\Desktop\\\\n8n\\\\cad2data-Revit-IFC-DWG-DGN-pipeline-with-conversion-validation-qto-main\\\\cad2data-Revit-IFC-DWG-DGN-pipeline-with-conversion-validation-qto-main\\\\DDC_Converter_Revit\\\\RvtExporter.exe',
    to: 'C:\\\\Users\\\\kuklev.d.s\\\\Documents\\\\GitHub\\\\ML-data-BIM\\\\DDC_CONVERTER_REVIT\\\\datadrivenlibs\\\\RvtExporter.exe'
  },
  // Sample projects path
  {
    from: 'C:\\\\Users\\\\Artem Boiko\\\\Desktop\\\\n8n\\\\cad2data-Revit-IFC-DWG-DGN-pipeline-with-conversion-validation-qto-main\\\\cad2data-Revit-IFC-DWG-DGN-pipeline-with-conversion-validation-qto-main\\\\Sample_Projects',
    to: 'C:\\\\Users\\\\usr\\\\test\\\\Sample_Projects'
  },
  // Generic Artem Boiko base path (catch-all)
  {
    from: 'C:\\\\Users\\\\Artem Boiko\\\\Desktop\\\\n8n\\\\cad2data-Revit-IFC-DWG-DGN-pipeline-with-conversion-validation-qto-main\\\\cad2data-Revit-IFC-DWG-DGN-pipeline-with-conversion-validation-qto-main',
    to: 'C:\\\\Users\\\\usr\\\\test'
  }
];

// ============================================================
// 5. Insert real API keys into TOKEN node
// ============================================================

const TOKEN_CONFIG = {
  bot_token: '8579432194:AAFkO5S1CdBJ2egpDwC5hTaa4DMoljs4Dfc',
  AI_PROVIDER: 'gemini',
  GEMINI_API_KEY: 'AIzaSyBRqtnMxmXWHa_oG4hA9VfjmXuUWZEQypc',
  OPENAI_API_KEY: 'AIzaSyBRqtnMxmXWHa_oG4hA9VfjmXuUWZEQypc',
  QDRANT_URL: 'http://localhost:6333',
  QDRANT_API_KEY: ''
};

// ============================================================
// 6. Process nodes - apply path replacements and key updates
// ============================================================

let jsonStr = JSON.stringify({ ...workflow, nodes: filteredNodes }, null, 2);

// Apply path replacements
for (const { from, to } of PATH_REPLACEMENTS) {
  const regex = new RegExp(escapeRegex(from), 'g');
  const count = (jsonStr.match(regex) || []).length;
  if (count > 0) {
    console.log(`  Replaced "${from.substring(0, 50)}..." -> "${to.substring(0, 50)}..." (${count} times)`);
    jsonStr = jsonStr.replace(regex, to);
  }
}

// Also replace non-escaped versions (for JSON values)
const pathReplacementsRaw = [
  {
    from: 'C:\\Users\\Artem Boiko\\Desktop\\n8n\\cad2data-Revit-IFC-DWG-DGN-pipeline-with-conversion-validation-qto-main\\cad2data-Revit-IFC-DWG-DGN-pipeline-with-conversion-validation-qto-main\\DDC_Converter_Revit\\datadrivenlibs\\RvtExporter.exe',
    to: 'C:\\Users\\kuklev.d.s\\Documents\\GitHub\\ML-data-BIM\\DDC_CONVERTER_REVIT\\datadrivenlibs\\RvtExporter.exe'
  },
  {
    from: 'C:\\Users\\Artem Boiko\\Desktop\\n8n\\cad2data-Revit-IFC-DWG-DGN-pipeline-with-conversion-validation-qto-main\\cad2data-Revit-IFC-DWG-DGN-pipeline-with-conversion-validation-qto-main\\DDC_Converter_Revit\\RvtExporter.exe',
    to: 'C:\\Users\\kuklev.d.s\\Documents\\GitHub\\ML-data-BIM\\DDC_CONVERTER_REVIT\\datadrivenlibs\\RvtExporter.exe'
  },
  {
    from: 'C:\\Users\\Artem Boiko\\Desktop\\n8n\\cad2data-Revit-IFC-DWG-DGN-pipeline-with-conversion-validation-qto-main\\cad2data-Revit-IFC-DWG-DGN-pipeline-with-conversion-validation-qto-main\\Sample_Projects',
    to: 'C:\\Users\\usr\\test\\Sample_Projects'
  },
  {
    from: 'C:\\Users\\Artem Boiko\\Desktop\\n8n\\cad2data-Revit-IFC-DWG-DGN-pipeline-with-conversion-validation-qto-main\\cad2data-Revit-IFC-DWG-DGN-pipeline-with-conversion-validation-qto-main',
    to: 'C:\\Users\\usr\\test'
  }
];

for (const { from, to } of pathReplacementsRaw) {
  // Escape for use in JSON string context
  const fromEscaped = from.replace(/\\/g, '\\\\');
  const toEscaped = to.replace(/\\/g, '\\\\');
  const regex = new RegExp(escapeRegex(fromEscaped), 'g');
  const count = (jsonStr.match(regex) || []).length;
  if (count > 0) {
    console.log(`  Replaced raw path (${count} times)`);
    jsonStr = jsonStr.replace(regex, toEscaped);
  }
}

// ============================================================
// 5b. Update TOKEN node directly in filtered nodes array
// ============================================================
for (const node of filteredNodes) {
  if (node.name === '🔑 TOKEN' && node.parameters?.jsonOutput) {
    const tokenJson = JSON.stringify(TOKEN_CONFIG, null, 2);
    node.parameters.jsonOutput = tokenJson;
    console.log('\n  Updated TOKEN node with real keys');
  }
}

// Now serialize
jsonStr = JSON.stringify({ ...workflow, nodes: filteredNodes }, null, 2);

// ============================================================
// 7. Fix connections - redirect references to duplicate nodes
// ============================================================

// In the connections section, replace references to duplicate node names with base names
for (const [oldName, newName] of renameMap) {
  // Replace in connection keys (node output connections)
  const keyRegex = new RegExp(`"${escapeRegex(oldName)}"\\s*:`, 'g');
  // Don't replace keys - just remove them since base version handles it

  // Replace in connection values (where nodes reference other nodes by name in code)
  const refRegex = new RegExp(`\\$\\('${escapeRegex(oldName)}'\\)`, 'g');
  const refCount = (jsonStr.match(refRegex) || []).length;
  if (refCount > 0) {
    jsonStr = jsonStr.replace(refRegex, `$('${newName}')`);
    console.log(`  Fixed ${refCount} code references: $('${oldName}') -> $('${newName}')`);
  }
}

// Remove connection entries for deleted nodes
let parsedResult = JSON.parse(jsonStr);
const activeNodeNames = new Set(parsedResult.nodes.map(n => n.name));

if (parsedResult.connections) {
  const cleanConnections = {};
  for (const [nodeName, conns] of Object.entries(parsedResult.connections)) {
    if (activeNodeNames.has(nodeName)) {
      // Also filter out targets that reference deleted nodes
      const cleanConns = {};
      for (const [outputName, outputs] of Object.entries(conns)) {
        const cleanOutputs = outputs.map(connections =>
          connections.filter(conn => activeNodeNames.has(conn.node))
        );
        if (cleanOutputs.some(arr => arr.length > 0)) {
          cleanConns[outputName] = cleanOutputs;
        }
      }
      if (Object.keys(cleanConns).length > 0) {
        cleanConnections[nodeName] = cleanConns;
      }
    }
  }
  parsedResult.connections = cleanConnections;
  console.log(`\nConnections: ${Object.keys(parsedResult.connections).length} active nodes (was ${Object.keys(workflow.connections || {}).length})`);
}

// ============================================================
// 8. Add workflow metadata
// ============================================================
parsedResult.name = 'DDC CWICR Unified - Construction Cost Estimator + Revit Converter';
parsedResult.meta = {
  ...(parsedResult.meta || {}),
  templateCredsSetupCompleted: true
};

// ============================================================
// 9. Write output
// ============================================================
const output = JSON.stringify(parsedResult, null, 2);
writeFileSync(OUTPUT, output, 'utf-8');

console.log(`\n✅ Unified workflow saved to: ${OUTPUT}`);
console.log(`   Nodes: ${parsedResult.nodes.length}`);
console.log(`   Size: ${(output.length / 1024).toFixed(0)} KB`);

// ============================================================
// Helper
// ============================================================
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
