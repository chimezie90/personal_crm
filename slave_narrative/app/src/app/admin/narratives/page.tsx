import Link from "next/link";
import { listNarratives } from "@/lib/queries/narratives";

export default function AdminNarrativesPage() {
  const narratives = listNarratives();

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold">Narratives ({narratives.length})</h1>
        <Link href="/admin" className="text-sm text-stone-500 hover:text-stone-700">
          ← Admin
        </Link>
      </div>

      <div className="mt-6 divide-y divide-stone-200 dark:divide-stone-700">
        {narratives.map((n) => (
          <Link
            key={n.id}
            href={`/narratives/${n.id}`}
            className="block py-3 transition-colors hover:bg-stone-50 dark:hover:bg-stone-800 -mx-2 px-2 rounded"
          >
            <p className="font-medium">{n.title}</p>
            <p className="mt-0.5 text-sm text-stone-500">
              {n.author && <span>{n.author} · </span>}
              {n.pub_year && <span>{n.pub_year} · </span>}
              {n.word_count?.toLocaleString()} words
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
