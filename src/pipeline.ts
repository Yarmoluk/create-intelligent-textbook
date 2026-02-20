import chalk from 'chalk';
import ora from 'ora';
import type { PipelineContext, TextbookConfig } from './types.js';

import courseDescription from './steps/course-description.js';
import learningGraph from './steps/learning-graph.js';
import chapterStructure from './steps/chapter-structure.js';
import chapterContent from './steps/chapter-content.js';
import microsims from './steps/microsims.js';
import glossary from './steps/glossary.js';
import faq from './steps/faq.js';
import quizzes from './steps/quizzes.js';
import references from './steps/references.js';
import mkdocsConfig from './steps/mkdocs-config.js';
import metrics from './steps/metrics.js';
import readme from './steps/readme.js';

interface PipelineStep {
  name: string;
  emoji: string;
  fn: (ctx: PipelineContext) => Promise<void>;
}

const steps: PipelineStep[] = [
  { name: 'Course Description', emoji: '1', fn: courseDescription },
  { name: 'Learning Graph', emoji: '2', fn: learningGraph },
  { name: 'Chapter Structure', emoji: '3', fn: chapterStructure },
  { name: 'Chapter Content', emoji: '4', fn: chapterContent },
  { name: 'MicroSims', emoji: '5', fn: microsims },
  { name: 'Glossary', emoji: '6', fn: glossary },
  { name: 'FAQ', emoji: '7', fn: faq },
  { name: 'Quizzes', emoji: '8', fn: quizzes },
  { name: 'References', emoji: '9', fn: references },
  { name: 'MkDocs Config', emoji: '10', fn: mkdocsConfig },
  { name: 'Metrics', emoji: '11', fn: metrics },
  { name: 'README', emoji: '12', fn: readme },
];

export async function runPipeline(config: TextbookConfig): Promise<void> {
  const ctx: PipelineContext = {
    config,
    outputDir: config.outputDir,
  };

  console.log(chalk.bold.blue('\n  create-intelligent-textbook\n'));
  console.log(chalk.gray(`  Topic: ${chalk.white(config.topic)}`));
  console.log(chalk.gray(`  Chapters: ${config.chapters} | Concepts: ${config.concepts} | MicroSims: ${config.microsims}`));
  console.log(chalk.gray(`  Model: ${config.model}`));
  console.log(chalk.gray(`  Output: ${config.outputDir}\n`));

  const totalStart = Date.now();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const spinner = ora({
      text: chalk.cyan(`[${i + 1}/${steps.length}] ${step.name}`),
      color: 'cyan',
    }).start();

    const stepStart = Date.now();

    try {
      await step.fn(ctx);
      const elapsed = ((Date.now() - stepStart) / 1000).toFixed(1);
      spinner.succeed(
        chalk.green(`[${i + 1}/${steps.length}] ${step.name}`) +
        chalk.gray(` (${elapsed}s)`)
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      spinner.fail(chalk.red(`[${i + 1}/${steps.length}] ${step.name}: ${msg}`));
      throw error;
    }
  }

  const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1);

  console.log(chalk.bold.green(`\n  Done in ${totalElapsed}s\n`));
  console.log(chalk.gray(`  Output: ${config.outputDir}`));

  if (config.deploy === 'github-pages') {
    console.log(chalk.gray(`  Deploy: Run 'cd ${config.outputDir} && mkdocs gh-deploy' to publish`));
  }

  console.log('');
}
