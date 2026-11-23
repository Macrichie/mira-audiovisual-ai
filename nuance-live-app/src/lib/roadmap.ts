export type Lesson = {
  lesson_id: string;
  title: string;
  week: number;
  summary: string;
};

export const ROADMAP: Lesson[] = [
  { lesson_id: "week1-lesson1", title: "What Is AI? A Plain-English Overview", week: 1, summary: "Artificial intelligence is software that learns from examples instead of following fixed rules. This lesson covers the difference between narrow AI (good at one task) and general AI (still science fiction), and why the recent breakthroughs happened now." },
  { lesson_id: "week1-lesson2", title: "How Businesses Use AI Today", week: 1, summary: "From chatbots to supply-chain forecasting, AI is already in most industries. This lesson walks through real examples in marketing, finance, healthcare, and operations so you can spot where AI fits in your own work." },
  { lesson_id: "week1-lesson3", title: "AI Vocabulary You Actually Need", week: 1, summary: "Machine learning, neural network, large language model, token, fine-tuning, hallucination — this lesson defines the terms you will hear in every AI conversation, without the math." },
  { lesson_id: "week2-lesson1", title: "Your First Prompt: Talking to ChatGPT", week: 2, summary: "A prompt is an instruction you give an AI. This lesson has you write your first prompts, see what works, and understand why the same question can get very different answers depending on how you phrase it." },
  { lesson_id: "week2-lesson2", title: "Prompt Patterns That Work", week: 2, summary: "Role prompts, chain-of-thought, few-shot examples, and constraints. This lesson teaches four patterns that reliably improve AI output, with before-and-after comparisons you can try yourself." },
  { lesson_id: "week2-lesson3", title: "When AI Gets It Wrong: Hallucinations", week: 2, summary: "AI can confidently state things that are false. This lesson explains why hallucinations happen, how to spot them, and practical strategies for fact-checking AI output before you use it." },
  { lesson_id: "week3-lesson1", title: "AI for Writing and Communication", week: 3, summary: "Drafting emails, summarizing documents, translating tone — AI can handle the first pass of many writing tasks. This lesson shows how to use AI as a writing partner while keeping your own voice." },
  { lesson_id: "week3-lesson2", title: "AI for Data and Decision-Making", week: 3, summary: "You do not need to be a data scientist to use AI on data. This lesson covers how to ask AI to analyze spreadsheets, find trends, and present findings in plain language." },
  { lesson_id: "week3-lesson3", title: "Picking the Right AI Tool for the Job", week: 3, summary: "ChatGPT, Claude, Gemini, Copilot, Midjourney — there are dozens of AI tools. This lesson gives you a framework for choosing the right one based on your task, budget, and privacy needs." },
  { lesson_id: "week4-lesson1", title: "Building a Personal AI Workflow", week: 4, summary: "This lesson helps you design a repeatable workflow: which tasks to delegate to AI, which to keep, and how to build a daily routine that makes AI a natural part of your work." },
  { lesson_id: "week4-lesson2", title: "AI Ethics and Responsible Use", week: 4, summary: "Bias, privacy, copyright, and job displacement — AI raises real concerns. This lesson covers the ethical questions every professional should think about and practical guidelines for responsible use." },
  { lesson_id: "week4-lesson3", title: "Your AI Fluency Roadmap: What's Next", week: 4, summary: "You have finished the core roadmap. This lesson maps out where to go next: deeper skills, communities, certifications, and how to stay current as AI evolves." },
];

export function getLessonById(lessonId: string): Lesson | undefined {
  return ROADMAP.find((l) => l.lesson_id === lessonId);
}

export function getNextLesson(currentLessonId: string): Lesson | undefined {
  const idx = ROADMAP.findIndex((l) => l.lesson_id === currentLessonId);
  if (idx === -1 || idx === ROADMAP.length - 1) return undefined;
  return ROADMAP[idx + 1];
}
