import Link from "next/link";
import { listPublishedEpisodes } from "@/lib/queries/episodes";

export default function EpisodesPage() {
  const episodes = listPublishedEpisodes();

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Link
        href="/"
        className="text-sm text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
      >
        ← Home
      </Link>
      <h1 className="mt-6 font-serif text-3xl font-bold">Episodes</h1>
      <p className="mt-2 text-stone-600 dark:text-stone-400">
        Guided storytelling experiences built from firsthand slave narratives.
      </p>

      {episodes.length === 0 ? (
        <p className="mt-8 text-stone-500">
          No episodes published yet. Check back soon.
        </p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {episodes.map((ep) => (
            <Link
              key={ep.id}
              href={`/episodes/${ep.slug}`}
              className="group rounded-xl border border-stone-200 p-6 transition-colors hover:border-amber-600 dark:border-stone-700 dark:hover:border-amber-500"
            >
              <h2 className="font-serif text-xl font-bold group-hover:text-amber-800 dark:group-hover:text-amber-400">
                {ep.title}
              </h2>
              {ep.description && (
                <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
                  {ep.description}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {ep.theme_tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs text-stone-500">
                ~{ep.duration_minutes} min · {ep.beats.length} excerpt
                {ep.beats.length !== 1 ? "s" : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
