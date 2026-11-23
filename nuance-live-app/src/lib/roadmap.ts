export type Lesson = {
  lesson_id: string;
  title: string;
  week: number;
};

export const ROADMAP: Lesson[] = [
  { lesson_id: "week1-lesson1", title: "What Is AI? A Plain-English Overview", week: 1 },
  { lesson_id: "week1-lesson2", title: "How Businesses Use AI Today", week: 1 },
  { lesson_id: "week1-lesson3", title: "AI Vocabulary You Actually Need", week: 1 },
  { lesson_id: "week2-lesson1", title: "Your First Prompt: Talking to ChatGPT", week: 2 },
  { lesson_id: "week2-lesson2", title: "Prompt Patterns That Work", week: 2 },
  { lesson_id: "week2-lesson3", title: "When AI Gets It Wrong: Hallucinations", week: 2 },
  { lesson_id: "week3-lesson1", title: "AI for Writing and Communication", week: 3 },
  { lesson_id: "week3-lesson2", title: "AI for Data and Decision-Making", week: 3 },
  { lesson_id: "week3-lesson3", title: "Picking the Right AI Tool for the Job", week: 3 },
  { lesson_id: "week4-lesson1", title: "Building a Personal AI Workflow", week: 4 },
  { lesson_id: "week4-lesson2", title: "AI Ethics and Responsible Use", week: 4 },
  { lesson_id: "week4-lesson3", title: "Your AI Fluency Roadmap: What's Next", week: 4 },
];

export function getLessonById(lessonId: string): Lesson | undefined {
  return ROADMAP.find((l) => l.lesson_id === lessonId);
}

export function getNextLesson(currentLessonId: string): Lesson | undefined {
  const idx = ROADMAP.findIndex((l) => l.lesson_id === currentLessonId);
  if (idx === -1 || idx === ROADMAP.length - 1) return undefined;
  return ROADMAP[idx + 1];
}
