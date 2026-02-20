import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generate } from '../claude.js';
import type { PipelineContext } from '../types.js';

const SYSTEM = `You are a technical lexicographer with expertise in ISO 11179 metadata standards and educational terminology.
You write precise, non-circular definitions that a domain newcomer can understand while satisfying a domain expert.
Every definition you write:
- States the essential nature of the concept (what kind of thing it is)
- Differentiates it from adjacent concepts
- Uses precise, unambiguous language
- Avoids circular definitions (does not define a term by using the term)`;

export default async function generateGlossary(ctx: PipelineContext): Promise<void> {
  const { topic, model } = ctx.config;
  const title = ctx.courseDescription?.title ?? topic;
  const concepts = ctx.concepts ?? [];

  const conceptList = concepts
    .map(c => `- ${c.name} (Chapter ${c.chapter}, ${c.taxonomy}, ${c.bloomLevel})`)
    .join('\n');

  const prompt = `Generate a comprehensive glossary for the intelligent textbook: "${title}"

Domain: ${topic}

The following concepts appear in the learning graph. Define each one following ISO 11179 standards for terminology:

${conceptList}

### Output Format:

Organize definitions alphabetically. Group under lettered headings (## A, ## B, etc.).

For each term, use this format:

**[Term Name]** *(Chapter N — Taxonomy)*
: [Definition following ISO 11179 standards: genus-differentia form. One to three sentences. Precise, non-circular, domain-accurate.]

### ISO 11179 Definition Standards:
1. Genus-differentia: "A [term] is a [broader category] that [distinguishing characteristic]"
2. No circular definitions: do not use the term being defined in its own definition
3. Include the essential distinguishing properties, not just examples
4. Use active voice and present tense
5. Avoid vague terms like "related to," "involving," or "concerned with"

### Additional Requirements:
- Define every concept in the list above
- After the concept list, add a section "## Key Formulas and Relationships" with 3–5 important relationships between concepts (where applicable to the domain)
- End with a section "## Further Reading" listing 3–5 key reference works for the domain

Generate the complete glossary now. Start with an introduction paragraph, then alphabetical sections.`;

  const raw = await generate(prompt, { system: SYSTEM, model, maxTokens: 8192 });

  const glossaryMd = buildGlossaryMd(title, topic, raw, concepts.length);

  const docsDir = join(ctx.outputDir, 'docs');
  await mkdir(docsDir, { recursive: true });
  await writeFile(join(docsDir, 'glossary.md'), glossaryMd, 'utf8');
}

function buildGlossaryMd(
  title: string,
  topic: string,
  raw: string,
  conceptCount: number
): string {
  // Check if raw already has the intro — if so, prepend just a header
  const hasAlphaHeaders = /^##\s+[A-Z]/m.test(raw);

  if (hasAlphaHeaders) {
    // The LLM returned well-structured content — prepend a page header
    return `# Glossary: ${title}

This glossary defines ${conceptCount} key concepts from the domain of ${topic},
following ISO 11179 metadata standards for precision and non-circularity.
Definitions are organized alphabetically and cross-referenced to the chapter where each concept is introduced.

---

${raw}
`;
  }

  // Fallback: raw content is usable as-is with a header
  return `# Glossary: ${title}

This glossary covers ${conceptCount} concepts from the domain of ${topic}.

${raw}
`;
}
