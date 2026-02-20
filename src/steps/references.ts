import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generate } from '../claude.js';
import type { PipelineContext } from '../types.js';

const SYSTEM = `You are a research librarian and subject matter expert with broad knowledge of academic literature,
industry standards, and authoritative online resources. You produce well-formatted, accurate reference lists
following a consistent citation style appropriate for technical and professional education.`;

export default async function generateReferences(ctx: PipelineContext): Promise<void> {
  const { topic, model } = ctx.config;
  const title = ctx.courseDescription?.title ?? topic;

  const chapters = ctx.chapters ?? [];
  const chapterList =
    chapters.length > 0
      ? chapters.map(ch => `- Chapter ${ch.number}: ${ch.title}`)
      : (ctx.courseDescription?.topics ?? []).map(
          (t, i) => `- Chapter ${i + 1}: ${t}`,
        );

  const chapterSection =
    chapterList.length > 0
      ? `The textbook has these chapters:\n${chapterList.join('\n')}`
      : `The textbook covers the topic: "${topic}"`;

  const prompt = `Generate a comprehensive references page for an intelligent textbook titled "${title}" on "${topic}".

${chapterSection}

Requirements:
- Produce 8–10 references per chapter, organized under a level-2 heading for each chapter.
- Mix reference types across each chapter: 2–3 books, 2–3 academic papers or conference proceedings, 2–3 authoritative websites or online resources, and 1 video or podcast where relevant.
- Format books as: **Author Last, First (Year).** *Book Title: Subtitle*. Publisher.
- Format papers as: **Author Last, First (Year).** "Paper Title." *Journal or Conference Name*, Volume(Issue), pp. Pages. DOI or URL if available.
- Format websites as: **Organization or Author (Year).** *Page Title*. Retrieved from [URL](URL)
- References should be real, plausible, and directly relevant to the chapter topic — not made up titles with fake ISBNs.
- If a reference is uncertain, use a credible real author and publisher but omit the specific ISBN.
- Begin with a level-1 heading: # References
- Add one sentence of context before the first chapter section.
- End with a level-2 section: ## Further Reading with 3–5 curated resources that span the entire course.

Output only valid markdown — no code fences, no preamble, no commentary.`;

  const raw = await generate(prompt, { system: SYSTEM, model, maxTokens: 8192 });

  const docsDir = join(ctx.outputDir, 'docs');
  await mkdir(docsDir, { recursive: true });
  await writeFile(join(docsDir, 'references.md'), raw.trim(), 'utf8');
}
