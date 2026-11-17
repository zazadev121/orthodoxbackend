import express from "express";
import { readEditorial } from "../supabase/functions/_shared/editorial-read.js";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { decodeContent } from "./content-i18n.js";
import { decodeSource } from "./sources.js";
import {
  schemas,
  tableFor,
  editorialError,
  validatePublishing,
  imageType,
} from "./editorial-model.js";
import { bibleBooks } from "../supabase/functions/_shared/bible-books.js";
const uuid = z.uuid();
const unwrap = (result) => {
  if (result.error) throw result.error;
  return result.data;
};
const paging = (req) => ({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(200)
    .default(100)
    .parse(req.query.limit),
  page: z.coerce
    .number()
    .int()
    .min(1)
    .max(100000)
    .default(1)
    .parse(req.query.page),
});
function passage(row) {
  const book = bibleBooks.find((b) => b.id === row.book);
  if (
    !book ||
    row.chapter < book.firstChapterNumber ||
    row.chapter > book.lastChapterNumber
  )
    throw editorialError("Choose a valid Bible book and chapter.");
}
export function registerEditorialApi(
  app,
  { db, needDb, admin, scriptureFetcher = fetch },
) {
  let readyAt = 0,
    readyValue = false;
  const chapterCache = new Map();
  const searchPattern = (value) =>
    '"%' + z.string().max(200).parse(value).replace(/[\\"]/g, "\\$&") + '%"';
  const applySearch = (query, value, fields) =>
    value
      ? query.or(
          fields.map((key) => `${key}.ilike.${searchPattern(value)}`).join(","),
        )
      : query;
  async function ready() {
    if (!db) return false;
    if (Date.now() - readyAt < 5000) return readyValue;
    try {
      const r = await db
        .from("content_migrations")
        .select("key")
        .eq("key", "editorial-cms-v1")
        .maybeSingle();
      readyValue = !r.error && !!r.data;
    } catch {
      readyValue = false;
    }
    readyAt = Date.now();
    return readyValue;
  }
  const requireReady = async (_req, res, next) =>
    (await ready())
      ? next()
      : res.status(503).json({
          code: "CMS_MIGRATION_REQUIRED",
          error:
            "The editorial database migration has not been applied. Existing content remains intact. Apply supabase/migrations/20261117163506_editorial_cms.sql in Supabase.",
        });
  const authenticated = [needDb, admin];
  const publicRoutes = [
    "/api/cms/catalog",
    "/api/authors/:identifier",
    "/api/quotes",
    "/api/prayers",
    "/api/writings",
    "/api/writings/:identifier",
    "/api/doctrines",
    "/api/doctrines/:identifier",
    "/api/bible/editorial",
    "/api/bible/daily",
  ];
  app.get(publicRoutes, async (req, res, next) => {
    if (!(await ready()) && req.path === "/api/cms/catalog")
      return res.json({
        ready: false,
        authors: [],
        doctrines: [],
        blocks: [],
        editions: [],
      });
    if (!(await ready()) && ["/api/quotes", "/api/prayers"].includes(req.path))
      return next();
    if (!(await ready()) && req.path !== "/api/cms/catalog")
      return requireReady(req, res, next);
    const data = await readEditorial(
      db,
      req.path.slice(4),
      new URL(req.originalUrl, "http://api.local").searchParams,
    );
    res.set("Cache-Control", "no-store").json(data);
  });
  app.get("/api/admin/cms/status", ...authenticated, async (_req, res) =>
    res.json({
      ready: await ready(),
      migration: "20261117163506_editorial_cms.sql",
      manualOnly: true,
    }),
  );
  app.get(
    "/api/admin/cms/export",
    ...authenticated,
    requireReady,
    async (_req, res) => {
      // Paginate every table so a backup never silently stops at the Data API row limit.
      const data = {};
      for (const table of [
        "authors",
        "quotes",
        "prayers",
        "writings",
        "doctrines",
        "doctrine_authors",
        "bible_explanations",
        "bible_editions",
        "bible_overrides",
        "daily_verses",
        "content_blocks",
        "media_assets",
        "editorial_revisions",
        "sources",
      ]) {
        data[table] = [];
        for (let page = 0; ; page++) {
          const rows = unwrap(
            await db
              .from(table)
              .select("*")
              .range(page * 500, page * 500 + 499),
          );
          data[table].push(...rows);
          if (rows.length < 500) break;
        }
      }
      res.json({
        format: "orthodoxy-editorial-backup-v1",
        exported_at: new Date().toISOString(),
        data,
      });
    },
  );
  app.get(
    "/api/admin/cms/revisions",
    ...authenticated,
    requireReady,
    async (req, res) => {
      const table = z
          .enum(Object.keys(schemas).map(tableFor))
          .parse(req.query.table),
        id = z.string().min(1).max(100).parse(req.query.id);
      const items = unwrap(
        await db
          .from("editorial_revisions")
          .select("*")
          .eq("table_name", table)
          .eq("record_id", id)
          .order("created_at", { ascending: false })
          .limit(50),
      );
      const decode =
        table === "sources"
          ? decodeSource
          : ["quotes", "prayers"].includes(table)
            ? decodeContent
            : (row) => row;
      res.json({
        items: items.map((item) => ({
          ...item,
          previous_row: item.previous_row ? decode(item.previous_row) : null,
          next_row: item.next_row ? decode(item.next_row) : null,
        })),
      });
    },
  );
  app.post(
    "/api/admin/media",
    ...authenticated,
    requireReady,
    express.raw({
      type: ["image/png", "image/jpeg", "image/webp", "image/avif"],
      limit: "6mb",
    }),
    async (req, res) => {
      const type = imageType(req.body);
      if (!type || req.headers["content-type"]?.split(";")[0] !== type.mime)
        throw editorialError(
          "Upload a real PNG, JPEG, WebP or AVIF image with a matching file type.",
        );
      const id = randomUUID(),
        path = `icons/${id}.${type.ext}`;
      const upload = await db.storage
        .from("editorial-media")
        .upload(path, req.body, {
          contentType: type.mime,
          cacheControl: "31536000",
          upsert: false,
        });
      if (upload.error) throw upload.error;
      const url = db.storage.from("editorial-media").getPublicUrl(path)
        .data.publicUrl;
      const item = unwrap(
        await db
          .from("media_assets")
          .insert({
            id,
            storage_path: path,
            url,
            mime_type: type.mime,
            byte_size: req.body.length,
          })
          .select()
          .single(),
      );
      res.status(201).json(item);
    },
  );
  async function validateRelations(resource, row) {
    if (row.book) {
      passage(row);
      const edition = row.edition_id || "eng_webu",
        key = `${edition}/${row.book}/${row.chapter}`;
      let numbers = chapterCache.get(key);
      if (!numbers) {
        try {
          const response = await scriptureFetcher(
            `https://bible.helloao.org/api/${key}.simple.json`,
            { signal: AbortSignal.timeout(15000) },
          );
          if (!response.ok) throw Error("Bible source unavailable");
          const chapter = await response.json();
          if (
            chapter.translation?.id !== edition ||
            chapter.book?.id !== row.book ||
            chapter.chapter?.number !== row.chapter
          )
            throw Error("Mismatched Bible chapter");
          numbers = new Set(
            chapter.chapter.content
              .filter((v) => v.type === "verse")
              .map((v) => v.number),
          );
          if (!numbers.size) throw Error("Empty Bible chapter");
          if (chapterCache.size > 200)
            chapterCache.delete(chapterCache.keys().next().value);
          chapterCache.set(key, numbers);
        } catch {
          throw editorialError(
            "The Bible source could not verify this passage. Your text has not been saved or changed; please retry.",
            503,
            "PASSAGE_VERIFICATION_UNAVAILABLE",
          );
        }
      }
      const first = row.verse_start || row.verse,
        last = row.verse_end || row.verse;
      if (!numbers.has(first) || !numbers.has(last))
        throw editorialError(
          "The selected verse or verse range does not exist in this Bible chapter.",
        );
    }
    const ids = [
      ...new Set([row.author_id, ...(row.author_ids || [])].filter(Boolean)),
    ];
    for (const id of ids) {
      const author = unwrap(
        await db
          .from("authors")
          .select("id,published,deleted_at,name_en,name_ckb,name_kmr")
          .eq("id", id)
          .is("deleted_at", null)
          .maybeSingle(),
      );
      if (!author)
        throw editorialError(
          "The selected author is missing or archived.",
          400,
          "AUTHOR_NOT_FOUND",
        );
      if (row.published && !author.published)
        throw editorialError(
          "Publish the selected author before publishing linked content.",
        );
      if (resource === "quotes" && !row.father)
        row.father = author.name_en || author.name_ckb || author.name_kmr;
    }
    if (row.icon_media_id) {
      const media = unwrap(
        await db
          .from("media_assets")
          .select("*")
          .eq("id", row.icon_media_id)
          .is("deleted_at", null)
          .maybeSingle(),
      );
      if (!media) throw editorialError("The selected image is unavailable.");
      row.icon_url = media.url;
    }
  }
  for (const [resource, schema] of Object.entries(schemas)) {
    const table = tableFor(resource),
      legacy = ["quotes", "prayers", "sources"].includes(resource);
    const guard = async (req, res, next) => {
      if (await ready()) return next();
      if (legacy) return next("route");
      return requireReady(req, res, next);
    };
    app.get(
      `/api/admin/${resource}`,
      ...authenticated,
      guard,
      async (req, res) => {
        const { page, limit } = paging(req);
        let query = db.from(table).select("*", { count: "exact" });
        query =
          req.query.archived === "true"
            ? query.not("deleted_at", "is", null)
            : query.is("deleted_at", null);
        const searchFields = Object.keys(schema.shape).filter((key) =>
          /^(name_|title_|text_|body_|content|key$|section$|father$|topic$|reference$|source_reference$|biography_|history_|contributions_)/.test(
            key,
          ),
        );
        query = applySearch(query, req.query.q, searchFields);
        if (
          req.query.author_id &&
          ["quotes", "writings", "bible-explanations"].includes(resource)
        )
          query = query.eq("author_id", uuid.parse(req.query.author_id));
        const result = await query
          .order("created_at", { ascending: false })
          .range((page - 1) * limit, page * limit - 1);
        const rows = unwrap(result).map((row) =>
          resource === "sources"
            ? decodeSource(row)
            : legacy
              ? decodeContent(row)
              : row,
        );
        if (resource === "doctrines" && rows.length) {
          const links = unwrap(
            await db
              .from("doctrine_authors")
              .select("*")
              .in(
                "doctrine_id",
                rows.map((r) => r.id),
              ),
          );
          for (const row of rows)
            row.author_ids = links
              .filter((l) => l.doctrine_id === row.id)
              .map((l) => l.author_id);
        }
        res.json({ items: rows, total: result.count, page, limit });
      },
    );
    for (const method of ["post", "patch"])
      app[method](
        `/api/admin/${resource}${method === "patch" ? "/:id" : ""}`,
        ...authenticated,
        guard,
        async (req, res) => {
          const id =
            method === "patch"
              ? resource === "bible-editions"
                ? z.enum(["ckb_bib", "eng_webu"]).parse(req.params.id)
                : uuid.parse(req.params.id)
              : null;
          let current = null;
          if (id) {
            current = unwrap(
              await db
                .from(table)
                .select("*")
                .eq("id", id)
                .is("deleted_at", null)
                .maybeSingle(),
            );
            if (!current)
              return res.status(404).json({ error: "Record not found." });
            if (resource === "sources") current = decodeSource(current);
            else if (["quotes", "prayers"].includes(resource))
              current = decodeContent(current);
            if (resource === "doctrines" && req.body.author_ids === undefined)
              current.author_ids = unwrap(
                await db
                  .from("doctrine_authors")
                  .select("author_id")
                  .eq("doctrine_id", id),
              ).map((link) => link.author_id);
          }
          const expected = req.body.expected_updated_at ?? current?.updated_at;
          if (expected !== undefined)
            z.iso.datetime({ offset: true }).parse(expected);
          const row = schema.parse({ ...current, ...req.body });
          validatePublishing(resource, row);
          await validateRelations(resource, row);
          let data;
          if (resource === "doctrines") {
            const { author_ids, ...stored } = row;
            data = unwrap(
              await db.rpc("save_doctrine_article", {
                p_row: stored,
                p_authors: author_ids,
                p_id: id,
                p_expected: expected || null,
              }),
            );
          } else {
            let query = id
              ? db.from(table).update(row).eq("id", id).is("deleted_at", null)
              : db.from(table).insert(row);
            if (id && expected) query = query.eq("updated_at", expected);
            data = unwrap(await query.select().maybeSingle());
          }
          if (!data)
            return res.status(id && expected ? 409 : 404).json({
              code: id && expected ? "EDIT_CONFLICT" : "NOT_FOUND",
              error:
                id && expected
                  ? "This record changed in another session. Reload it before saving; your unsaved text is still in the form."
                  : "Record not found.",
            });
          res
            .status(id ? 200 : 201)
            .json(
              resource === "sources"
                ? decodeSource(data)
                : legacy
                  ? decodeContent(data)
                  : data,
            );
        },
      );
    app.delete(
      `/api/admin/${resource}/:id`,
      ...authenticated,
      guard,
      async (req, res) => {
        const id =
          resource === "bible-editions"
            ? z.enum(["ckb_bib", "eng_webu"]).parse(req.params.id)
            : uuid.parse(req.params.id);
        if (resource === "bible-editions")
          throw editorialError(
            "Disable a Bible edition instead of archiving its licensed source.",
            400,
          );
        let query = db
          .from(table)
          .update({
            deleted_at: new Date().toISOString(),
            ...(resource === "sources" ? { approved: false } : {}),
          })
          .eq("id", id)
          .is("deleted_at", null);
        if (req.body?.expected_updated_at)
          query = query.eq(
            "updated_at",
            z.iso
              .datetime({ offset: true })
              .parse(req.body.expected_updated_at),
          );
        const result = unwrap(await query.select().maybeSingle());
        if (!result)
          return res.status(409).json({
            code: "EDIT_CONFLICT",
            error:
              "The record changed or is already archived. Reload the list.",
          });
        res.status(204).end();
      },
    );
    app.post(
      `/api/admin/${resource}/:id/restore`,
      ...authenticated,
      requireReady,
      async (req, res) => {
        const id =
          resource === "bible-editions"
            ? z.enum(["ckb_bib", "eng_webu"]).parse(req.params.id)
            : uuid.parse(req.params.id);
        // Restore to draft; never republish archived theology automatically.
        const row = unwrap(
          await db
            .from(table)
            .update({
              deleted_at: null,
              [resource === "sources" ? "approved" : "published"]: false,
            })
            .eq("id", id)
            .not("deleted_at", "is", null)
            .select()
            .maybeSingle(),
        );
        if (!row)
          return res.status(404).json({ error: "Archived record not found." });
        res.json(row);
      },
    );
  }
  return { ready };
}
