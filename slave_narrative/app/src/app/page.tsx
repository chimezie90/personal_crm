import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <main className="max-w-2xl text-center">
        <h1 className="font-serif text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Human Lives
        </h1>
        <p className="mt-4 text-lg text-stone-600 dark:text-stone-400">
          Interactive episodes built from firsthand slave narratives.
          <br />
          Primary source storytelling that presents enslaved people as fully
          human.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/episodes"
            className="rounded-full bg-amber-800 px-8 py-3 font-medium text-white transition-colors hover:bg-amber-900"
          >
            Explore Episodes
          </Link>
          <Link
            href="/narratives"
            className="rounded-full border border-stone-300 px-8 py-3 font-medium transition-colors hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
          >
            Browse Narratives
          </Link>
        </div>

        <p className="mt-16 text-sm text-stone-500 dark:text-stone-500">
          Source:{" "}
          <a
            href="https://docsouth.unc.edu/neh/"
            className="underline hover:text-stone-700 dark:hover:text-stone-300"
            target="_blank"
            rel="noopener noreferrer"
          >
            Documenting the American South
          </a>
          , UNC Chapel Hill. CC BY 4.0.
        </p>
      </main>
    </div>
  );
}
