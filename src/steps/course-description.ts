import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generate } from '../claude.js';
import type { PipelineContext, CourseDescription } from '../types.js';

const SYSTEM = `You are an expert curriculum designer and instructional strategist.
You design rigorous, learner-centered courses following established educational frameworks.
You write with clarity, precision, and depth appropriate for professional learners.`;

export default async function generateCourseDescription(ctx: PipelineContext): Promise<void> {
  const { topic, chapters, model } = ctx.config;

  const prompt = `Design a comprehensive course description for an intelligent textbook on the topic: "${topic}"

The course will have exactly ${chapters} chapters. Generate the following in a structured markdown document:

## Course Title
A compelling, precise title (not generic — make it specific to the domain).

## Subtitle
A one-sentence subtitle that clarifies the course's unique angle or approach.

## Target Audience
2–3 sentences describing the ideal learner: their role, background, and why this course matters to them.

## Prerequisites
List specific prior knowledge or skills a learner should have before starting. Be concrete.

## Topics Covered
List exactly ${chapters} topics, one per chapter, each as a bullet point. These will become the chapter titles.
Format each as: - Chapter N: Topic Title

## Learning Outcomes
List exactly 6 learning outcomes — one for each level of Bloom's Taxonomy, in order:
1. Remember: ...
2. Understand: ...
3. Apply: ...
4. Analyze: ...
5. Evaluate: ...
6. Create: ...

Each outcome should begin with a strong action verb appropriate to that Bloom's level.

Write the full document in clean markdown. Be specific to the topic — avoid generic educational boilerplate.`;

  const raw = await generate(prompt, { system: SYSTEM, model, maxTokens: 8192 });

  const courseDescription = parseCourseDescription(raw, topic, chapters);
  ctx.courseDescription = courseDescription;

  const docsDir = join(ctx.outputDir, 'docs');
  await mkdir(docsDir, { recursive: true });
  await writeFile(join(docsDir, 'course-description.md'), courseDescription.rawMarkdown, 'utf8');
}

function parseCourseDescription(raw: string, topic: string, chapters: number): CourseDescription {
  // Extract title
  const titleMatch = raw.match(/##\s+Course Title\s*\n+([^\n#]+)/i);
  const title = titleMatch ? titleMatch[1].trim() : topic;

  // Extract subtitle
  const subtitleMatch = raw.match(/##\s+Subtitle\s*\n+([^\n#]+)/i);
  const subtitle = subtitleMatch ? subtitleMatch[1].trim() : '';

  // Extract target audience
  const audienceMatch = raw.match(/##\s+Target Audience\s*\n+([\s\S]*?)(?=\n##|\n---)/i);
  const targetAudience = audienceMatch ? audienceMatch[1].trim() : '';

  // Extract prerequisites
  const prereqMatch = raw.match(/##\s+Prerequisites\s*\n+([\s\S]*?)(?=\n##|\n---)/i);
  const prerequisites = prereqMatch ? prereqMatch[1].trim() : '';

  // Extract topics — look for bullet lines under Topics section
  const topicsMatch = raw.match(/##\s+Topics Covered\s*\n+([\s\S]*?)(?=\n##|\n---)/i);
  const topics: string[] = [];
  if (topicsMatch) {
    const lines = topicsMatch[1].split('\n');
    for (const line of lines) {
      const m = line.match(/^[-*]\s+(?:Chapter\s+\d+:\s*)?(.+)/i);
      if (m) topics.push(m[1].trim());
    }
  }
  // Pad or trim to match chapter count
  while (topics.length < chapters) topics.push(`Chapter ${topics.length + 1}`);

  // Extract learning outcomes
  const outcomesMatch = raw.match(/##\s+Learning Outcomes\s*\n+([\s\S]*?)(?=\n##|\n---|$)/i);
  const learningOutcomes: string[] = [];
  if (outcomesMatch) {
    const lines = outcomesMatch[1].split('\n');
    for (const line of lines) {
      const m = line.match(/^\d+\.\s+(?:\w+:\s*)?(.+)/);
      if (m) learningOutcomes.push(m[1].trim());
    }
  }

  return {
    title,
    subtitle,
    targetAudience,
    prerequisites,
    topics,
    learningOutcomes,
    rawMarkdown: raw,
  };
}
