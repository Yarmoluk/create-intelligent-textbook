import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generate } from '../claude.js';
import type { PipelineContext, ChapterOutline } from '../types.js';

const SYSTEM = `You are an expert curriculum architect and technical author.
You design clear, coherent chapter structures that build knowledge progressively.
Each chapter outline you write gives authors everything they need to produce rich, substantive content.`;

export default async function generateChapterStructure(ctx: PipelineContext): Promise<void> {
  const { topic, chapters, model } = ctx.config;
  const title = ctx.courseDescription?.title ?? topic;
  const courseTopics = ctx.courseDescription?.topics ?? [];
  const concepts = ctx.concepts ?? [];

  // Build a per-chapter concept summary for the prompt
  const chapterConceptMap: Record<number, string[]> = {};
  for (const c of concepts) {
    if (!chapterConceptMap[c.chapter]) chapterConceptMap[c.chapter] = [];
    chapterConceptMap[c.chapter].push(`${c.id}. ${c.name}`);
  }

  const chapterList = Array.from({ length: chapters }, (_, i) => {
    const n = i + 1;
    const topicTitle = courseTopics[i] ?? `Chapter ${n}`;
    const conceptList = (chapterConceptMap[n] ?? []).slice(0, 8).join(', ');
    return `Chapter ${n}: ${topicTitle}\n  Key concepts: ${conceptList || 'TBD'}`;
  }).join('\n\n');

  const prompt = `Generate detailed chapter outlines for the intelligent textbook: "${title}"

Topic domain: ${topic}

Chapters to outline:
${chapterList}

For each of the ${chapters} chapters, produce output in this exact format:

---
## Chapter N: [Title]

**Summary:** [2–3 sentences describing what the chapter covers, why it matters, and what the learner will be able to do after completing it. Be specific — name the key concepts.]

**Concept IDs:** [comma-separated list of concept IDs that belong to this chapter, taken from the chapter's key concepts above]

**Key Questions:**
- [A guiding question the chapter answers]
- [Another guiding question]
- [A third guiding question]

**Learning Objectives:**
- [Specific, measurable objective using Bloom's action verb]
- [Another objective]
- [Another objective]
---

Generate all ${chapters} chapters in sequence. Be specific to the domain — avoid vague generic language.
Each summary should stand alone as a meaningful description of the chapter's intellectual content.`;

  const raw = await generate(prompt, { system: SYSTEM, model, maxTokens: 8192 });

  const chapterOutlines = parseChapterOutlines(raw, chapters, courseTopics, chapterConceptMap);
  ctx.chapters = chapterOutlines;

  const chaptersDir = join(ctx.outputDir, 'docs', 'chapters');
  await mkdir(chaptersDir, { recursive: true });

  // Write chapters overview index
  // Note: individual chapter files are chapters/chapter-NN.md (written by chapter-content step)
  const indexMd = buildChaptersIndex(title, chapterOutlines);
  await writeFile(join(chaptersDir, 'index.md'), indexMd, 'utf8');
}

function parseChapterOutlines(
  raw: string,
  chapterCount: number,
  courseTopics: string[],
  conceptMap: Record<number, string[]>
): ChapterOutline[] {
  const outlines: ChapterOutline[] = [];

  // Split on chapter delimiters
  const blocks = raw.split(/---+/g).filter(b => b.trim());

  for (const block of blocks) {
    const headerMatch = block.match(/##\s+Chapter\s+(\d+):\s*(.+)/i);
    if (!headerMatch) continue;

    const number = Number(headerMatch[1]);
    const title = headerMatch[2].trim();

    // Extract summary
    const summaryMatch = block.match(/\*\*Summary:\*\*\s*([^\n*]+(?:\n[^*\n][^\n]*)*)/i);
    const summary = summaryMatch ? summaryMatch[1].replace(/\n/g, ' ').trim() : '';

    // Extract concept IDs
    const conceptsMatch = block.match(/\*\*Concept IDs:\*\*\s*([^\n]+)/i);
    const concepts: number[] = [];
    if (conceptsMatch) {
      const parts = conceptsMatch[1].split(',');
      for (const p of parts) {
        const n = Number(p.trim().split('.')[0]);
        if (!isNaN(n) && n > 0) concepts.push(n);
      }
    }

    // Fallback: derive concept IDs from the concept map
    if (concepts.length === 0 && conceptMap[number]) {
      for (const entry of conceptMap[number]) {
        const n = Number(entry.split('.')[0]);
        if (!isNaN(n)) concepts.push(n);
      }
    }

    outlines.push({ number, title, summary, concepts });
  }

  // Ensure we have all chapters — fill gaps with defaults
  const found = new Set(outlines.map(o => o.number));
  for (let n = 1; n <= chapterCount; n++) {
    if (!found.has(n)) {
      const title = courseTopics[n - 1] ?? `Chapter ${n}`;
      const concepts = (conceptMap[n] ?? []).map(e => Number(e.split('.')[0])).filter(x => !isNaN(x));
      outlines.push({ number: n, title, summary: `Chapter ${n} covers ${title}.`, concepts });
    }
  }

  return outlines.sort((a, b) => a.number - b.number);
}

function buildChaptersIndex(title: string, chapters: ChapterOutline[]): string {
  // Link to flat chapter files: chapter-NN.md (as expected by mkdocs-config nav)
  const rows = chapters
    .map(ch => {
      const paddedNum = String(ch.number).padStart(2, '0');
      return `| [Chapter ${ch.number}: ${ch.title}](chapter-${paddedNum}.md) | ${ch.concepts.length} concepts | ${ch.summary} |`;
    })
    .join('\n');

  const links = chapters
    .map(ch => {
      const paddedNum = String(ch.number).padStart(2, '0');
      return `- [Chapter ${ch.number}: ${ch.title}](chapter-${paddedNum}.md)`;
    })
    .join('\n');

  return `# Chapters: ${title}

This textbook is organized into ${chapters.length} chapters, each building on the concepts and skills developed in previous chapters.

## Chapter Overview

| Chapter | Concepts | Summary |
|---------|----------|---------|
${rows}

## Quick Navigation

${links}
`;
}
