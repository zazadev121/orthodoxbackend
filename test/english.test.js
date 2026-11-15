import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";
import { encodeContent, decodeContent } from "../src/content-i18n.js";
import { starterPrayers } from "../src/prayers.js";
import { selectedAnswer, starterSources } from "../src/sources.js";

test("English prayer fields round-trip without requiring new database columns", () => {
  for (const p of starterPrayers) {
    const stored = encodeContent(p);
    assert.equal(stored.text_en, undefined);
    assert.equal(stored.title_en, undefined);
    const decoded = decodeContent(stored);
    assert.equal(decoded.text_kmr, p.text_kmr);
    assert.equal(decoded.text_en, p.text_en);
    assert.equal(decoded.title_en, p.title_en);
  }
  const old = { text_kmr: "Old Kurmanji text", text_ckb: "دەق" };
  assert.deepEqual(decodeContent(old), old);
  assert.throws(
    () =>
      encodeContent(
        { text_kmr: "a".repeat(5000), text_en: "a".repeat(5000) },
        5000,
      ),
    (e) => e.code === "TRANSLATIONS_TOO_LONG",
  );
});
test("English source answers contain only the approved English passage", () => {
  const result = selectedAnswer(
    { sourceIds: ["faith"], answer: "Invented" },
    starterSources,
    "en",
  );
  assert.equal(result.answer, starterSources[3].content + " [faith]");
  assert.equal(result.mode, "approved-passages");
});
test("AI accepts English and returns a cited English passage", async () => {
  let prompt;
  const app = createApp({
    env: { GROQ_API_KEY: "test-only" },
    fetcher: async (_url, options) => {
      prompt = JSON.parse(options.body).messages[0].content;
      return {
        ok: true,
        json: async () => ({
          choices: [
            { message: { content: JSON.stringify({ sourceIds: ["faith"] }) } },
          ],
        }),
      };
    },
  });
  const r = await request(app)
    .post("/api/chat")
    .send({ question: "What is faith?", language: "en" });
  assert.equal(r.status, 200);
  assert.equal(r.body.grounded, true);
  assert.equal(r.body.answer, starterSources[3].content + " [faith]");
  assert.match(prompt, /English/);
  const refusal = await request(app)
    .post("/api/chat")
    .send({ question: "How do I repair a bicycle?", language: "en" });
  assert.equal(refusal.body.grounded, false);
  assert.match(refusal.body.answer, /approved sources/);
});
