import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";
import { sqlFixture, postgrestFixture } from "./helpers/sql-fixture.js";
const auth = { Authorization: "Bearer fixture-owner" };
async function fixture() {
  const pg = await sqlFixture({ migrate: true }),
    db = postgrestFixture(pg);
  await pg.query("insert into auth.users(id) values($1)", [db.owner.id]);
  await pg.query("insert into admins(user_id) values($1)", [db.owner.id]);
  let aiCalls = 0;
  const app = createApp({
    db,
    env: {
      OWNER_EMAIL: db.owner.email,
      FRONTEND_ORIGIN: "http://127.0.0.1:4173",
    },
    fetcher: async () => {
      aiCalls++;
      throw Error("AI must not be used by editorial routes");
    },
    scriptureFetcher: async (url) => {
      const parts = new URL(url).pathname.split("/");
      return {
        ok: true,
        json: async () => ({
          translation: { id: parts[2] },
          book: { id: parts[3] },
          chapter: {
            number: Number(parts[4].split(".")[0]),
            content: Array.from({ length: 51 }, (_, i) => ({
              type: "verse",
              number: i + 1,
              text: "Licensed fixture verse",
            })),
          },
        }),
      };
    },
  });
  return { pg, db, app, aiCalls: () => aiCalls };
}
const father = (slug = "manual-father") => ({
  slug,
  name_en: "Manual Father",
  name_ckb: "ناوی دەستی",
  biography_en: "  Approved wording\nExactly as written.  ",
  aliases: ["Golden-Mouth", "Alternative title"],
  published: true,
});
test("owner CRUD uses one author ID for twenty quotes, live counts, edits, archives and restore; no generated wording", async () => {
  const f = await fixture(),
    r = request(f.app);
  const a = (
    await r.post("/api/admin/authors").set(auth).send(father()).expect(201)
  ).body;
  const ids = [];
  for (let i = 0; i < 20; i++) {
    const q = await r
      .post("/api/admin/quotes")
      .set(auth)
      .send({
        author_id: a.id,
        text_en: `  Approved quotation ${i}\nexact line  `,
        reference: `Book ${i}, chapter 1`,
        published: true,
      })
      .expect(201);
    ids.push(q.body.id);
    assert.equal(q.body.text_en, `  Approved quotation ${i}\nexact line  `);
  }
  let catalog = (await r.get("/api/cms/catalog").expect(200)).body;
  assert.equal(catalog.authors.find((x) => x.id === a.id).quote_count, 20);
  assert.equal(
    (await r.get("/api/quotes").query({ author_id: a.id }).expect(200)).body
      .quotes.length,
    20,
  );
  assert.equal(
    (await r.get("/api/quotes").query({ limit: 1 }).expect(200)).body.total >=
      20,
    true,
  );
  const quoted = (
    await r.get("/api/quotes").query({ author_id: a.id, limit: 1 }).expect(200)
  ).body.quotes[0];
  await r
    .delete("/api/admin/quotes/" + quoted.id)
    .set(auth)
    .send({ expected_updated_at: quoted.updated_at })
    .expect(204);
  assert.equal(
    (await r.get("/api/authors/" + a.slug).expect(200)).body.author.quote_count,
    19,
  );
  const restored = (
    await r
      .post("/api/admin/quotes/" + quoted.id + "/restore")
      .set(auth)
      .expect(200)
  ).body;
  assert.equal(restored.published, false);
  await r
    .patch("/api/admin/quotes/" + quoted.id)
    .set(auth)
    .send({
      ...restored,
      published: true,
      expected_updated_at: restored.updated_at,
    })
    .expect(200);
  assert.equal(
    (await r.get("/api/authors/" + a.slug).expect(200)).body.author.quote_count,
    20,
  );
  const updated = (
    await r
      .patch("/api/admin/authors/" + a.id)
      .set(auth)
      .send({
        ...a,
        name_en: "Corrected full name",
        expected_updated_at: a.updated_at,
      })
      .expect(200)
  ).body;
  const publicQuote = (
    await r.get("/api/quotes").query({ author_id: a.id }).expect(200)
  ).body.quotes[0];
  assert.equal(publicQuote.author.name_en, "Corrected full name");
  assert.equal(updated.biography_en, a.biography_en);
  await r
    .patch("/api/admin/authors/" + a.id)
    .set(auth)
    .send({
      ...a,
      name_en: "Stale overwrite",
      expected_updated_at: a.updated_at,
    })
    .expect(409);
  assert.equal(
    (await r.get("/api/authors/" + a.slug).expect(200)).body.author.name_en,
    "Corrected full name",
  );
  const partial = await r.patch('/api/admin/authors/'+a.id).set(auth).send({title_en:'Manual title only'}).expect(200);
  assert.equal(partial.body.biography_en,a.biography_en);
  assert.equal(partial.body.published,true);
  assert.equal(f.aiCalls(), 0);
  await f.pg.close();
});
test("doctrine and writings support exact multilingual text and relational author links; empty doctrine remains private", async () => {
  const f = await fixture(),
    r = request(f.app),
    a = (
      await r.post("/api/admin/authors").set(auth).send(father()).expect(201)
    ).body;
  const body =
    "  My manual theological explanation.\nNo automatic paraphrase.  ";
  const draft = (
    await r
      .post("/api/admin/doctrines")
      .set(auth)
      .send({ slug: "manual-doctrine", title_en: "Title", author_ids: [a.id] })
      .expect(201)
  ).body;
  await r.get("/api/doctrines/" + draft.id).expect(404);
  await r
    .patch("/api/admin/doctrines/" + draft.id)
    .set(auth)
    .send({
      ...draft,
      published: true,
      author_ids: [a.id],
      expected_updated_at: draft.updated_at,
    })
    .expect(400);
  const article = (
    await r
      .patch("/api/admin/doctrines/" + draft.id)
      .set(auth)
      .send({
        ...draft,
        body_en: body,
        body_ckb: "  دەقی دەستی\nبە هەمان وشەکان  ",
        published: true,
        author_ids: [a.id],
        expected_updated_at: draft.updated_at,
      })
      .expect(200)
  ).body;
  const read = (await r.get("/api/doctrines/" + article.slug).expect(200)).body
    .item;
  assert.equal(read.body_en, body);
  assert.equal(read.doctrine_authors[0].author_id, a.id);
  const writing = (
    await r
      .post("/api/admin/writings")
      .set(auth)
      .send({
        author_id: a.id,
        title_en: "My writing",
        body_en: body,
        reference: "Work, section 2",
        published: true,
      })
      .expect(201)
  ).body;
  assert.equal(
    (await r.get("/api/authors/" + a.id).expect(200)).body.author.writing_count,
    1,
  );
  assert.equal(
    (await r.get("/api/writings/" + writing.id).expect(200)).body.item.body_en,
    body,
  );
  await r
    .delete("/api/admin/writings/" + writing.id)
    .set(auth)
    .send({ expected_updated_at: writing.updated_at })
    .expect(204);
  assert.equal(
    (await r.get("/api/authors/" + a.id).expect(200)).body.author.writing_count,
    0,
  );
  assert.equal(f.aiCalls(), 0);
  await f.pg.close();
});
test("Bible verse ranges, multiple Fathers, source references and editorial revisions stay connected to exact passages", async () => {
  const f = await fixture(),
    r = request(f.app);
  const people = (
    await r.get("/api/cms/catalog").expect(200)
  ).body.authors.slice(0, 2);
  for (const [i, a] of people.entries())
    await r
      .post("/api/admin/bible-explanations")
      .set(auth)
      .send({
        author_id: a.id,
        book: "JHN",
        chapter: 1,
        verse_start: 1,
        verse_end: i ? 3 : 1,
        body_en: `  Manually written explanation ${i}\nApproved.  `,
        reference: "Homily " + (i + 1),
        published: true,
      })
      .expect(201);
  let editorial = (
    await r
      .get("/api/bible/editorial")
      .query({ book: "JHN", chapter: 1, edition: "eng_webu" })
      .expect(200)
  ).body;
  assert.equal(editorial.explanations.length, 2);
  assert.equal(editorial.explanations[1].author.id, people[1].id);
  assert.equal(
    (
      await r
        .get("/api/bible/editorial")
        .query({ book: "JHN", chapter: 2, edition: "eng_webu" })
        .expect(200)
    ).body.explanations.length,
    0,
  );
  await r
    .post("/api/admin/bible-explanations")
    .set(auth)
    .send({
      author_id: people[0].id,
      book: "JHN",
      chapter: 1,
      verse_start: 60,
      verse_end: 61,
      body_en: "Invalid",
      reference: "Source",
      published: true,
    })
    .expect(400);
  await r
    .post("/api/admin/bible-explanations")
    .set(auth)
    .send({
      author_id: people[0].id,
      book: "JHN",
      chapter: 1,
      verse_start: 1,
      verse_end: 1,
      body_en: "Needs source",
      published: true,
    })
    .expect(400);
  const first = editorial.explanations[0];
  await r
    .patch("/api/admin/bible-explanations/" + first.id)
    .set(auth)
    .send({
      ...first,
      body_en: "Revised by the owner",
      expected_updated_at: first.updated_at,
    })
    .expect(200);
  const ov = (
    await r
      .post("/api/admin/bible-overrides")
      .set(auth)
      .send({
        edition_id: "eng_webu",
        book: "JHN",
        chapter: 1,
        verse: 1,
        text: "  Explicit editorial text  ",
        editorial_note: "Owner-approved edition correction",
        published: true,
      })
      .expect(201)
  ).body;
  editorial = (
    await r
      .get("/api/bible/editorial")
      .query({ book: "JHN", chapter: 1, edition: "eng_webu" })
      .expect(200)
  ).body;
  assert.equal(editorial.overrides[0].text, "  Explicit editorial text  ");
  assert.equal(
    editorial.explanations.some((e) => e.body_en === "Revised by the owner"),
    true,
  );
  await r
    .post("/api/admin/daily-verses")
    .set(auth)
    .send({
      date: "2026-11-17",
      edition_id: "eng_webu",
      book: "JHN",
      chapter: 1,
      verse_start: 1,
      verse_end: 1,
      text: "Approved daily text",
      reference: "John 1:1",
      published: true,
    })
    .expect(201);
  assert.equal(
    (
      await r
        .get("/api/bible/daily")
        .query({ date: "2026-11-17", edition: "eng_webu" })
        .expect(200)
    ).body.item.reference,
    "John 1:1",
  );
  assert.equal(f.aiCalls(), 0);
  await f.pg.close();
});
test("General content, prayers, revision history, owner-only backups, images and archive protections function end to end", async () => {
  const f = await fixture(),
    r = request(f.app);
  await r.get("/api/admin/cms/export").expect(401);
  await r
    .get("/api/admin/authors")
    .set({ Authorization: "Bearer ordinary-user" })
    .expect(403);
  const row = (
    await r
      .get("/api/admin/content-blocks")
      .set(auth)
      .query({ q: "home.title" })
      .expect(200)
  ).body.items.find((b) => b.key === "home.title");
  assert.ok(row);
  const exact = "  Corrected homepage title\nwith exact spacing  ";
  await r
    .patch("/api/admin/content-blocks/" + row.id)
    .set(auth)
    .send({ ...row, text_en: exact, expected_updated_at: row.updated_at })
    .expect(200);
  assert.equal(
    (await r.get("/api/cms/catalog").expect(200)).body.blocks.find(
      (b) => b.id === row.id,
    ).text_en,
    exact,
  );
  const revisions = (
    await r
      .get("/api/admin/cms/revisions")
      .set(auth)
      .query({ table: "content_blocks", id: row.id })
      .expect(200)
  ).body.items;
  assert.equal(
    revisions.some((x) => x.next_row?.text_en === exact),
    true,
  );
  const prayer = (
    await r
      .post("/api/admin/prayers")
      .set(auth)
      .send({
        title_en: "Manually approved prayer",
        text_en: "  Original approved wording\nexact.  ",
        published: true,
      })
      .expect(201)
  ).body;
  assert.equal(
    (await r.get("/api/prayers").expect(200)).body.prayers.find(
      (p) => p.id === prayer.id,
    ).text_en,
    prayer.text_en,
  );
  await r
    .post("/api/admin/media")
    .set(auth)
    .set("Content-Type", "image/png")
    .send(Buffer.from('<svg onload="alert(1)"/>'))
    .expect(400);
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA1sAAAAASUVORK5CYII=",
    "base64",
  );
  const media = (
    await r
      .post("/api/admin/media")
      .set(auth)
      .set("Content-Type", "image/png")
      .send(png)
      .expect(201)
  ).body;
  const author = (
    await r
      .post("/api/admin/authors")
      .set(auth)
      .send({
        ...father(),
        icon_media_id: media.id,
        icon_url: "https://example.test/ignored.webp",
      })
      .expect(201)
  ).body;
  assert.equal(author.icon_url, media.url);
  const backup = (await r.get("/api/admin/cms/export").set(auth).expect(200))
    .body;
  assert.equal(backup.format, "orthodoxy-editorial-backup-v1");
  assert.ok(backup.data.authors.some((x) => x.id === author.id));
  await r
    .delete("/api/admin/authors/" + author.id)
    .set(auth)
    .send({ expected_updated_at: author.updated_at })
    .expect(204);
  await r.get("/api/authors/" + author.slug).expect(404);
  const archived = (
    await r
      .get("/api/admin/authors")
      .set(auth)
      .query({ archived: true })
      .expect(200)
  ).body.items;
  assert.ok(archived.some((x) => x.id === author.id));
  const restored = (
    await r
      .post("/api/admin/authors/" + author.id + "/restore")
      .set(auth)
      .expect(200)
  ).body;
  assert.equal(restored.published, false);
  assert.equal(restored.biography_en, author.biography_en);
  await f.pg.close();
});
