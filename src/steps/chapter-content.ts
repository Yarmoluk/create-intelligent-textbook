import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generateParallel } from '../claude.js';
import type { PipelineContext, ChapterOutline, Concept } from '../types.js';

const SYSTEM = `You are an expert technical author and educator producing content for an intelligent textbook.
Your writing is rigorous, precise, and engaging. You use concrete examples, analogies, and visual structures
(tables, diagrams, callout boxes) to make complex ideas accessible without sacrificing depth.
You write for practitioners who want to genuinely understand a domain, not just pass a test.`;

export default async function generateChapterContent(ctx: PipelineContext): Promise<void> {
  const { topic, model } = ctx.config;
  const title = ctx.courseDescription?.title ?? topic;
  const chapters = ctx.chapters ?? [];
  const concepts = ctx.concepts ?? [];

  if (chapters.length === 0) {
    throw new Error('Chapter structure must be generated before chapter content.');
  }

  // Build prompts for all chapters
  const prompts = chapters.map(ch => ({
    prompt: buildChapterPrompt(ch, concepts, title, topic),
    system: SYSTEM,
  }));

  const results = await generateParallel(prompts, { model, maxTokens: 16384 });

  // Write each chapter as a flat file: docs/chapters/chapter-NN.md
  // (matches the mkdocs nav convention in mkdocs-config.ts)
  const chaptersDir = join(ctx.outputDir, 'docs', 'chapters');
  await mkdir(chaptersDir, { recursive: true });

  await Promise.all(
    chapters.map(async (ch, i) => {
      const content = results[i] ?? `# Chapter ${ch.number}: ${ch.title}\n\nContent generation failed.`;
      const paddedNum = String(ch.number).padStart(2, '0');
      const filename = `chapter-${paddedNum}.md`;
      await writeFile(join(chaptersDir, filename), content, 'utf8');
    })
  );
}

function buildChapterPrompt(
  ch: ChapterOutline,
  allConcepts: Concept[],
  textbookTitle: string,
  topic: string
): string {
  const chapterConcepts = allConcepts.filter(c => ch.concepts.includes(c.id));
  const conceptNames = chapterConcepts
    .map(c => `${c.id}. ${c.name} (${c.taxonomy}, ${c.bloomLevel})`)
    .join('\n');

  // Find prerequisite concepts from prior chapters
  const prereqIds = new Set<number>();
  for (const c of chapterConcepts) {
    for (const depId of c.dependencies) {
      const dep = allConcepts.find(x => x.id === depId);
      if (dep && dep.chapter < ch.number) prereqIds.add(depId);
    }
  }
  const prereqNames = [...prereqIds]
    .map(id => allConcepts.find(c => c.id === id)?.name)
    .filter(Boolean)
    .join(', ');

  return `Write Chapter ${ch.number} of the intelligent textbook "${textbookTitle}" on the topic of ${topic}.

## Chapter: ${ch.title}

**Chapter Summary:** ${ch.summary}

**Concepts to Cover:**
${conceptNames || '(general chapter concepts)'}

**Prerequisite Concepts (already covered):** ${prereqNames || 'None'}

---

Write a complete, publication-quality chapter of 3000–5000 words. The chapter must include:

### Required Structure:

1. **Chapter Header** — Use: \`# Chapter ${ch.number}: ${ch.title}\`

2. **Learning Objectives** — A bulleted list of 3–5 specific, measurable objectives using Bloom's action verbs.

3. **Introduction** (300–500 words) — Hook the reader with a real-world scenario or surprising insight. Establish why this chapter matters and preview the key ideas.

4. **Main Content Sections** — 4–6 sections using \`## Section Title\` headers. Each section should:
   - Cover 1–3 concepts from the list above with depth and precision
   - Include at least one of: a mermaid diagram, a comparison table, or a worked example
   - Use \`!!! note\`, \`!!! warning\`, \`!!! tip\`, or \`!!! example\` admonition boxes where appropriate

5. **Mermaid Diagrams** — Include at least 2 mermaid diagrams. Use \`\`\`mermaid\`\`\` fenced blocks. Prefer:
   - \`flowchart TD\` for processes
   - \`graph LR\` for relationships
   - \`sequenceDiagram\` for interactions

6. **Tables** — Include at least 2 markdown tables comparing concepts, listing properties, or summarizing key points.

7. **Practical Example or Case Study** — A concrete, realistic scenario showing the concepts in action. Walk through it step by step.

8. **Key Takeaways** — A bulleted summary of the 5–7 most important points from the chapter.

9. **Review Questions** — 5 questions of increasing difficulty (Remember → Create level). Mix multiple choice, short answer, and analytical questions.

10. **Further Reading** — 3–5 suggestions for going deeper (books, papers, or online resources — can be illustrative if specific titles are uncertain).

### Writing Standards:
- Use precise technical language appropriate to the domain
- Define every key term on first use
- Never be vague — if you make a claim, support it with an example, statistic, or mechanism
- Admonition syntax: \`!!! note "Title"\` followed by indented content (4 spaces)
- All mermaid diagrams must be syntactically valid
- Code examples (if relevant) must be in fenced blocks with language tag

Begin writing the chapter now. Do not include any preamble — start directly with the chapter header.`;
}
