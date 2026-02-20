import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generateParallel } from '../claude.js';
import type { PipelineContext, Concept } from '../types.js';

const SYSTEM = `You are an expert educational simulation developer and data visualization engineer.
You build self-contained, interactive HTML simulations using Chart.js from CDN.
Your simulations are pedagogically purposeful — each one illuminates a specific concept through interaction.
You write clean, well-commented JavaScript. Every control has a clear label. Every chart updates in real time.`;

export default async function generateMicroSims(ctx: PipelineContext): Promise<void> {
  const { topic, microsims: simCount, model } = ctx.config;
  const title = ctx.courseDescription?.title ?? topic;
  const concepts = ctx.concepts ?? [];
  const chapters = ctx.chapters ?? [];

  const simTopics = selectSimTopics(simCount, concepts, chapters, topic);

  // Build prompts for all sims in parallel
  const prompts = simTopics.map(sim => ({
    prompt: buildSimPrompt(sim, title, topic),
    system: SYSTEM,
  }));

  const results = await generateParallel(prompts, { model, maxTokens: 8192 });

  // Write files following the mkdocs nav convention:
  //   docs/microsims/microsim-NN.md     — MkDocs wrapper page
  //   docs/microsims/microsim-NN.html   — raw HTML sim file
  const simsDir = join(ctx.outputDir, 'docs', 'microsims');
  await mkdir(simsDir, { recursive: true });

  await Promise.all(
    simTopics.map(async (sim, i) => {
      const paddedNum = String(i + 1).padStart(2, '0');
      const htmlContent = extractHtml(results[i] ?? '');

      // Write the raw HTML simulation
      const htmlFilename = `microsim-${paddedNum}.html`;
      await writeFile(join(simsDir, htmlFilename), htmlContent, 'utf8');

      // Write the MkDocs markdown wrapper (iframe embed)
      const wrapperMd = buildSimWrapper(sim.name, sim.description, paddedNum);
      await writeFile(join(simsDir, `microsim-${paddedNum}.md`), wrapperMd, 'utf8');
    })
  );

  // Write the sims overview index page
  const indexMd = buildSimsIndex(title, simTopics, simCount);
  await writeFile(join(simsDir, 'index.md'), indexMd, 'utf8');
}

interface SimTopic {
  name: string;
  description: string;
  conceptName: string;
  chapter: number;
  chartType: string;
}

function selectSimTopics(
  count: number,
  concepts: Concept[],
  chapters: { number: number; title: string }[],
  topic: string
): SimTopic[] {
  const chartTypes = ['bar', 'line', 'scatter', 'radar', 'doughnut', 'bubble'];

  // Prefer Core/Advanced concepts with Apply/Analyze/Evaluate/Create bloom levels
  const prioritized = concepts
    .filter(c => ['Apply', 'Analyze', 'Evaluate', 'Create'].includes(c.bloomLevel))
    .slice(0, count * 2);

  // Pick evenly distributed across chapters
  const selected: Concept[] = [];
  const usedChapters = new Set<number>();
  for (const c of prioritized) {
    if (selected.length >= count) break;
    if (!usedChapters.has(c.chapter)) {
      selected.push(c);
      usedChapters.add(c.chapter);
    }
  }
  // Fill remaining if needed
  for (const c of concepts) {
    if (selected.length >= count) break;
    if (!selected.find(s => s.id === c.id)) selected.push(c);
  }

  // If still not enough (e.g., no concepts), generate generic sim topics
  while (selected.length < count) {
    selected.push({
      id: selected.length + 1,
      name: `${topic} Concept ${selected.length + 1}`,
      chapter: 1,
      dependencies: [],
      taxonomy: 'Core',
      bloomLevel: 'Apply',
    });
  }

  return selected.slice(0, count).map((c, i) => ({
    name: `${c.name} Explorer`,
    description: `An interactive simulation for exploring ${c.name} in the context of ${topic}.`,
    conceptName: c.name,
    chapter: c.chapter,
    chartType: chartTypes[i % chartTypes.length],
  }));
}

function buildSimPrompt(sim: SimTopic, textbookTitle: string, topic: string): string {
  return `Create a complete, self-contained interactive HTML MicroSim for the intelligent textbook "${textbookTitle}".

## Simulation: ${sim.name}

**Concept Being Illustrated:** ${sim.conceptName}
**Domain:** ${topic}
**Primary Chart Type:** ${sim.chartType} (use Chart.js)

---

Write a complete, standalone HTML file that:

### Technical Requirements:
1. Uses Chart.js loaded from CDN: \`https://cdn.jsdelivr.net/npm/chart.js\`
2. All CSS and JavaScript are inline (no external files)
3. Works in a modern browser with no build step
4. Responsive layout that works in an iframe at 800x600px

### Educational Requirements:
1. Illustrates the concept "${sim.conceptName}" through interactive exploration
2. Has 2–4 slider inputs or number inputs that change parameters
3. Chart updates in real time as the user adjusts inputs (use an \`input\` event listener, not \`change\`)
4. Each input has a clear label showing its current value (update label dynamically)
5. A brief explanation panel (2–3 sentences) explaining what the simulation demonstrates

### Design Requirements:
1. Clean, professional look with a white or light gray (#f8f9fa) background
2. Clear section headers in a readable font (use system fonts: font-family: system-ui, sans-serif)
3. Input controls grouped together in a panel, chart displayed prominently
4. Meaningful axis labels and chart title
5. An educational color scheme appropriate for a professional textbook

### JavaScript Standards:
- Declare the Chart instance outside the update function
- Destroy and recreate the chart on updates, OR use \`chart.data\` mutation + \`chart.update()\`
- Add a \`DOMContentLoaded\` listener to initialize
- Comment key functions

### HTML Structure:
\`\`\`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${sim.name}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>/* inline CSS */</style>
</head>
<body>
  <!-- Title and description -->
  <!-- Input controls panel -->
  <!-- Chart canvas -->
  <!-- Explanation panel -->
  <script>/* inline JS */</script>
</body>
</html>
\`\`\`

Output ONLY the complete HTML file — no markdown fences, no explanation, no preamble.
Start with \`<!DOCTYPE html>\` and end with \`</html>\`.`;
}

function extractHtml(raw: string): string {
  // Strip markdown code fences if present
  const fenceMatch = raw.match(/```(?:html)?\s*\n([\s\S]*?)```/i);
  if (fenceMatch) return fenceMatch[1].trim();

  // If it starts with <!DOCTYPE or <html, return as-is
  if (raw.trimStart().startsWith('<!DOCTYPE') || raw.trimStart().startsWith('<html')) {
    return raw.trim();
  }

  // Extract from first DOCTYPE to last </html>
  const doctypeIdx = raw.indexOf('<!DOCTYPE');
  const htmlCloseIdx = raw.lastIndexOf('</html>');
  if (doctypeIdx !== -1 && htmlCloseIdx !== -1) {
    return raw.slice(doctypeIdx, htmlCloseIdx + '</html>'.length);
  }

  return raw.trim();
}

function buildSimWrapper(name: string, description: string, paddedNum: string): string {
  const htmlFile = `microsim-${paddedNum}.html`;
  return `# ${name}

${description}

<div style="width:100%;max-width:900px;margin:0 auto;">
  <iframe
    src="${htmlFile}"
    width="100%"
    height="640"
    frameborder="0"
    scrolling="no"
    style="border:1px solid #e0e0e0;border-radius:4px;display:block;"
    title="${name}">
  </iframe>
</div>

!!! tip "How to Use This Simulation"
    Adjust the sliders and input controls to change parameters.
    The chart updates in real time so you can observe how the concept responds to different values.
    Experiment freely — there are no wrong answers.

[Open in full screen](${htmlFile}){ .md-button .md-button--primary }
`;
}

function buildSimsIndex(
  title: string,
  sims: SimTopic[],
  count: number
): string {
  const rows = sims
    .map((s, i) => {
      const paddedNum = String(i + 1).padStart(2, '0');
      return `| [MicroSim ${i + 1}: ${s.name}](microsim-${paddedNum}.md) | Chapter ${s.chapter} | ${s.description} |`;
    })
    .join('\n');

  const links = sims
    .map((s, i) => {
      const paddedNum = String(i + 1).padStart(2, '0');
      return `- [MicroSim ${i + 1}: ${s.name}](microsim-${paddedNum}.md) — Chapter ${s.chapter}`;
    })
    .join('\n');

  return `# Interactive MicroSims: ${title}

MicroSims are self-contained interactive simulations that let you explore key concepts hands-on.
Each simulation responds to your inputs in real time, making abstract ideas concrete and explorable.

## Available Simulations (${count} total)

| Simulation | Chapter | Description |
|------------|---------|-------------|
${rows}

## How MicroSims Work

Each MicroSim is built with:

- **Chart.js** — loaded from CDN, no installation required
- **Real-time parameter controls** — sliders and inputs that immediately update the visualization
- **Embedded explanations** — text panels connecting the visual to the underlying concept

MicroSims are designed to complement the chapter content. Use them while reading to test your understanding,
or return to them during review.

## All Simulations

${links}
`;
}
