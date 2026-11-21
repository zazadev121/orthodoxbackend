import { z } from "zod";
import { approvedUrl } from "./sources.js";
// Validate without trimming or rewriting editorial wording, whitespace, or translations.
const text = (max = 150000) =>
  z.preprocess(
    (value) => (value === null ? "" : value),
    z.string().max(max).default(""),
  );
export const safeUrl = z
  .string()
  .max(3000)
  .refine((value) => {
    if (!value) return true;
    if (/^\/(?!\/)[^\s]*$/.test(value)) return true;
    try {
      const url = new URL(value);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        !!url.hostname &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, "Use an http(s) URL without credentials or a local image path.")
  .default("");

const uuid = z.uuid();
const translations = (base, max) =>
  Object.fromEntries(
    ["en", "ckb", "kmr", "ka"].map((lang) => [`${base}_${lang}`, text(max)]),
  );
const common = {
  published: z.boolean().default(false),
  sort_order: z.number().int().min(-100000).max(100000).default(0),
};
const image = {
  icon_url: safeUrl,
  icon_media_id: uuid.nullable().default(null),
  icon_alt: text(1000),
  icon_credit: text(5000),
  icon_alt_ka: text(1000),
  icon_credit_ka: text(5000),
};
const reference = { reference: text(10000), reference_ka: text(10000), source_url: safeUrl };
const article = {
  ...translations("title", 500),
  ...translations("subtitle", 3000),
  ...translations("body"),
  ...reference,
  ...common,
};
export const schemas = {
  sources: z.object({
    title: text(500),
    publisher: text(500),
    url: safeUrl,
    content: text(),
    content_ckb: text(),
    content_kmr: text(),
    content_ka: text(),
    title_ka: text(500),
    publisher_ka: text(500),
    keywords: text(10000),
    approved: z.boolean().default(false),
  }),
  authors: z.object({
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(180),
    ...Object.assign(
      {},
      ...[
        "name",
        "title",
        "position",
        "summary",
        "biography",
        "history",
        "contributions",
        "writings_intro",
        "feast",
        "life_dates",
      ].map((base) => translations(base, base === "name" ? 500 : 150000)),
    ),
    birth_info: text(1000),
    birth_info_ka: text(1000),
    death_info_ka: text(1000),
    death_info: text(1000),
    aliases: z.array(z.string().max(500)).max(100).default([]),
    kind: z
      .enum(["saint", "father", "saint-and-father"])
      .default("saint-and-father"),
    ...image,
    icon_source: safeUrl,
    icon_license_url: safeUrl,
    source_reference: text(10000),
    source_reference_ka: text(10000),
    source_url: safeUrl,
    ...common,
  }),
  quotes: z.object({
    author_id: uuid,
    father: text(500),
    review_note_ka: text(10000),
    ...translations("text", 30000),
    ...reference,
    topic: text(500),
    reference_ka: text(10000),
    topic_ka: text(500),
    published: z.boolean().default(false),
  }),
  prayers: z.object({
    review_note_ka: text(10000),
    ...translations("title", 500),
    ...translations("text", 100000),
    ...reference,
    topic: text(500),
    reference_ka: text(10000),
    topic_ka: text(500),
    published: z.boolean().default(false),
  }),
  writings: z.object({ author_id: uuid, ...article }),
  doctrines: z.object({
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(180),
    category: z.enum(["doctrine", "council", "history"]).default("doctrine"),
    council_year: text(100),
    ...article,
    ...image,
    bible_references: text(30000),
    bible_references_ka: text(30000),
    father_references_ka: text(30000),
    council_references_ka: text(30000),
    father_references: text(30000),
    council_references: text(30000),
    author_ids: z.array(uuid).max(100).default([]),
  }),
  "bible-explanations": z
    .object({
      review_note_ka: text(10000),
      author_id: uuid,
      book: z.string().regex(/^[A-Z0-9]{3}$/),
      chapter: z.number().int().positive().max(151),
      verse_start: z.number().int().positive().max(200),
      verse_end: z.number().int().positive().max(200),
      ...article,
    })
    .omit({ subtitle_en: true, subtitle_ckb: true, subtitle_kmr: true, subtitle_ka: true }),
  "bible-overrides": z.object({
    edition_id: z.enum(["ckb_bib", "eng_webu", "ka_ogb"]),
    book: z.string().regex(/^[A-Z0-9]{3}$/),
    chapter: z.number().int().positive().max(151),
    verse: z.number().int().positive().max(200),
    text: text(),
    editorial_note: text(5000),
    published: z.boolean().default(false),
  }),
  "daily-verses": z.object({
    date: z.iso.date(),
    edition_id: z.enum(["ckb_bib", "eng_webu", "ka_ogb"]),
    book: z.string().regex(/^[A-Z0-9]{3}$/),
    chapter: z.number().int().positive().max(151),
    verse_start: z.number().int().positive().max(200),
    verse_end: z.number().int().positive().max(200),
    text: text(),
    reference: text(10000),
    reference_ka: text(10000),
    published: z.boolean().default(false),
  }),
  "bible-editions": z.object({
    id: z.enum(["ckb_bib", "eng_webu", "ka_ogb"]),
    ...translations("title", 500),
    ...translations("description", 30000),
    ...common,
  }),
  "content-blocks": z.object({
    key: z
      .string()
      .regex(/^[a-zA-Z0-9_.-]+$/)
      .max(250),
    section: text(150),
    ...translations("text"),
    value_type: z.enum(["text", "image", "visibility"]).default("text"),
    ...common,
  }),
};
export const tables = {
  "bible-explanations": "bible_explanations",
  "bible-overrides": "bible_overrides",
  "bible-editions": "bible_editions",
  "daily-verses": "daily_verses",
  "content-blocks": "content_blocks",
};
export const tableFor = (resource) => tables[resource] || resource;
export function editorialError(
  message,
  status = 400,
  code = "INVALID_EDITORIAL_CONTENT",
) {
  return Object.assign(new Error(message), { status, code });
}
export function validatePublishing(resource, row) {
  const has = (base) =>
    ["en", "ckb", "kmr", "ka"].some((lang) => row[`${base}_${lang}`]?.trim());
  if (resource === "authors" && !has("name"))
    throw editorialError("Enter the author’s name in at least one language.");
  if ("verse_end" in row && row.verse_end < row.verse_start)
    throw editorialError("The last verse must not precede the first verse.");
  if (
    resource === "sources" &&
    row.approved &&
    (![row.content,row.content_ckb,row.content_kmr,row.content_ka].some(v => v?.trim()) || !approvedUrl(row.url))
  )
    throw editorialError(
      "Approved retrieval sources need manually entered evidence and an approved Orthodox publisher URL.",
    );
  if (!row.published) return;
  if (["doctrines", "writings", "prayers"].includes(resource) && !has("title"))
    throw editorialError(
      "A published record needs a title in at least one language.",
    );
  if (resource === "doctrines" && !has("body"))
    throw editorialError(
      "Write the theological explanation before publishing. Empty topics remain drafts.",
    );
  if (resource === "prayers" && !has("text"))
    throw editorialError("A published prayer needs manually entered text.");
  if (resource === "quotes" && (!has("text") || !(row.reference?.trim() || row.reference_ka?.trim())))
    throw editorialError(
      "Published quotations need text and an original work/passage reference.",
    );
  if (
    resource === "bible-explanations" &&
    (!has("body") || !(row.reference?.trim() || row.reference_ka?.trim()))
  )
    throw editorialError(
      "Published explanations need your text and a Church Father’s source reference.",
    );
  if (
    resource === "daily-verses" &&
    (!row.text.trim() || !(row.reference?.trim() || row.reference_ka?.trim()))
  )
    throw editorialError("Enter the exact daily verse text and its reference.");
  if (resource === "bible-overrides" && !row.editorial_note.trim())
    throw editorialError(
      "Add an editorial note explaining this explicit Bible text revision.",
    );
  if (resource === "content-blocks" && row.value_type === "image")
    for (const lang of ["en", "ckb", "kmr", "ka"]) safeUrl.parse(row[`text_${lang}`]);
}
export function imageType(bytes) {
  if (!Buffer.isBuffer(bytes)) return null;
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return { mime: "image/png", ext: "png" };
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return { mime: "image/jpeg", ext: "jpg" };
  if (
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  )
    return { mime: "image/webp", ext: "webp" };
  if (
    bytes.toString("ascii", 4, 8) === "ftyp" &&
    ["avif", "avis"].includes(bytes.toString("ascii", 8, 12))
  )
    return { mime: "image/avif", ext: "avif" };
  return null;
}
