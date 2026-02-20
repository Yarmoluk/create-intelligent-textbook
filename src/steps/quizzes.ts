import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generateParallel } from '../claude.js';
import type { PipelineContext } from '../types.js';

const SYSTEM = `You are an expert assessment designer with deep knowledge of Bloom's Taxonomy.
You write multiple-choice questions that test genuine understanding, not surface recall.
Your distractors are plausible — they reflect real misconceptions, not obvious wrong answers.`;

function buildQuizPrompt(
  chapterNumber: number,
  chapterTitle: string,
  topic: string,
  chapterConcepts: string[],
): string {
  const conceptList =
    chapterConcepts.length > 0
      ? `Concepts covered in this chapter:\n${chapterConcepts.map(c => `- ${c}`).join('\n')}`
      : `This chapter covers aspects of: ${topic}`;

  return `Generate exactly 8 multiple-choice quiz questions for Chapter ${chapterNumber}: "${chapterTitle}" from an intelligent textbook on "${topic}".

${conceptList}

Requirements:
- Exactly 8 questions, numbered Q1–Q8.
- Distribute questions across Bloom's Taxonomy levels as follows (one per level, two at Apply):
  - Q1: Remember
  - Q2: Understand
  - Q3: Apply
  - Q4: Apply
  - Q5: Analyze
  - Q6: Analyze
  - Q7: Evaluate
  - Q8: Create
- Each question has exactly 4 options labeled A, B, C, D.
- One correct answer per question.
- Distractors should reflect genuine misconceptions, not obviously wrong answers.

Format each question EXACTLY like this (use this collapsible admonition pattern):

## Q1 — Remember

**Question text here?**

- A) Option A
- B) Option B
- C) Option C
- D) Option D

??? success "Answer"
    **Correct answer: B**

    Explanation: Write 2–3 sentences explaining why B is correct and why the other options are wrong.

---

Begin the file with a level-1 heading: # Chapter ${chapterNumber} Quiz: ${chapterTitle}
Add one sentence describing what this quiz covers before the first question.

Output only valid markdown — no code fences around the document, no preamble.`;
}

export default async function generateQuizzes(ctx: PipelineContext): Promise<void> {
  const { topic, model } = ctx.config;
  const chapters = ctx.chapters ?? [];
  const concepts = ctx.concepts ?? [];

  // Build concept name lookup by chapter
  const conceptsByChapter = new Map<number, string[]>();
  for (const concept of concepts) {
    const list = conceptsByChapter.get(concept.chapter) ?? [];
    list.push(concept.name);
    conceptsByChapter.set(concept.chapter, list);
  }

  // Fall back: if no chapter outlines yet, generate one quiz per configured chapter count
  const chapterList =
    chapters.length > 0
      ? chapters.map(ch => ({ number: ch.number, title: ch.title }))
      : Array.from({ length: ctx.config.chapters }, (_, i) => ({
          number: i + 1,
          title: ctx.courseDescription?.topics[i] ?? `Chapter ${i + 1}`,
        }));

  const prompts = chapterList.map(ch => ({
    prompt: buildQuizPrompt(
      ch.number,
      ch.title,
      topic,
      conceptsByChapter.get(ch.number) ?? [],
    ),
    system: SYSTEM,
  }));

  const results = await generateParallel(prompts, { model, maxTokens: 4096 });

  const quizzesDir = join(ctx.outputDir, 'docs', 'quizzes');
  await mkdir(quizzesDir, { recursive: true });

  await Promise.all(
    results.map((content, index) => {
      const chapterNum = chapterList[index].number;
      const filename = `quiz-${String(chapterNum).padStart(2, '0')}.md`;
      return writeFile(join(quizzesDir, filename), content.trim(), 'utf8');
    }),
  );
}
