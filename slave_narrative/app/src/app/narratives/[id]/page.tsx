import Link from "next/link";
import { notFound } from "next/navigation";
import { getNarrative } from "@/lib/queries/narratives";
import { getSegmentsByNarrative } from "@/lib/queries/segments";

export default async function NarrativePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const narrativeId = parseInt(id, 10);
  if (isNaN(narrativeId)) notFound();

  const narrative = getNarrative(narrativeId);
  if (!narrative) notFound();

  const segments = getSegmentsByNarrative(narrativeId);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/narratives"
        className="text-sm text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
      >
        ← All Narratives
      </Link>

      <header className="mt-6">
        <h1 className="font-serif text-3xl font-bold leading-tight">
          {narrative.title}
        </h1>
        {narrative.author && (
          <p className="mt-2 text-lg text-stone-600 dark:text-stone-400">
            {narrative.author}
          </p>
        )}
        <div className="mt-2 flex gap-3 text-sm text-stone-500">
          {narrative.pub_year && (
            <span>
              {narrative.pub_year_approximate ? "c. " : ""}
              {narrative.pub_year}
            </span>
          )}
          {narrative.pub_place && <span>{narrative.pub_place}</span>}
          <span>{narrative.word_count?.toLocaleString()} words</span>
          <span>{segments.length} segments</span>
        </div>
      </header>

      <article className="mt-10 space-y-4">
        {segments.map((seg) => {
          if (seg.type === "chapter_heading") {
            return (
              <h2
                key={seg.id}
                id={`seg-${seg.segment_index}`}
                className="mt-8 font-serif text-xl font-bold"
              >
                {seg.text}
              </h2>
            );
          }
          if (seg.type === "heading") {
            return (
              <h3
                key={seg.id}
                id={`seg-${seg.segment_index}`}
                className="mt-6 font-serif text-lg font-bold"
              >
                {seg.text}
              </h3>
            );
          }
          if (seg.type === "verse") {
            return (
              <blockquote
                key={seg.id}
                id={`seg-${seg.segment_index}`}
                className="whitespace-pre-line border-l-2 border-amber-600 pl-4 italic text-stone-700 dark:text-stone-300"
              >
                {seg.text}
              </blockquote>
            );
          }
          return (
            <p
              key={seg.id}
              id={`seg-${seg.segment_index}`}
              className="leading-relaxed text-stone-800 dark:text-stone-200"
            >
              {seg.text}
            </p>
          );
        })}
      </article>

      <footer className="mt-16 border-t border-stone-200 pt-6 text-sm text-stone-500 dark:border-stone-700">
        {narrative.docsouth_url && (
          <a
            href={narrative.docsouth_url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-stone-700 dark:hover:text-stone-300"
          >
            View on Documenting the American South
          </a>
        )}
      </footer>
    </div>
  );
}
