"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Scrollama, Step } from "react-scrollama";

interface ResolvedSegment {
  id: number;
  text: string;
  type: string;
  narrativeId: number;
  segmentIndex: number;
  narrativeTitle: string;
}

interface BeatWithText {
  id: string;
  order: number;
  commentary?: string | null;
  context_card?: { title: string; content: string };
  lens_tags?: string[];
  citation: {
    narrative_id: number;
    segment_range: { start_index: number; end_index: number };
    chapter?: string;
    page?: string;
  };
  resolvedSegments: ResolvedSegment[];
}

interface EpisodeInfo {
  title: string;
  description: string | null;
  slug: string;
  contentWarnings: string[];
  themeTags: string[];
  durationMinutes: number;
}

interface EpisodePlayerProps {
  episode: EpisodeInfo;
  beats: BeatWithText[];
}

export default function EpisodePlayer({ episode, beats }: EpisodePlayerProps) {
  const [currentBeatIndex, setCurrentBeatIndex] = useState(0);
  const [expandedContext, setExpandedContext] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(
    episode.contentWarnings.length === 0
  );

  const onStepEnter = useCallback(
    ({ data }: { data: number }) => {
      setCurrentBeatIndex(data);
    },
    []
  );

  if (!hasStarted) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-lg text-center">
          <h1 className="font-serif text-3xl font-bold">{episode.title}</h1>
          <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-6 text-left dark:border-amber-700 dark:bg-amber-950/30">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              Content Note
            </p>
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
              This episode contains firsthand accounts that include:{" "}
              {episode.contentWarnings.join(", ")}. These are the words of real
              people documenting their experiences.
            </p>
          </div>
          <button
            onClick={() => setHasStarted(true)}
            className="mt-6 rounded-full bg-amber-800 px-8 py-3 font-medium text-white hover:bg-amber-900"
          >
            Continue to Episode
          </button>
          <p className="mt-3">
            <Link
              href="/episodes"
              className="text-sm text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
            >
              ← Back to Episodes
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur dark:border-stone-700 dark:bg-stone-900/90">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <Link
            href="/episodes"
            className="text-sm text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
          >
            ← Episodes
          </Link>
          <span className="text-sm text-stone-500">
            {currentBeatIndex + 1} / {beats.length}
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-0.5 bg-stone-100 dark:bg-stone-800">
          <div
            className="h-full bg-amber-700 transition-all duration-300"
            style={{
              width: `${((currentBeatIndex + 1) / beats.length) * 100}%`,
            }}
          />
        </div>
      </header>

      {/* Episode title */}
      <div className="mx-auto max-w-3xl px-6 pb-8 pt-16 text-center">
        <h1 className="font-serif text-4xl font-bold">{episode.title}</h1>
        {episode.description && (
          <p className="mt-4 text-lg text-stone-600 dark:text-stone-400">
            {episode.description}
          </p>
        )}
        <div className="mt-4 flex justify-center gap-2">
          {episode.themeTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
            >
              {tag}
            </span>
          ))}
        </div>
        <p className="mt-6 text-sm text-stone-400">Scroll to begin ↓</p>
      </div>

      {/* Scrollama beats */}
      <Scrollama onStepEnter={onStepEnter} offset={0.4}>
        {beats.map((beat, idx) => (
          <Step key={beat.id} data={idx}>
            <div className="mx-auto max-w-3xl px-6 py-16">
              <div
                className={`transition-opacity duration-500 ${
                  currentBeatIndex === idx ? "opacity-100" : "opacity-40"
                }`}
              >
                {/* Primary source quote */}
                <blockquote className="rounded-lg border-l-4 border-amber-600 bg-source-bg p-6 font-serif text-lg leading-relaxed">
                  {beat.resolvedSegments.map((seg) => (
                    <p key={seg.id} className="mt-2 first:mt-0">
                      {seg.text}
                    </p>
                  ))}
                </blockquote>

                {/* Citation */}
                <div className="mt-3 flex items-center gap-2 text-sm text-stone-500">
                  <span className="font-medium">Source:</span>
                  {beat.resolvedSegments[0] && (
                    <>
                      <span>{beat.resolvedSegments[0].narrativeTitle}</span>
                      {beat.citation.chapter && (
                        <span>· {beat.citation.chapter}</span>
                      )}
                      <Link
                        href={`/narratives/${beat.citation.narrative_id}#seg-${beat.resolvedSegments[0].segmentIndex}`}
                        className="text-amber-700 hover:text-amber-900 dark:text-amber-400"
                      >
                        Open in narrative →
                      </Link>
                    </>
                  )}
                </div>

                {/* Commentary (clearly labeled as app commentary) */}
                {beat.commentary && (
                  <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-800">
                    <p className="text-xs font-medium uppercase tracking-wider text-stone-400">
                      Commentary
                    </p>
                    <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
                      {beat.commentary}
                    </p>
                  </div>
                )}

                {/* Context card (expand/collapse) */}
                {beat.context_card && (
                  <div className="mt-4">
                    <button
                      onClick={() =>
                        setExpandedContext(
                          expandedContext === beat.id ? null : beat.id
                        )
                      }
                      className="text-sm font-medium text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300"
                    >
                      {expandedContext === beat.id ? "Hide" : "Show"} Context:{" "}
                      {beat.context_card.title}
                    </button>
                    {expandedContext === beat.id && (
                      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/30">
                        <p className="text-stone-700 dark:text-stone-300">
                          {beat.context_card.content}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Lens tags */}
                {beat.lens_tags && beat.lens_tags.length > 0 && (
                  <div className="mt-3 flex gap-1.5">
                    {beat.lens_tags.map((lens) => (
                      <span
                        key={lens}
                        className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600 dark:bg-stone-700 dark:text-stone-400"
                      >
                        {lens}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Step>
        ))}
      </Scrollama>

      {/* End card */}
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="font-serif text-xl text-stone-600 dark:text-stone-400">
          End of episode.
        </p>
        <div className="mt-6 flex justify-center gap-4">
          <Link
            href="/episodes"
            className="rounded-full border border-stone-300 px-6 py-2.5 text-sm font-medium hover:bg-stone-50 dark:border-stone-600 dark:hover:bg-stone-800"
          >
            More Episodes
          </Link>
        </div>
        <p className="mt-8 text-xs text-stone-400">
          All quotes are primary source material from Documenting the American
          South, UNC Chapel Hill.
        </p>
      </div>
    </div>
  );
}
