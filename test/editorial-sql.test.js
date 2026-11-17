import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { sqlFixture, migration } from "./helpers/sql-fixture.js";
test("CMS migration preserves legacy wording, safely links authors, imports without duplicates, and never overwrites on rerun", async () => {
  const db = await sqlFixture();
  const original = "  Manual approved quotation\nwith exact line breaks.  ";
  await db.query(
    `insert into public.quotes(father,text_ckb,text_kmr,reference,source_url,topic,published) values($1,$2,$3,'My original reference','','Mercy',true)`,
    ["Saint John Chrysostom", original, "Original Kurmanji"],
  );
  await db.query(
    `insert into public.quotes(father,text_ckb,text_kmr,reference,source_url,topic,published) values('My manually entered Father','Exact original','Original','Source','','Faith',true)`,
  );
  await db.exec(migration);
  let rows = (
    await db.query(
      `select q.*,a.slug from public.quotes q join public.authors a on a.id=q.author_id where q.text_ckb=$1`,
      [original],
    )
  ).rows;
  assert.equal(rows[0].text_ckb, original);
  assert.equal(rows[0].slug, "chrysostom");
  assert.equal(
    (
      await db.query(
        `select count(*)::int n from public.quotes where author_id is null`,
      )
    ).rows[0].n,
    0,
  );
  const before = (
    await db.query(
      `select (select count(*) from public.quotes)::int quotes,(select count(*) from public.authors)::int authors,(select count(*) from public.doctrines)::int doctrines,(select count(*) from public.content_blocks)::int blocks`,
    )
  ).rows[0];
  await db.query(
    `update public.authors set biography_ckb=$1 where slug='chrysostom'`,
    [original],
  );
  await db.query(
    `update public.doctrines set body_en='My correction' where slug='holy-trinity'`,
  );
  await db.exec(migration);
  const after = (
    await db.query(
      `select (select count(*) from public.quotes)::int quotes,(select count(*) from public.authors)::int authors,(select count(*) from public.doctrines)::int doctrines,(select count(*) from public.content_blocks)::int blocks`,
    )
  ).rows[0];
  assert.deepEqual(after, before);
  assert.equal(
    (
      await db.query(
        `select biography_ckb from public.authors where slug='chrysostom'`,
      )
    ).rows[0].biography_ckb,
    original,
  );
  assert.equal(
    (
      await db.query(
        `select body_en from public.doctrines where slug='holy-trinity'`,
      )
    ).rows[0].body_en,
    "My correction",
  );
  assert.equal(
    (
      await db.query(
        `select count(*)::int n from public.editorial_revisions where operation='UPDATE'`,
      )
    ).rows[0].n >= 3,
    true,
  );
  await db.close();
});
test("central quote counts track publish, edits, archiving and author associations; FKs prevent orphan records", async () => {
  const db = await sqlFixture();
  await db.exec(migration);
  const [a, b] = (
    await db.query(
      "select id,quote_count from author_public_stats order by sort_order limit 2",
    )
  ).rows;
  const q = (
    await db.query(
      `insert into quotes(author_id,father,text_ckb,text_kmr,reference,source_url,topic,published) values($1,'Legacy name','My approved quote','','Homily 1','','Faith',true) returning id`,
      [a.id],
    )
  ).rows[0];
  assert.equal(
    (
      await db.query(
        "select quote_count from author_public_stats where id=$1",
        [a.id],
      )
    ).rows[0].quote_count,
    a.quote_count + 1,
  );
  await db.query("update quotes set author_id=$1 where id=$2", [b.id, q.id]);
  assert.equal(
    (
      await db.query(
        "select quote_count from author_public_stats where id=$1",
        [a.id],
      )
    ).rows[0].quote_count,
    a.quote_count,
  );
  await db.query("update quotes set deleted_at=now() where id=$1", [q.id]);
  assert.equal(
    (
      await db.query(
        "select quote_count from author_public_stats where id=$1",
        [b.id],
      )
    ).rows[0].quote_count,
    b.quote_count,
  );
  await assert.rejects(
    db.query(
      `insert into writings(author_id,title_en) values('00000000-0000-4000-8000-000000000099','Unlinked')`,
    ),
  );
  await db.close();
});
test("Bible ranges, protected tables, atomic doctrine links and empty requested drafts are enforced in PostgreSQL", async () => {
  const db = await sqlFixture();
  await db.exec(migration);
  const a = (await db.query("select id from authors limit 1")).rows[0].id;
  await assert.rejects(
    db.query(
      `insert into bible_explanations(author_id,book,chapter,verse_start,verse_end) values($1,'JHN',1,5,1)`,
      [a],
    ),
  );
  assert.equal(
    (
      await db.query(
        `select count(*)::int n from doctrines where legacy_key like 'requested-draft:%' and published`,
      )
    ).rows[0].n,
    0,
  );
  await assert.rejects(db.exec("set role anon; select * from authors;"));
  await db.exec("reset role;");
  const d = (
    await db.query(`select * from doctrines where slug='holy-trinity'`)
  ).rows[0];
  const record = { ...d, title_en: "My exact article", author_ids: undefined };
  await db.query(
    "select save_doctrine_article($1::jsonb,$2::uuid[],$3::uuid,$4::timestamptz)",
    [JSON.stringify(record), [a], d.id, d.updated_at],
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from doctrine_authors where doctrine_id=$1",
        [d.id],
      )
    ).rows[0].n,
    1,
  );
  await assert.rejects(
    db.query(
      "select save_doctrine_article($1::jsonb,$2::uuid[],$3::uuid,null)",
      [
        JSON.stringify({ ...record, title_en: "Should roll back" }),
        ["00000000-0000-4000-8000-000000000099"],
        d.id,
      ],
    ),
  );
  assert.equal(
    (await db.query("select title_en from doctrines where id=$1", [d.id]))
      .rows[0].title_en,
    "My exact article",
  );
  await db.close();
});
