// Shared read-only publication boundary, used by Express and the Supabase Edge reader.
import { bibleBooks } from "./bible-books.js";
const bad = (message, status = 400) =>
  Object.assign(new Error(message), {
    status,
    code: status === 404 ? "NOT_FOUND" : "INVALID_REQUEST",
  });
const unwrap = (result) => {
  if (result.error) throw result.error;
  return result.data;
};
const live = (q) => q.eq("published", true).is("deleted_at", null);
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const person = "id,slug,name_en,name_ckb,name_kmr,name_ka,title_en,title_ckb,title_kmr,title_ka";
const card = `${person},position_en,position_ckb,position_kmr,position_ka,summary_en,summary_ckb,summary_kmr,summary_ka,feast_en,feast_ckb,feast_kmr,feast_ka,aliases,kind,icon_url,icon_alt,sort_order,quote_count,writing_count,updated_at`;
const articleCard =
  "id,slug,category,council_year,title_en,title_ckb,title_kmr,title_ka,subtitle_en,subtitle_ckb,subtitle_kmr,subtitle_ka,icon_url,icon_alt,sort_order,updated_at,doctrine_authors(author_id)";
const authorLive = (q) =>
  q.eq("author.published", true).is("author.deleted_at", null);
const integer = (value, fallback, min, max) => {
  const n = value === null ? fallback : Number(value);
  if (!Number.isInteger(n) || n < min || n > max)
    throw bad("Invalid page, chapter or verse.");
  return n;
};
const idValue = (value) => {
  if (!uuid.test(value || "")) throw bad("Invalid author ID.");
  return value;
};
function decode(row) {
  try {
    const v = JSON.parse(row.text_kmr);
    if (v.format === "orthodoxy-content-v1")
      return {
        ...row,
        text_kmr: v.kmr,
        text_en: row.text_en ?? v.en ?? "",
        title_en: row.title_en ?? v.title_en ?? "",
      };
  } catch {}
  return row;
}
function search(query, value, fields) {
  if (!value) return query;
  if (value.length > 200) throw bad("Search is too long.");
  const pattern = '"%' + value.replace(/[\\"]/g, "\\$&") + '%"';
  return query.or(fields.map((key) => `${key}.ilike.${pattern}`).join(","));
}
export const publicEditorialPaths = [
  "/cms/catalog",
  "/quotes",
  "/prayers",
  "/writings",
  "/doctrines",
  "/bible/editorial",
  "/bible/daily",
];
export function isPublicEditorialPath(path) {
  return (
    publicEditorialPaths.includes(path) ||
    /^\/(authors|doctrines|writings)\/[a-zA-Z0-9-]+$/.test(path)
  );
}
export async function readEditorial(db, path, params = new URLSearchParams()) {
  if (!isPublicEditorialPath(path)) throw bad("Route not found.", 404);
  if (path === "/cms/catalog") {
    const marker = await db
      .from("content_migrations")
      .select("key")
      .eq("key", "editorial-cms-v1")
      .maybeSingle();
    if (marker.error || !marker.data)
      return {
        ready: false,
        authors: [],
        doctrines: [],
        blocks: [],
        editions: [],
      };
    const result = await Promise.all([
      db
        .from("author_public_stats")
        .select(card)
        .order("sort_order")
        .order("name_en")
        .limit(2000),
      live(db.from("doctrines").select(articleCard))
        .order("sort_order")
        .order("created_at")
        .limit(2000),
      live(db.from("content_blocks").select("*"))
        .order("sort_order")
        .limit(10000),
      live(db.from("bible_editions").select("*")).order("sort_order"),
    ]);
    const [authors, doctrines, blocks, editions] = result.map(unwrap);
    return {
      ready: true,
      authors,
      doctrines,
      blocks,
      editions,
      refreshed_at: new Date().toISOString(),
    };
  }
  const match = /^\/(authors|doctrines|writings)\/([a-zA-Z0-9-]+)$/.exec(path);
  if (match) {
    const [, type, key] = match;
    let q =
      type === "authors"
        ? db.from("author_public_stats").select("*")
        : live(
            db
              .from(type)
              .select(
                type === "writings"
                  ? `*,author:authors!inner(${person})`
                  : "*,doctrine_authors(author_id)",
              ),
          );
    if (type === "writings") {
      idValue(key);
      q = authorLive(q);
    }
    const row = unwrap(
      await q.eq(uuid.test(key) ? "id" : "slug", key).maybeSingle(),
    );
    if (!row) throw bad("Published record not found.", 404);
    return type === "authors" ? { author: row } : { item: row };
  }
  if (path === "/bible/editorial") {
    const book = params.get("book"),
      chapter = integer(params.get("chapter"), null, 1, 151),
      edition = params.get("edition");
    const metadata = bibleBooks.find((b) => b.id === book);
    if (
      !metadata ||
      chapter < metadata.firstChapterNumber ||
      chapter > metadata.lastChapterNumber ||
      !["eng_webu", "ckb_bib", "ka_ogb"].includes(edition)
    )
      throw bad("Invalid Bible passage.");
    const [explanations, overrides] = await Promise.all([
      authorLive(
        live(
          db
            .from("bible_explanations")
            .select(`*,author:authors!inner(${person})`),
        ),
      )
        .eq("book", book)
        .eq("chapter", chapter)
        .order("verse_start")
        .order("sort_order")
        .limit(2000),
      live(db.from("bible_overrides").select("*"))
        .eq("edition_id", edition)
        .eq("book", book)
        .eq("chapter", chapter)
        .limit(200),
    ]);
    return { explanations: unwrap(explanations), overrides: unwrap(overrides) };
  }
  if (path === "/bible/daily") {
    const date = params.get("date"),
      edition = params.get("edition");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date || "") ||
      !["eng_webu", "ckb_bib", "ka_ogb"].includes(edition)
    )
      throw bad("Invalid date or edition.");
    return {
      item: unwrap(
        await live(db.from("daily_verses").select("*"))
          .eq("date", date)
          .eq("edition_id", edition)
          .maybeSingle(),
      ),
    };
  }
  const table = path.slice(1),
    page = integer(params.get("page"), 1, 1, 100000),
    limit = integer(params.get("limit"), 100, 1, 200),
    linked = ["quotes", "writings"].includes(table);
  let query = live(
    db.from(table).select(linked ? `*,author:authors!inner(${person})` : "*", {
      count: "exact",
    }),
  );
  if (linked) query = authorLive(query);
  if (linked && params.get("author_id"))
    query = query.eq("author_id", idValue(params.get("author_id")));
  if (table === "doctrines" && params.get("category")) {
    if (!["doctrine", "council", "history"].includes(params.get("category")))
      throw bad("Invalid category.");
    query = query.eq("category", params.get("category"));
  }
  if (["quotes", "prayers"].includes(table)) {
    if (params.get("topic")) query = query.eq("topic", params.get("topic"));
    query = search(
      query,
      params.get("q"),
      table === "quotes"
        ? ["father", "text_ckb", "text_kmr", "text_en", "text_ka", "topic", "topic_ka"]
        : [
            "title_ka",
            "text_ka",
            "topic_ka",
            "title_en",
            "title_ckb",
            "title_kmr",
            "text_en",
            "text_ckb",
            "text_kmr",
            "topic",
          ],
    );
  }
  const result = await query
    .order(
      ["quotes", "prayers"].includes(table) ? "created_at" : "sort_order",
      { ascending: !["quotes", "prayers"].includes(table) },
    )
    .range((page - 1) * limit, page * limit - 1);
  const rows = unwrap(result);
  if (["quotes", "prayers"].includes(table)) {
    const topicRows = unwrap(
      await db
        .from(
          table === "quotes" ? "public_quote_topics" : "public_prayer_topics",
        )
        .select("topic,topic_ka")
        .order("topic"),
    );
    const topics = [...new Set(topicRows.map((row) => row.topic))];
    const topicTranslations = Object.fromEntries(topicRows.filter(row => row.topic_ka).map(row => [row.topic, row.topic_ka]));
    return {
      [table]: rows.map(decode),
      total: result.count ?? rows.length,
      page,
      limit,
      topics,
      topicTranslations,
    };
  }
  return { items: rows, total: result.count ?? rows.length, page, limit };
}
