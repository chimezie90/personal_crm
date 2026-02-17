import { describe, it, expect } from "vitest";
import { parseTeiXml } from "../src/lib/ingest/parse-tei";

const SAMPLE_XML = `<!DOCTYPE TEI.2 SYSTEM "teixlite.dtd">
<TEI.2>
  <teiHeader type="Slave Narratives" status="new">
    <fileDesc>
      <titleStmt>
        <title><emph>Test Narrative:</emph> Electronic Edition.</title>
        <author>Test Author, 1800-1880.</author>
      </titleStmt>
      <publicationStmt>
        <publisher>UNC</publisher>
        <pubPlace>Chapel Hill</pubPlace>
        <date>2003</date>
      </publicationStmt>
      <sourceDesc>
        <biblFull>
          <titleStmt><title>Test Narrative</title></titleStmt>
          <publicationStmt>
            <pubPlace>Boston</pubPlace>
            <publisher>Publisher Co</publisher>
            <date>1853</date>
          </publicationStmt>
        </biblFull>
      </sourceDesc>
    </fileDesc>
    <profileDesc>
      <textClass>
        <keywords>
          <list type="simple">
            <item>Slavery -- United States.</item>
            <item>Freedom.</item>
          </list>
        </keywords>
      </textClass>
    </profileDesc>
  </teiHeader>
  <text>
    <body>
      <div1 type="chapter">
        <head>CHAPTER I.</head>
        <p>First paragraph of the narrative.</p>
        <p>Second paragraph with more content.</p>
        <lg type="poem">
          <l>A verse line one</l>
          <l>A verse line two</l>
        </lg>
        <div2 type="section">
          <head>Section One</head>
          <p>A paragraph in section one.</p>
        </div2>
      </div1>
    </body>
  </text>
</TEI.2>`;

describe("parseTeiXml", () => {
  it("extracts metadata", () => {
    const result = parseTeiXml(SAMPLE_XML, "test-narrative.xml");
    expect(result.filename).toBe("test-narrative.xml");
    expect(result.title).toBe("Test Narrative");
    expect(result.author).toBe("Test Author");
    expect(result.pubYear).toBe(1853);
    expect(result.pubPlace).toBe("Boston");
    expect(result.publisher).toBe("Publisher Co");
    expect(result.subjects).toEqual(["Slavery -- United States.", "Freedom."]);
  });

  it("extracts segments in order", () => {
    const result = parseTeiXml(SAMPLE_XML, "test.xml");
    expect(result.segments.length).toBeGreaterThanOrEqual(5);

    const types = result.segments.map((s) => s.type);
    expect(types[0]).toBe("chapter_heading");
    expect(types[1]).toBe("paragraph");
    expect(types[2]).toBe("paragraph");
    expect(types[3]).toBe("verse");
  });

  it("preserves chapter heading context", () => {
    const result = parseTeiXml(SAMPLE_XML, "test.xml");
    const paragraphs = result.segments.filter((s) => s.type === "paragraph");
    expect(paragraphs[0].chapterHeading).toBe("CHAPTER I.");
  });

  it("builds full text from paragraphs and verses", () => {
    const result = parseTeiXml(SAMPLE_XML, "test.xml");
    expect(result.fullText).toContain("First paragraph");
    expect(result.fullText).toContain("Second paragraph");
    expect(result.fullText).toContain("A verse line one");
  });

  it("assigns sequential segment indices", () => {
    const result = parseTeiXml(SAMPLE_XML, "test.xml");
    for (let i = 0; i < result.segments.length; i++) {
      expect(result.segments[i].index).toBe(i);
    }
  });
});
