import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generate } from '../claude.js';
import type { PipelineContext } from '../types.js';

const SYSTEM = `You are a technical writer who creates compelling GitHub READMEs for educational projects.
Your READMEs are clear, scannable, and communicate value quickly.
You use concise prose, tables, and badges — never padded filler copy.`;

async function readMetrics(metricsPath: string): Promise<string> {
  try {
    const content = await readFile(metricsPath, 'utf8');
    // Extract just the summary table block
    const match = content.match(/## Summary Table\s*\n([\s\S]*?)(?=\n##|$)/);
    return match ? match[1].trim() : '';
  } catch {
    return '';
  }
}

export default async function generateReadme(ctx: PipelineContext): Promise<void> {
  const { topic, model, repoName, deploy } = ctx.config;
  const title = ctx.courseDescription?.title ?? topic;
  const subtitle = ctx.courseDescription?.subtitle ?? '';
  const targetAudience = ctx.courseDescription?.targetAudience ?? '';
  const topics = ctx.courseDescription?.topics ?? [];

  const liveUrl =
    deploy === 'github-pages' && repoName
      ? `https://yarmoluk.github.io/${repoName}/`
      : null;

  const metricsTable = await readMetrics(
    join(ctx.outputDir, 'docs', 'learning-graph', 'book-metrics.md'),
  );

  const chapterTable =
    topics.length > 0
      ? [
          '| # | Chapter Title |',
          '|---|---------------|',
          ...topics.map((t, i) => `| ${i + 1} | ${t} |`),
        ].join('\n')
      : '';

  const microsimCount = ctx.config.microsims;
  const conceptCount = ctx.concepts?.length ?? ctx.config.concepts;

  const prompt = `Write a GitHub README for an intelligent textbook repository.

Title: ${title}
Subtitle: ${subtitle}
Topic: ${topic}
Target Audience: ${targetAudience || 'Professional learners and students'}
${liveUrl ? `Live Site: ${liveUrl}` : ''}
Repo Name: ${repoName ?? 'this-textbook'}
Chapters: ${topics.length || ctx.config.chapters}
MicroSims: ${microsimCount}
Concepts Mapped: ${conceptCount}

Chapter table (use this verbatim in the README):
${chapterTable}

Metrics table (use this verbatim in a Metrics section):
${metricsTable}

Write the README with these sections in order:
1. Title and badges (no coursework/academic framing — let the content speak for itself)
2. One-paragraph overview that explains what this textbook covers and who it's for
3. A "What's Inside" section with:
   a. The chapter table (verbatim, label it "## Chapters")
   b. A bullet list of MicroSim highlights (invent plausible names based on the topic and chapter titles)
4. Metrics section with the metrics table
5. "Built With" section listing: MkDocs Material, Claude (Anthropic), Python, JavaScript/p5.js, Mermaid
6. "Getting Started" with local setup steps:
   \`\`\`bash
   pip install mkdocs-material
   mkdocs serve
   \`\`\`
7. License: MIT

Badges to include (at the top, after the title):
- ${liveUrl ? `[![Live Site](https://img.shields.io/badge/Live%20Site-GitHub%20Pages-blue)](${liveUrl})` : ''}
- [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
- [![MkDocs](https://img.shields.io/badge/Built%20with-MkDocs%20Material-teal)](https://squidfunk.github.io/mkdocs-material/)
- [![Claude](https://img.shields.io/badge/Powered%20by-Claude%20AI-orange)](https://anthropic.com)

Rules:
- Do NOT use phrases like "built as coursework," "university project," "class assignment," or any academic framing.
- Write in a professional, authoritative tone — like a published technical resource.
- Keep the overview to 3–5 sentences maximum.
- Output only valid markdown — no code fences around the document, no preamble, no commentary.`;

  const raw = await generate(prompt, { system: SYSTEM, model, maxTokens: 4096 });

  await writeFile(join(ctx.outputDir, 'README.md'), raw.trim(), 'utf8');
}
