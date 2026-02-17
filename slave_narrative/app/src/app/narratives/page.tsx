import Link from "next/link";
import { listNarratives } from "@/lib/queries/narratives";

export default function NarrativesPage() {
  const narratives = listNarratives();

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Link
        href="/"
        className="text-sm text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
      >
        ← Home
      </Link>
      <h1 className="mt-6 font-serif text-3xl font-bold">
        Browse Narratives
      </h1>
      <p className="mt-2 text-stone-600 dark:text-stone-400">
        {narratives.length} firsthand narratives from Documenting the American
        South.
      </p>

      <div className="mt-8 divide-y divide-stone-200 dark:divide-stone-700">
        {narratives.map((n) => (
          <Link
            key={n.id}
            href={`/narratives/${n.id}`}
            className="-mx-2 block rounded px-2 py-4 transition-colors hover:bg-stone-50 dark:hover:bg-stone-800"
          >
            <p className="font-serif text-lg font-medium">{n.title}</p>
            <p className="mt-1 text-sm text-stone-500">
              {n.author && <span>{n.author}</span>}
              {n.author && n.pub_year && <span> · </span>}
              {n.pub_year && (
                <span>
                  {n.pub_year_approximate ? "c. " : ""}
                  {n.pub_year}
                </span>
              )}
              {(n.author || n.pub_year) && <span> · </span>}
              <span>{n.word_count?.toLocaleString()} words</span>
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
