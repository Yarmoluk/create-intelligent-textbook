#!/usr/bin/env node

import { Command } from 'commander';
import path from 'node:path';
import chalk from 'chalk';
import { runPipeline } from '../pipeline.js';
import type { TextbookConfig } from '../types.js';

const program = new Command();

program
  .name('create-intelligent-textbook')
  .description('Generate complete intelligent textbooks from any topic — powered by Claude')
  .version('1.0.0')
  .argument('<topic>', 'The topic for the textbook (e.g., "Quantum Computing")')
  .option('-c, --chapters <number>', 'Number of chapters', '12')
  .option('-m, --microsims <number>', 'Number of interactive MicroSims', '5')
  .option('-n, --concepts <number>', 'Number of concepts in learning graph', '200')
  .option('-o, --output <dir>', 'Output directory', '')
  .option('--model <model>', 'Claude model to use', 'claude-sonnet-4-5')
  .option('--deploy <target>', 'Deployment target (github-pages, none)', 'none')
  .option('--repo <name>', 'GitHub repository name for deployment')
  .action(async (topic: string, opts) => {
    const outputDir = opts.output || path.resolve(process.cwd(), slugify(topic));

    const config: TextbookConfig = {
      topic,
      chapters: parseInt(opts.chapters, 10),
      microsims: parseInt(opts.microsims, 10),
      concepts: parseInt(opts.concepts, 10),
      outputDir,
      model: opts.model,
      deploy: opts.deploy as 'github-pages' | 'none',
      repoName: opts.repo,
    };

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error(chalk.red('\n  Error: ANTHROPIC_API_KEY environment variable is required.\n'));
      console.error(chalk.gray('  Set it with: export ANTHROPIC_API_KEY="your-key"\n'));
      process.exit(1);
    }

    try {
      await runPipeline(config);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`\n  Pipeline failed: ${msg}\n`));
      process.exit(1);
    }
  });

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

program.parse();
