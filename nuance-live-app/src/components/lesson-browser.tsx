"use client";

import { useState } from "react";
import { ROADMAP, type Lesson } from "@/lib/roadmap";

type Props = {
  onLessonOpen: (lesson: Lesson) => void;
  onLessonClose: () => void;
};

export default function LessonBrowser({ onLessonOpen, onLessonClose }: Props) {
  const [openLessonId, setOpenLessonId] = useState<string | null>(null);

  const weeks = [1, 2, 3, 4] as const;
  const weekLabels = ["Foundations", "Prompting", "Applied AI", "Your Workflow"];

  const handleOpen = (lesson: Lesson) => {
    setOpenLessonId(lesson.lesson_id);
    onLessonOpen(lesson);
  };

  const handleClose = () => {
    setOpenLessonId(null);
    onLessonClose();
  };

  const openLesson = ROADMAP.find((l) => l.lesson_id === openLessonId);

  return (
    <div className="w-full">
      {openLesson ? (
        <div>
          <button
            onClick={handleClose}
            className="text-sm text-gray-400 hover:text-white mb-3 cursor-pointer"
          >
            ← Back to lessons
          </button>
          <h3 className="text-lg font-semibold mb-1">{openLesson.title}</h3>
          <p className="text-xs text-gray-500 mb-3">
            Week {openLesson.week} · {weekLabels[openLesson.week - 1]}
          </p>
          <p className="text-sm text-gray-300 leading-relaxed">
            {openLesson.summary}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {weeks.map((week) => (
            <div key={week}>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Week {week}: {weekLabels[week - 1]}
              </h3>
              <div className="space-y-1">
                {ROADMAP.filter((l) => l.week === week).map((lesson) => (
                  <button
                    key={lesson.lesson_id}
                    onClick={() => handleOpen(lesson)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors cursor-pointer"
                  >
                    {lesson.title}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
