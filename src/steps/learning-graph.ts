import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generate } from '../claude.js';
import type { PipelineContext, Concept } from '../types.js';

const SYSTEM = `You are an expert in knowledge graph design, learning science, and curriculum architecture.
You map complex domains into precise, dependency-ordered concept graphs that guide learner progression.`;

export default async function generateLearningGraph(ctx: PipelineContext): Promise<void> {
  const { topic, concepts: conceptCount, chapters, model } = ctx.config;
  const title = ctx.courseDescription?.title ?? topic;
  const topicList = ctx.courseDescription?.topics ?? [];

  const chapterContext = topicList.length
    ? topicList.map((t, i) => `  Chapter ${i + 1}: ${t}`).join('\n')
    : `  ${chapters} chapters covering ${topic}`;

  const prompt = `Generate a learning graph of exactly ${conceptCount} concepts for the intelligent textbook: "${title}"

Topic domain: ${topic}

Chapters:
${chapterContext}

Output a markdown table with exactly ${conceptCount} rows and these columns:
| ID | Concept | Chapter | Dependencies | Taxonomy | Bloom's Level |

Column rules:
- ID: sequential integer starting at 1
- Concept: precise name of the concept (2–6 words, noun phrase)
- Chapter: integer 1–${chapters} indicating where this concept is taught
- Dependencies: comma-separated IDs of prerequisite concepts (empty cell if none). Only reference lower-numbered IDs.
- Taxonomy: exactly one of: Foundation | Core | Advanced
  - Foundation = vocabulary, definitions, basic facts (Chapters 1–${Math.ceil(chapters / 3)})
  - Core = processes, relationships, applications (Chapters ${Math.ceil(chapters / 3) + 1}–${Math.ceil((chapters * 2) / 3)})
  - Advanced = synthesis, evaluation, design (Chapters ${Math.ceil((chapters * 2) / 3) + 1}–${chapters})
- Bloom's Level: exactly one of: Remember | Understand | Apply | Analyze | Evaluate | Create

Requirements:
- Distribute concepts proportionally across all ${chapters} chapters
- Foundation concepts (Chapters 1–${Math.ceil(chapters / 3)}): ~40% of total, Bloom's: Remember/Understand
- Core concepts (middle chapters): ~40% of total, Bloom's: Apply/Analyze
- Advanced concepts (late chapters): ~20% of total, Bloom's: Evaluate/Create
- Dependencies must be realistic — concept N can only depend on concepts with IDs < N
- Each chapter should have at least 3 concepts
- Output ONLY the markdown table — no preamble, no explanation, no trailing text`;

  const raw = await generate(prompt, { system: SYSTEM, model, maxTokens: 8192 });

  const concepts = parseConceptTable(raw);
  ctx.concepts = concepts;

  const graphDir = join(ctx.outputDir, 'docs', 'learning-graph');
  await mkdir(graphDir, { recursive: true });

  // Write concept map overview (matches mkdocs nav: learning-graph/concept-map.md)
  const conceptMap = buildConceptMapMd(title, raw, concepts);
  await writeFile(join(graphDir, 'concept-map.md'), conceptMap, 'utf8');

  // Write dependency graph page (matches mkdocs nav: learning-graph/dependency-graph.md)
  const dependencyGraph = buildDependencyGraphMd(title, concepts, chapters);
  await writeFile(join(graphDir, 'dependency-graph.md'), dependencyGraph, 'utf8');
}

function parseConceptTable(raw: string): Concept[] {
  const lines = raw.split('\n').filter(l => l.includes('|'));
  const concepts: Concept[] = [];

  for (const line of lines) {
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length < 6) continue;

    // Skip header and separator rows
    const idStr = cells[0];
    if (!idStr || isNaN(Number(idStr))) continue;

    const id = Number(idStr);
    const name = cells[1] ?? '';
    const chapter = Number(cells[2]) || 1;
    const depsStr = cells[3] ?? '';
    const taxonomy = normalizeTaxonomy(cells[4] ?? '');
    const bloomLevel = normalizeBloom(cells[5] ?? '');

    const dependencies = depsStr
      .split(',')
      .map(s => Number(s.trim()))
      .filter(n => !isNaN(n) && n > 0 && n !== id);

    concepts.push({ id, name, chapter, dependencies, taxonomy, bloomLevel });
  }

  return concepts;
}

function normalizeTaxonomy(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('found')) return 'Foundation';
  if (lower.includes('adv')) return 'Advanced';
  return 'Core';
}

function normalizeBloom(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('remember')) return 'Remember';
  if (lower.includes('understand')) return 'Understand';
  if (lower.includes('apply')) return 'Apply';
  if (lower.includes('analyz')) return 'Analyze';
  if (lower.includes('evaluat')) return 'Evaluate';
  if (lower.includes('creat')) return 'Create';
  return raw.trim();
}

function buildConceptMapMd(title: string, rawTable: string, concepts: Concept[]): string {
  // Extract just the table lines
  const tableLines = rawTable.split('\n').filter(l => l.includes('|'));
  const cleanTable = tableLines.join('\n');

  return `# Concept Map: ${title}

This concept map lists all ${concepts.length} concepts in the learning graph, ordered by ID (sequence of introduction).
Each concept is tagged with its chapter, dependencies, taxonomy level, and Bloom's cognitive level.

## Full Concept Table

${cleanTable}

## How to Read This Table

| Column | Description |
|--------|-------------|
| **ID** | Unique identifier; also indicates the order concepts are introduced |
| **Concept** | Precise name of the concept |
| **Chapter** | Chapter where this concept is first taught |
| **Dependencies** | IDs of concepts that must be understood first |
| **Taxonomy** | Foundation = foundational vocab/facts; Core = processes/applications; Advanced = synthesis/evaluation |
| **Bloom's Level** | Cognitive level required: Remember → Understand → Apply → Analyze → Evaluate → Create |
`;
}

function buildDependencyGraphMd(title: string, concepts: Concept[], chapters: number): string {
  const total = concepts.length;
  const byTaxonomy = {
    Foundation: concepts.filter(c => c.taxonomy === 'Foundation').length,
    Core: concepts.filter(c => c.taxonomy === 'Core').length,
    Advanced: concepts.filter(c => c.taxonomy === 'Advanced').length,
  };
  const byBloom: Record<string, number> = {};
  for (const c of concepts) {
    byBloom[c.bloomLevel] = (byBloom[c.bloomLevel] ?? 0) + 1;
  }

  const bloomLevels = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'];
  const bloomRows = bloomLevels.map(l => `| ${l} | ${byBloom[l] ?? 0} |`).join('\n');

  const chapterRows = Array.from({ length: chapters }, (_, i) => {
    const n = i + 1;
    const chConcepts = concepts.filter(c => c.chapter === n);
    const count = chConcepts.length;
    const withDeps = chConcepts.filter(c => c.dependencies.length > 0).length;
    return `| Chapter ${n} | ${count} | ${withDeps} |`;
  }).join('\n');

  // Build a mermaid subgraph for the first chapter's concepts as a sample
  const sampleConcepts = concepts.slice(0, Math.min(10, concepts.length));
  const mermaidNodes = sampleConcepts
    .map(c => `  ${c.id}["${c.id}. ${c.name}"]`)
    .join('\n');
  const mermaidEdges = sampleConcepts
    .flatMap(c => c.dependencies
      .filter(depId => sampleConcepts.find(s => s.id === depId))
      .map(depId => `  ${depId} --> ${c.id}`)
    )
    .join('\n');

  return `# Dependency Graph: ${title}

The dependency graph maps prerequisite relationships between all ${total} concepts.
An arrow from concept A to concept B means: **A must be understood before B**.

## Graph Summary

| Taxonomy | Count |
|----------|-------|
| Foundation | ${byTaxonomy.Foundation} |
| Core | ${byTaxonomy.Core} |
| Advanced | ${byTaxonomy.Advanced} |
| **Total** | **${total}** |

## Distribution by Bloom's Level

| Level | Count |
|-------|-------|
${bloomRows}

## Concepts per Chapter

| Chapter | Total Concepts | With Dependencies |
|---------|---------------|-------------------|
${chapterRows}

## Sample Dependency Diagram

The following diagram shows the dependency relationships among the first ${sampleConcepts.length} concepts:

\`\`\`mermaid
graph TD
${mermaidNodes}
${mermaidEdges}
\`\`\`

!!! note "Reading the Graph"
    Each box is a concept. Arrows indicate prerequisite relationships.
    Concepts without incoming arrows are entry points — no prior knowledge of the subject is required.

## Dependency Statistics

- **Total concepts with at least one dependency:** ${concepts.filter(c => c.dependencies.length > 0).length}
- **Entry-point concepts (no dependencies):** ${concepts.filter(c => c.dependencies.length === 0).length}
- **Average dependencies per concept:** ${(concepts.reduce((sum, c) => sum + c.dependencies.length, 0) / Math.max(total, 1)).toFixed(1)}

See the [Concept Map](concept-map.md) for the full table, or [Book Metrics](book-metrics.md) for overall statistics.
`;
}
