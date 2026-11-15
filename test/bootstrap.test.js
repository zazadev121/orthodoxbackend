import test from "node:test";
import assert from "node:assert/strict";
import { bootstrapContent, starterSourceRows } from "../src/bootstrap.js";
import { starterPrayers } from "../src/prayers.js";
import {
  approvedUrl,
  starterSources,
  decodeSource,
  selectedAnswer,
} from "../src/sources.js";

function database(initial = {}) {
  const rows = { prayers: [], sources: [], ...structuredClone(initial) };
  return {
    rows,
    from(table) {
      return {
        update(values) {
          const filters = [];
          const chain = {
            eq(key, value) {
              filters.push([key, value]);
              return chain;
            },
            then(resolve, reject) {
              for (const row of rows[table])
                if (filters.every(([key, value]) => row[key] === value))
                  Object.assign(row, values);
              return Promise.resolve({ error: null }).then(resolve, reject);
            },
          };
          return chain;
        },
        select() {
          return {
            limit: async () => ({
              data: rows[table].map(({ id }) => ({ id })),
              error: null,
            }),
          };
        },
        async upsert(items, options) {
          assert.equal(options.ignoreDuplicates, true);
          for (const item of items)
            if (!rows[table].some((r) => r.id === item.id))
              rows[table].push(structuredClone(item));
          return { error: null };
        },
      };
    },
  };
}
test("English-only untouched starter rows gain bilingual passages; owner edits remain intact", async () => {
  const db = database({
    sources: starterSourceRows.map((s, i) => ({
      ...s,
      content: i === 0 ? "Owner edited this source" : starterSources[i].content,
    })),
  });
  await bootstrapContent({ env: {}, db });
  assert.equal(db.rows.sources[0].content, "Owner edited this source");
  assert.equal(
    decodeSource(db.rows.sources[3]).content_ckb,
    starterSources[3].content_ckb,
  );
});
test("only selected editorial passages can appear, never model-authored prose", () => {
  const result = selectedAnswer(
    {
      sourceIds: ["faith"],
      answer: "Invented prose",
      url: "https://reddit.com",
    },
    starterSources,
    "ckb",
  );
  assert.equal(result.answer, starterSources[3].content_ckb + " [faith]");
  assert.equal(result.mode, "approved-passages");
  assert.equal(
    selectedAnswer({ sourceIds: ["nonexistent"] }, starterSources, "ckb"),
    null,
  );
  assert.equal(
    selectedAnswer(
      { sourceIds: ["faith"] },
      [{ ...starterSources[3], content_ckb: undefined }],
      "ckb",
    ),
    null,
  );
});
test("starter library installs eight bilingual sourced prayers and four approved sources", async () => {
  const db = database();
  assert.equal((await bootstrapContent({ env: {}, db })).status, "initialized");
  assert.equal(db.rows.prayers.length, 8);
  assert.equal(db.rows.sources.length, 4);
  for (const p of db.rows.prayers) {
    assert.ok(approvedUrl(p.source_url));
    assert.match(p.text_ckb, /[\u0600-\u06ff]/);
    assert.doesNotMatch(p.text_kmr, /[\u0600-\u06ff]/);
    assert.ok(p.published);
    assert.ok(p.reference.includes("site translation"));
  }
});
test("restarts preserve owner edits and deletions once a source collection exists", async () => {
  const db = database();
  await bootstrapContent({ env: {}, db });
  db.rows.prayers[0].text_ckb = "دەستکاریی خاوەن";
  db.rows.prayers.splice(1, 1);
  assert.equal(
    (await bootstrapContent({ env: {}, db })).status,
    "existing-content",
  );
  assert.equal(db.rows.prayers.length, 7);
  assert.equal(db.rows.prayers[0].text_ckb, "دەستکاریی خاوەن");
});
test("partial prayer import recovers without overwriting a translated text", async () => {
  const db = database({
    prayers: [{ ...starterPrayers[0], text_ckb: "دەستکاری" }],
  });
  await bootstrapContent({ env: {}, db });
  assert.equal(db.rows.prayers.length, 8);
  assert.equal(db.rows.prayers[0].text_ckb, "دەستکاری");
});
test("custom libraries are untouched and initialization can be disabled", async () => {
  const db = database({ prayers: [{ id: "custom" }] });
  assert.equal(
    (await bootstrapContent({ env: {}, db })).status,
    "existing-content",
  );
  assert.equal(db.rows.sources.length, 0);
  assert.equal(
    (
      await bootstrapContent({
        env: { BOOTSTRAP_STARTER_CONTENT: "false" },
        db: database(),
      })
    ).status,
    "disabled",
  );
  assert.equal((await bootstrapContent({ env: {} })).status, "unconfigured");
  assert.equal(new Set(starterPrayers.map((p) => p.id)).size, 8);
  assert.equal(new Set(starterSourceRows.map((s) => s.id)).size, 4);
});
test("missing database tables surface an error instead of pretending to seed", async () => {
  await assert.rejects(
    () =>
      bootstrapContent({
        env: {},
        db: {
          from() {
            return {
              select() {
                return { limit: async () => ({ error: { code: "PGRST205" } }) };
              },
            };
          },
        },
      }),
    (e) => e.code === "PGRST205",
  );
});
