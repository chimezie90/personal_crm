import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";

export interface ParsedNarrative {
  filename: string;
  title: string;
  author: string | null;
  pubDateRaw: string | null;
  pubYear: number | null;
  pubYearApproximate: boolean;
  pubPlace: string | null;
  publisher: string | null;
  subjects: string[];
  fullText: string;
  segments: ParsedSegment[];
}

export interface ParsedSegment {
  index: number;
  text: string;
  type: "paragraph" | "heading" | "chapter_heading" | "verse" | "quote";
  chapterHeading: string | null;
  pageNumber: string | null;
  divPath: string | null;
}

export function parseTeiXml(xml: string, filename: string): ParsedNarrative {
  const $ = cheerio.load(xml, { xml: true });

  const title = extractTitle($);
  const author = extractAuthor($);
  const { raw, year, approximate } = extractDate($);
  const pubPlace = extractPubPlace($);
  const publisher = extractPublisher($);
  const subjects = extractSubjects($);

  const segments: ParsedSegment[] = [];
  let currentChapter: string | null = null;
  let currentPage: string | null = null;
  let segIndex = 0;

  // Process body content — walk div1/div2/div3 and extract paragraphs
  const body = $("body");
  if (body.length === 0) {
    return buildResult(filename, title, author, raw, year, approximate, pubPlace, publisher, subjects, segments);
  }

  // Find all paragraph-level elements in document order
  body.find("p, head, lg, pb").each((_i, el) => {
    const $el = $(el);
    const tag = el.type === "tag" ? (el as unknown as { tagName?: string }).tagName?.toLowerCase() : "";

    if (tag === "pb") {
      const n = $el.attr("n");
      if (n) currentPage = n;
      return;
    }

    if (tag === "head") {
      const headText = cleanText($el.text());
      if (!headText) return;

      // Check if this is a chapter/part heading inside div1/div2
      const parent = $el.parent();
      const parentTag = parent.length > 0 && parent[0].type === "tag"
        ? (parent[0] as unknown as { tagName?: string }).tagName?.toLowerCase()
        : "";

      if (parentTag === "div1" || parentTag === "div2") {
        currentChapter = headText;
        segments.push({
          index: segIndex++,
          text: headText,
          type: "chapter_heading",
          chapterHeading: currentChapter,
          pageNumber: currentPage,
          divPath: buildDivPath($, $el),
        });
      } else {
        segments.push({
          index: segIndex++,
          text: headText,
          type: "heading",
          chapterHeading: currentChapter,
          pageNumber: currentPage,
          divPath: buildDivPath($, $el),
        });
      }
      return;
    }

    if (tag === "lg") {
      // Poetry/verse group — combine lines
      const lines: string[] = [];
      $el.find("l").each((_j, line) => {
        const lineText = cleanText($(line).text());
        if (lineText) lines.push(lineText);
      });
      if (lines.length > 0) {
        segments.push({
          index: segIndex++,
          text: lines.join("\n"),
          type: "verse",
          chapterHeading: currentChapter,
          pageNumber: currentPage,
          divPath: buildDivPath($, $el),
        });
      }
      return;
    }

    // Regular paragraph
    const text = cleanText($el.text());
    if (!text || text === "[Title Page Image]" || text.startsWith("[")) return;

    // Skip paragraphs that are just page break markers or figure captions
    if (text.length < 3) return;

    segments.push({
      index: segIndex++,
      text,
      type: "paragraph",
      chapterHeading: currentChapter,
      pageNumber: currentPage,
      divPath: buildDivPath($, $el),
    });
  });

  return buildResult(filename, title, author, raw, year, approximate, pubPlace, publisher, subjects, segments);
}

function buildResult(
  filename: string,
  title: string,
  author: string | null,
  pubDateRaw: string | null,
  pubYear: number | null,
  pubYearApproximate: boolean,
  pubPlace: string | null,
  publisher: string | null,
  subjects: string[],
  segments: ParsedSegment[]
): ParsedNarrative {
  const fullText = segments
    .filter((s) => s.type === "paragraph" || s.type === "verse")
    .map((s) => s.text)
    .join("\n\n");

  return {
    filename,
    title,
    author,
    pubDateRaw,
    pubYear,
    pubYearApproximate,
    pubPlace,
    publisher,
    subjects,
    fullText,
    segments,
  };
}

function extractTitle($: CheerioAPI): string {
  // Try source title first, then main title
  const sourceTitle = $("sourceDesc titleStmt title").first().text().trim();
  if (sourceTitle) return cleanText(sourceTitle);

  const mainTitle = $("titleStmt title").first().text().trim();
  return cleanText(mainTitle).replace(/:\s*Electronic Edition\.?$/i, "").trim();
}

function extractAuthor($: CheerioAPI): string | null {
  const author = $("titleStmt author").first().text().trim();
  if (!author) return null;
  // Clean up date ranges in author names like "Douglass, Frederick, 1818-1895."
  return author.replace(/,?\s*\d{4}\s*-\s*\d{0,4}\.?$/, "").trim() || null;
}

function extractDate($: CheerioAPI): { raw: string | null; year: number | null; approximate: boolean } {
  // Try source publication date first
  const sourceDate = $("sourceDesc publicationStmt date").first().text().trim();
  if (sourceDate) {
    const parsed = parseYear(sourceDate);
    return { raw: sourceDate, ...parsed };
  }

  const mainDate = $("publicationStmt date").first().text().trim();
  if (mainDate) {
    const parsed = parseYear(mainDate);
    return { raw: mainDate, ...parsed };
  }

  return { raw: null, year: null, approximate: false };
}

function parseYear(dateStr: string): { year: number | null; approximate: boolean } {
  // Match 4-digit year
  const match = dateStr.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
  if (match) {
    return { year: parseInt(match[1], 10), approximate: false };
  }
  // Try approximate patterns like "c1860" or "ca. 1860"
  const approxMatch = dateStr.match(/c(?:a\.?\s*)?(\d{4})/);
  if (approxMatch) {
    return { year: parseInt(approxMatch[1], 10), approximate: true };
  }
  return { year: null, approximate: false };
}

function extractPubPlace($: CheerioAPI): string | null {
  const place = $("sourceDesc publicationStmt pubPlace").first().text().trim();
  return place || null;
}

function extractPublisher($: CheerioAPI): string | null {
  const pub = $("sourceDesc publicationStmt publisher").first().text().trim();
  return pub || null;
}

function extractSubjects($: CheerioAPI): string[] {
  const subjects: string[] = [];
  $("keywords item").each((_i, el) => {
    const text = $(el).text().trim();
    if (text) subjects.push(text);
  });
  return subjects;
}

function cleanText(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/\[.*?\]/g, "")
    .trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildDivPath($: CheerioAPI, $el: any): string | null {
  const parts: string[] = [];
  let current = $el.parent();
  while (current.length > 0) {
    const node = current[0];
    if (node.type === "tag") {
      const tagName = (node as unknown as { tagName?: string }).tagName?.toLowerCase();
      if (tagName?.startsWith("div")) {
        const type = current.attr("type") || "";
        parts.unshift(`${tagName}[${type}]`);
      }
      if (tagName === "body" || tagName === "text") break;
    }
    current = current.parent();
  }
  return parts.length > 0 ? parts.join("/") : null;
}
