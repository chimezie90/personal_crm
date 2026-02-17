import Link from "next/link";
import { db } from "@/lib/db";

interface Stats {
  narratives: number;
  segments: number;
  episodes: number;
}

function getStats(): Stats {
  const narratives = (db.prepare("SELECT COUNT(*) as c FROM narratives").get() as { c: number }).c;
  const segments = (db.prepare("SELECT COUNT(*) as c FROM segments").get() as { c: number }).c;
  const episodes = (db.prepare("SELECT COUNT(*) as c FROM episodes").get() as { c: number }).c;
  return { narratives, segments, episodes };
}

export default function AdminPage() {
  const stats = getStats();

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="font-serif text-3xl font-bold">Admin Dashboard</h1>
      <p className="mt-2 text-stone-500">Corpus management and episode builder.</p>

      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-stone-200 p-6 dark:border-stone-700">
          <p className="text-3xl font-bold">{stats.narratives}</p>
          <p className="text-sm text-stone-500">Narratives</p>
        </div>
        <div className="rounded-lg border border-stone-200 p-6 dark:border-stone-700">
          <p className="text-3xl font-bold">{stats.segments.toLocaleString()}</p>
          <p className="text-sm text-stone-500">Segments</p>
        </div>
        <div className="rounded-lg border border-stone-200 p-6 dark:border-stone-700">
          <p className="text-3xl font-bold">{stats.episodes}</p>
          <p className="text-sm text-stone-500">Episodes</p>
        </div>
      </div>

      <nav className="mt-8 flex flex-col gap-3">
        <Link
          href="/admin/narratives"
          className="rounded-lg border border-stone-200 px-4 py-3 transition-colors hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800"
        >
          Browse Narratives →
        </Link>
        <Link
          href="/admin/episodes"
          className="rounded-lg border border-stone-200 px-4 py-3 transition-colors hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800"
        >
          Manage Episodes →
        </Link>
      </nav>
    </div>
  );
}
