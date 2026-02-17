import Link from "next/link";
import { searchSegments } from "@/lib/queries/segments";
import { db } from "@/lib/db";
import type { NarrativeRow } from "@/lib/db-types";

interface SearchPageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

const PAGE_SIZE = 20;

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q, page } = await searchParams;
  const query = q?.trim() || "";
  const currentPage = Math.max(1, parseInt(page || "1", 10));
  const offset = (currentPage - 1) * PAGE_SIZE;

  const { segments, total } = query
    ? searchSegments(query, PAGE_SIZE, offset)
    : { segments: [], total: 0 };

  // Get narrative titles for results
  const narrativeIds = [...new Set(segments.map((s) => s.narrative_id))];
  const narrativeMap = new Map<number, string>();
  if (narrativeIds.length > 0) {
    const placeholders = narrativeIds.map(() => "?").join(",");
    const rows = db
      .prepare(`SELECT id, title FROM narratives WHERE id IN (${placeholders})`)
      .all(...narrativeIds) as Pick<NarrativeRow, "id" | "title">[];
    for (const r of rows) narrativeMap.set(r.id, r.title);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Link
        href="/"
        className="text-sm text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
      >
        ← Home
      </Link>
      <h1 className="mt-6 font-serif text-3xl font-bold">Search Narratives</h1>

      <form className="mt-6" action="/search" method="GET">
        <div className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search across all narratives..."
            className="flex-1 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-stone-800 placeholder:text-stone-400 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
          />
          <button
            type="submit"
            className="rounded-lg bg-amber-800 px-6 py-2.5 font-medium text-white hover:bg-amber-900"
          >
            Search
          </button>
        </div>
      </form>

      {query && (
        <p className="mt-4 text-sm text-stone-500">
          {total} result{total !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
          {totalPages > 1 && ` · Page ${currentPage} of ${totalPages}`}
        </p>
      )}

      <div className="mt-6 space-y-6">
        {segments.map((seg) => (
          <div
            key={seg.id}
            className="rounded-lg border border-stone-200 p-4 dark:border-stone-700"
          >
            <p className="text-sm font-medium text-amber-800 dark:text-amber-500">
              {narrativeMap.get(seg.narrative_id) || "Unknown"}
              {seg.chapter_heading && (
                <span className="text-stone-500">
                  {" "}
                  · {seg.chapter_heading}
                </span>
              )}
            </p>
            <p className="mt-2 leading-relaxed text-stone-700 dark:text-stone-300">
              {seg.text.length > 400
                ? seg.text.slice(0, 400) + "…"
                : seg.text}
            </p>
            <Link
              href={`/narratives/${seg.narrative_id}#seg-${seg.segment_index}`}
              className="mt-2 inline-block text-sm text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300"
            >
              Open in narrative →
            </Link>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <nav className="mt-8 flex justify-center gap-2">
          {currentPage > 1 && (
            <Link
              href={`/search?q=${encodeURIComponent(query)}&page=${currentPage - 1}`}
              className="rounded border border-stone-300 px-3 py-1 text-sm hover:bg-stone-50 dark:border-stone-600 dark:hover:bg-stone-800"
            >
              Previous
            </Link>
          )}
          {currentPage < totalPages && (
            <Link
              href={`/search?q=${encodeURIComponent(query)}&page=${currentPage + 1}`}
              className="rounded border border-stone-300 px-3 py-1 text-sm hover:bg-stone-50 dark:border-stone-600 dark:hover:bg-stone-800"
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
