"use client";

import { DIFFICULTIES, TOPIC_SUGGESTIONS } from "@/lib/difficulty";

export default function DifficultyTopicFields({
  difficulty,
  topic,
  onDifficulty,
  onTopic,
  topicOptions = [],
}: {
  difficulty: number | null;
  topic: string;
  onDifficulty: (v: number | null) => void;
  onTopic: (v: string) => void;
  /** Existing topics (e.g. from the library) offered as suggestions. */
  topicOptions?: string[];
}) {
  const options = Array.from(new Set([...topicOptions, ...TOPIC_SUGGESTIONS]));
  return (
    <div className="grid sm:grid-cols-2 gap-2.5">
      <div>
        <label className="text-[11px] text-muted block mb-1">درجه‌ی سختی</label>
        <div className="flex gap-1">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => onDifficulty(difficulty === d.value ? null : d.value)}
              className={`flex-1 px-1 py-1.5 rounded-lg text-xs font-bold border transition ${
                difficulty === d.value ? d.cls + " ring-2 ring-primary/30" : "border-line text-muted hover:border-primary/40"
              }`}
              title={d.en}
            >
              {d.fa}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-[11px] text-muted block mb-1">موضوع</label>
        <input
          list="exercise-topic-options"
          value={topic}
          onChange={(e) => onTopic(e.target.value)}
          placeholder="مثلا Python یا Mathematics"
          dir="auto"
          className="w-full border border-line rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary"
        />
        <datalist id="exercise-topic-options">
          {options.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      </div>
    </div>
  );
}
