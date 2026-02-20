import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { PipelineContext } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function countWordsInFile(filePath: string): Promise<number> {
  try {
    const content = await readFile(filePath, 'utf8');
    // Strip markdown syntax for a rough word count
    const stripped = content
      .replace(/```[\s\S]*?```/g, '')   // code blocks
      .replace(/`[^`]+`/g, '')           // inline code
      .replace(/#{1,6}\s/g, '')          // headings
      .replace(/[*_~[\]()#>|]/g, '')     // markdown symbols
      .replace(/https?:\/\/\S+/g, '')    // URLs
      .replace(/\s+/g, ' ')
      .trim();
    return stripped ? stripped.split(' ').length : 0;
  } catch {
    return 0;
  }
}

async function countWordsInDir(dir: string, glob = '*.md'): Promise<number> {
  try {
    const entries = await readdir(dir);
    const mdFiles = entries.filter(f => f.endsWith('.md'));
    const counts = await Promise.all(
      mdFiles.map(f => countWordsInFile(join(dir, f))),
    );
    return counts.reduce((a, b) => a + b, 0);
  } catch {
    return 0;
  }
}

async function countFilesInDir(dir: string, ext = '.md'): Promise<number> {
  try {
    const entries = await readdir(dir);
    return entries.filter(f => f.endsWith(ext)).length;
  } catch {
    return 0;
  }
}

async function countPatternInFile(
  filePath: string,
  pattern: RegExp,
): Promise<number> {
  try {
    const content = await readFile(filePath, 'utf8');
    return (content.match(pattern) ?? []).length;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Main step
// ---------------------------------------------------------------------------

export default async function generateMetrics(ctx: PipelineContext): Promise<void> {
  const docsDir = join(ctx.outputDir, 'docs');
  const chaptersDir = join(docsDir, 'chapters');
  const microsimDir = join(docsDir, 'microsims');
  const quizzesDir = join(docsDir, 'quizzes');
  const graphDir = join(docsDir, 'learning-graph');

  // --- Chapter count ---
  const chapterCount =
    ctx.chapters?.length ??
    ctx.courseDescription?.topics.length ??
    ctx.config.chapters;

  // --- Actual files on disk ---
  const chapterFiles = await countFilesInDir(chaptersDir);
  const microsimFiles = await countFilesInDir(microsimDir);
  const quizFiles = await countFilesInDir(quizzesDir);

  // --- Word count (approximate) ---
  const chapterWords = await countWordsInDir(chaptersDir);
  const otherFiles = [
    join(docsDir, 'course-description.md'),
    join(docsDir, 'glossary.md'),
    join(docsDir, 'faq.md'),
    join(docsDir, 'references.md'),
    join(docsDir, 'index.md'),
    join(docsDir, 'about.md'),
  ];
  const otherWordCounts = await Promise.all(otherFiles.map(countWordsInFile));
  const totalWords = chapterWords + otherWordCounts.reduce((a, b) => a + b, 0);

  // --- Concept count ---
  const conceptCount = ctx.concepts?.length ?? ctx.config.concepts;

  // --- Glossary term count ---
  const glossaryTerms = await countPatternInFile(
    join(docsDir, 'glossary.md'),
    /^##\s+/gm,
  );

  // --- Quiz question count (8 per chapter by design) ---
  const quizQuestions = quizFiles * 8;

  // --- FAQ question count ---
  const faqQuestions = await countPatternInFile(
    join(docsDir, 'faq.md'),
    /^\?\?\?\s+question/gm,
  );

  // --- MicroSim count ---
  const microsimCount = microsimFiles || ctx.config.microsims;

  const now = new Date().toISOString().split('T')[0];

  const tableRows = [
    ['Chapters', String(chapterFiles || chapterCount)],
    ['Estimated Total Words', totalWords.toLocaleString()],
    ['Concepts Mapped', String(conceptCount)],
    ['MicroSims', String(microsimCount)],
    ['Glossary Terms', String(glossaryTerms)],
    ['Quiz Questions', String(quizQuestions)],
    ['FAQ Questions', String(faqQuestions || '40–60')],
  ];

  const tableMarkdown = [
    '| Metric | Value |',
    '|--------|-------|',
    ...tableRows.map(([k, v]) => `| ${k} | ${v} |`),
  ].join('\n');

  const content = `# Book Metrics

*Generated on ${now}*

This page tracks the scope and coverage of the textbook as generated.

## Summary Table

${tableMarkdown}

## Notes

- **Word count** is approximate — it excludes code blocks, URLs, and markdown syntax.
- **Glossary terms** are counted as level-2 headings (\`## Term\`) in \`glossary.md\`.
- **Quiz questions** assumes 8 questions per chapter (distributed across Bloom's Taxonomy levels).
- **FAQ questions** are counted as \`??? question\` admonitions in \`faq.md\`.
- **MicroSims** are standalone interactive simulations, one per chapter by default.

## Chapter Coverage

| Chapter | Title | Concepts |
|---------|-------|----------|
${(ctx.chapters ?? [])
  .map(
    ch =>
      `| ${ch.number} | ${ch.title} | ${ch.concepts?.length ?? '—'} |`,
  )
  .join('\n') || '| — | Content was generated without chapter outline data | — |'}
`;

  const graphDir2 = join(docsDir, 'learning-graph');
  await mkdir(graphDir2, { recursive: true });
  await writeFile(join(graphDir2, 'book-metrics.md'), content, 'utf8');
}
