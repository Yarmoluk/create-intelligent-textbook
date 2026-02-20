import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generate } from '../claude.js';
import type { PipelineContext } from '../types.js';

const SYSTEM = `You are an expert curriculum designer specializing in learner-centered FAQ design.
You anticipate real questions from real learners — not generic queries.
You write clear, precise answers that build understanding rather than just define terms.`;

export default async function generateFaq(ctx: PipelineContext): Promise<void> {
  const { topic, model } = ctx.config;
  const title = ctx.courseDescription?.title ?? topic;
  const topicList = ctx.courseDescription?.topics ?? [];

  const categoryHints =
    topicList.length > 0
      ? `The course covers these topics (use them to derive category names):\n${topicList.map((t, i) => `- Chapter ${i + 1}: ${t}`).join('\n')}`
      : `The course covers the topic: "${topic}"`;

  const prompt = `Generate a comprehensive FAQ page for an intelligent textbook titled "${title}" on the subject of "${topic}".

${categoryHints}

Requirements:
- Produce exactly 40–60 questions total, spread across 5–8 thematic categories.
- Each category must have a level-2 heading (## Category Name).
- Each question must use the MkDocs collapsible admonition format exactly:

??? question "Question text here?"
    Answer text here. Write 2–4 sentences that fully resolve the question.
    Use plain prose — no bullet lists inside answers unless it genuinely helps clarity.

- Questions should be authentic: what a learner would actually type into a search bar.
- Cover: foundational concepts, common misconceptions, practical application, tool/technology questions, career-relevance questions, and "how do I…" how-to questions.
- Do NOT use generic questions like "What is this course about?" — make every question domain-specific.
- Distribute Bloom's Taxonomy levels across questions (recall, understanding, application, analysis).
- Begin the document with a single introductory sentence before the first ## heading.

Output only valid markdown — no code fences around the document, no preamble, no commentary.`;

  const raw = await generate(prompt, { system: SYSTEM, model, maxTokens: 8192 });

  const docsDir = join(ctx.outputDir, 'docs');
  await mkdir(docsDir, { recursive: true });
  await writeFile(join(docsDir, 'faq.md'), raw.trim(), 'utf8');
}
