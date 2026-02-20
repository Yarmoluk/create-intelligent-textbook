export interface TextbookConfig {
  topic: string;
  chapters: number;
  microsims: number;
  concepts: number;
  outputDir: string;
  model: string;
  deploy: 'github-pages' | 'none';
  repoName?: string;
}

export interface CourseDescription {
  title: string;
  subtitle: string;
  targetAudience: string;
  prerequisites: string;
  topics: string[];
  learningOutcomes: string[];
  rawMarkdown: string;
}

export interface Concept {
  id: number;
  name: string;
  chapter: number;
  dependencies: number[];
  taxonomy: string;
  bloomLevel: string;
}

export interface ChapterOutline {
  number: number;
  title: string;
  summary: string;
  concepts: number[];
}

export interface PipelineContext {
  config: TextbookConfig;
  courseDescription?: CourseDescription;
  concepts?: Concept[];
  chapters?: ChapterOutline[];
  outputDir: string;
}

export interface StepResult {
  success: boolean;
  message: string;
  data?: unknown;
}
