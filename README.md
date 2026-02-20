# create-intelligent-textbook

Generate complete intelligent textbooks with knowledge graphs, interactive simulations, and quizzes from any topic — powered by Claude.

[![npm](https://img.shields.io/badge/npm-create--intelligent--textbook-red)](https://www.npmjs.com/package/create-intelligent-textbook)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Claude](https://img.shields.io/badge/Powered%20by-Claude-blue)](https://claude.ai)

## What It Does

One command turns any topic into a fully deployed intelligent textbook:

```bash
npx create-intelligent-textbook "Quantum Computing" --chapters 12 --microsims 5
```

**Output:** A complete MkDocs Material site with:

| Component | Description |
|-----------|-------------|
| **Chapters** | 12 publication-quality chapters (3,000-5,000 words each) with diagrams, tables, and examples |
| **Knowledge Graph** | 200-concept learning graph with validated DAG dependencies |
| **MicroSims** | 5 interactive browser-based simulations (Chart.js) |
| **Glossary** | ISO 11179-compliant definitions for every concept |
| **Quizzes** | 96 multiple-choice questions aligned to Bloom's Taxonomy |
| **FAQ** | 40-60 frequently asked questions with detailed answers |
| **References** | Curated references organized by chapter |

## The 12-Step Pipeline

```
Topic Input
  → Course Description Generator
  → Learning Graph (200 Concepts, DAG-validated)
  → Chapter Structure (Bloom's-aligned)
  → Chapter Content (parallel generation)
  → Interactive MicroSims (Chart.js)
  → ISO 11179 Glossary
  → FAQ Generation
  → Chapter Quizzes
  → References
  → MkDocs Configuration
  → Quality Metrics
  → README Generation
```

Each step builds on the previous, creating a coherent textbook where every concept, quiz question, and simulation maps back to the knowledge graph.

## Quick Start

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)
- Python with `mkdocs-material` (for serving/deploying)

### Install & Run

```bash
# Set your API key
export ANTHROPIC_API_KEY="your-key"

# Generate a textbook
npx create-intelligent-textbook "Machine Learning Fundamentals"

# Or install globally
npm install -g create-intelligent-textbook
create-intelligent-textbook "Cybersecurity Basics" --chapters 8 --microsims 3
```

### Serve Locally

```bash
cd machine-learning-fundamentals
pip install mkdocs-material
mkdocs serve
```

Open [http://localhost:8000](http://localhost:8000).

### Deploy to GitHub Pages

```bash
cd machine-learning-fundamentals
mkdocs gh-deploy
```

## CLI Options

| Option | Default | Description |
|--------|---------|-------------|
| `<topic>` | *required* | The topic for the textbook |
| `-c, --chapters` | 12 | Number of chapters |
| `-m, --microsims` | 5 | Number of interactive MicroSims |
| `-n, --concepts` | 200 | Number of concepts in knowledge graph |
| `-o, --output` | `./topic-slug` | Output directory |
| `--model` | `claude-sonnet-4-5` | Claude model to use |
| `--deploy` | `none` | Deployment target (`github-pages`, `none`) |
| `--repo` | — | GitHub repository name |

## How It Works

The CLI orchestrates Claude through a 12-step pipeline:

1. **Course Description** — Generates title, audience, prerequisites, learning outcomes at all 6 Bloom's levels
2. **Learning Graph** — Creates 200 concepts as a directed acyclic graph with dependencies
3. **Chapter Structure** — Designs chapter outlines mapped to concepts
4. **Chapter Content** — Generates all chapters in parallel (3,000-5,000 words each with mermaid diagrams, tables, admonitions)
5. **MicroSims** — Creates interactive HTML simulations using Chart.js
6. **Glossary** — ISO 11179-compliant definitions for every concept
7. **FAQ** — 40-60 questions organized by topic with collapsible answers
8. **Quizzes** — 8 questions per chapter across Bloom's Taxonomy levels
9. **References** — 8-10 curated references per chapter
10. **MkDocs Config** — Full MkDocs Material configuration with navigation, theme, and extensions
11. **Metrics** — Quality report with word counts, concept coverage, and statistics
12. **README** — GitHub-ready README with badges, metrics, and getting started guide

## Programmatic API

```typescript
import { runPipeline } from 'create-intelligent-textbook';

await runPipeline({
  topic: 'Quantum Computing',
  chapters: 12,
  microsims: 5,
  concepts: 200,
  outputDir: './quantum-computing',
  model: 'claude-sonnet-4-5',
  deploy: 'none',
});
```

## Built With

- [Claude](https://claude.ai) (Anthropic) — AI content generation
- [MkDocs Material](https://squidfunk.github.io/mkdocs-material/) — Documentation framework
- [Chart.js](https://www.chartjs.org/) — Interactive visualizations
- [Commander.js](https://github.com/tj/commander.js/) — CLI framework
- [TypeScript](https://www.typescriptlang.org/) — Type-safe implementation

## License

MIT
