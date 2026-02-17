import { notFound } from "next/navigation";
import { getEpisodeBySlug } from "@/lib/queries/episodes";
import { getSegmentsByIds } from "@/lib/queries/segments";
import { db } from "@/lib/db";
import type { NarrativeRow } from "@/lib/db-types";
import type { Metadata } from "next";
import EpisodePlayer from "./episode-player";

interface EpisodePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: EpisodePageProps): Promise<Metadata> {
  const { slug } = await params;
  const episode = getEpisodeBySlug(slug);
  if (!episode) return { title: "Episode Not Found" };

  return {
    title: `${episode.title} — Human Lives`,
    description: episode.description || "An interactive episode from Human Lives.",
    openGraph: {
      title: episode.title,
      description: episode.description || undefined,
      type: "article",
    },
  };
}

export default async function EpisodePage({ params }: EpisodePageProps) {
  const { slug } = await params;
  const episode = getEpisodeBySlug(slug);
  if (!episode) notFound();

  // Resolve all segment IDs across all beats
  const allSegmentIds = episode.beats.flatMap((b) => b.segment_ids);
  const segments = getSegmentsByIds(allSegmentIds);
  const segmentMap = new Map(segments.map((s) => [s.id, s]));

  // Get narrative titles
  const narrativeIds = [...new Set(segments.map((s) => s.narrative_id))];
  const narrativeMap = new Map<number, string>();
  if (narrativeIds.length > 0) {
    const placeholders = narrativeIds.map(() => "?").join(",");
    const rows = db
      .prepare(`SELECT id, title FROM narratives WHERE id IN (${placeholders})`)
      .all(...narrativeIds) as Pick<NarrativeRow, "id" | "title">[];
    for (const r of rows) narrativeMap.set(r.id, r.title);
  }

  // Build serializable beat data for client component
  const beatsWithText = episode.beats
    .sort((a, b) => a.order - b.order)
    .map((beat) => ({
      ...beat,
      resolvedSegments: beat.segment_ids
        .map((id) => segmentMap.get(id))
        .filter((seg): seg is NonNullable<typeof seg> => seg != null)
        .map((seg) => ({
          id: seg.id,
          text: seg.text,
          type: seg.type,
          narrativeId: seg.narrative_id,
          segmentIndex: seg.segment_index,
          narrativeTitle: narrativeMap.get(seg.narrative_id) || "Unknown",
        })),
    }));

  return (
    <EpisodePlayer
      episode={{
        title: episode.title,
        description: episode.description,
        slug: episode.slug,
        contentWarnings: episode.content_warnings,
        themeTags: episode.theme_tags,
        durationMinutes: episode.duration_minutes,
      }}
      beats={beatsWithText}
    />
  );
}
