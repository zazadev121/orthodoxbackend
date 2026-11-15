import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";
import { randomUUID } from "node:crypto";
import {
  approvedUrl,
  retrieve,
  starterSources,
  validateAnswer,
} from "../src/sources.js";

function memoryDb() {
  const rows = {
    quotes: [],
    prayers: [],
    sources: [],
    admins: [{ user_id: "user-id" }],
  };
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: "user-id" } }, error: null }),
    },
    from(table) {
      const filters = [];
      let op = "read",
        body;
      const execute = () => {
        let found = rows[table].filter((r) =>
          filters.every(([k, v]) => r[k] === v),
        );
        if (op === "insert") {
          const record = {
            ...body,
            id: randomUUID(),
            created_at: new Date().toISOString(),
          };
          rows[table].push(record);
          found = [record];
        }
        if (op === "update") found.forEach((r) => Object.assign(r, body));
        if (op === "delete")
          rows[table] = rows[table].filter((r) => !found.includes(r));
        return { data: found, error: null };
      };
      const chain = {
        select() {
          return chain;
        },
        eq(k, v) {
          filters.push([k, v]);
          return chain;
        },
        order() {
          return chain;
        },
        limit() {
          return chain;
        },
        insert(v) {
          op = "insert";
          body = v;
          return chain;
        },
        update(v) {
          op = "update";
          body = v;
          return chain;
        },
        delete() {
          op = "delete";
          return chain;
        },
        async single() {
          const result = execute();
          return { ...result, data: result.data[0] || null };
        },
        async maybeSingle() {
          return chain.single();
        },
        then(resolve, reject) {
          return Promise.resolve(execute()).then(resolve, reject);
        },
      };
      return chain;
    },
  };
}

test("prayer lifecycle protects drafts and supports bilingual edits", async () => {
  const app = createApp({ env: {}, db: memoryDb() });
  const draft = {
    title_ckb: "نوێژی تاقیکردنەوە",
    title_kmr: "Duaya ceribandinê",
    text_ckb: "دەقی تاقیکردنەوە",
    text_kmr: "Nivîsa ceribandinê",
    reference: "Test prayer, section 1",
    source_url: "https://www.oca.org/orthodoxy",
    topic: "Test",
    published: false,
  };
  assert.equal(
    (await request(app).post("/api/admin/prayers").send(draft)).status,
    401,
  );
  const created = await request(app)
    .post("/api/admin/prayers")
    .set("Authorization", "Bearer admin")
    .send(draft);
  assert.equal(created.status, 201);
  assert.deepEqual((await request(app).get("/api/prayers")).body.prayers, []);
  const id = created.body.id;
  assert.equal(
    (
      await request(app)
        .patch(`/api/admin/prayers/${id}`)
        .set("Authorization", "Bearer admin")
        .send({ ...draft, published: true })
    ).status,
    200,
  );
  const publicItems = (await request(app).get("/api/prayers")).body.prayers;
  assert.equal(publicItems.length, 1);
  assert.equal(publicItems[0].title_kmr, draft.title_kmr);
  assert.equal(
    (
      await request(app)
        .delete(`/api/admin/prayers/${id}`)
        .set("Authorization", "Bearer admin")
    ).status,
    204,
  );
  assert.deepEqual((await request(app).get("/api/prayers")).body.prayers, []);
});

test("Render defaults to one trusted proxy; explicit configuration takes precedence", () => {
  assert.equal(createApp({ env: { RENDER: "true" } }).get("trust proxy"), 1);
  assert.equal(
    createApp({ env: { RENDER: "true", TRUST_PROXY_HOPS: "0" } }).get(
      "trust proxy",
    ),
    false,
  );
  assert.equal(createApp({ env: {} }).get("trust proxy"), false);
});

test("missing tables and invalid database credentials return actionable setup codes", async () => {
  for (const [error, expected] of [
    [{ code: "PGRST205" }, "DATABASE_SCHEMA_MISSING"],
    [{ code: "42P01" }, "DATABASE_SCHEMA_MISSING"],
    [{ message: "Invalid API key" }, "DATABASE_CREDENTIALS_INVALID"],
  ]) {
    const db = {
      from() {
        const chain = {
          select() {
            return chain;
          },
          eq() {
            return chain;
          },
          order() {
            return chain;
          },
          limit: async () => ({ data: null, error }),
        };
        return chain;
      },
    };
    const res = await request(createApp({ env: {}, db })).get("/api/quotes");
    assert.equal(res.status, 503);
    assert.equal(res.body.code, expected);
  }
});

test("missing Groq key is reported before database retrieval", async () => {
  const app = createApp({
    env: {},
    db: {
      from() {
        throw new Error("must not query");
      },
    },
  });
  const res = await request(app)
    .post("/api/chat")
    .send({ question: "باوەڕ چییە؟" });
  assert.equal(res.status, 503);
  assert.equal(res.body.code, "AI_NOT_CONFIGURED");
});

test("quotation lifecycle: draft stays private, publish, edit, delete", async () => {
  const app = createApp({ env: {}, db: memoryDb() });
  const draft = {
    father: "Test editorial record",
    text_ckb: "دەقی تاقیکردنەوە",
    text_kmr: "Nivîsa ceribandinê",
    reference: "Test work, section 1",
    source_url: "https://www.oca.org/orthodoxy",
    topic: "Test",
    published: false,
  };
  const create = await request(app)
    .post("/api/admin/quotes")
    .set("Authorization", "Bearer admin")
    .send(draft);
  assert.equal(create.status, 201);
  const id = create.body.id;
  assert.deepEqual((await request(app).get("/api/quotes")).body.quotes, []);
  assert.equal(
    (
      await request(app)
        .patch(`/api/admin/quotes/${id}`)
        .set("Authorization", "Bearer admin")
        .send({ ...draft, published: true })
    ).status,
    200,
  );
  assert.equal((await request(app).get("/api/quotes")).body.quotes.length, 1);
  const edited = {
    ...draft,
    published: true,
    reference: "Test work, section 2",
  };
  assert.equal(
    (
      await request(app)
        .patch(`/api/admin/quotes/${id}`)
        .set("Authorization", "Bearer admin")
        .send(edited)
    ).body.reference,
    edited.reference,
  );
  assert.equal(
    (
      await request(app)
        .delete(`/api/admin/quotes/${id}`)
        .set("Authorization", "Bearer admin")
    ).status,
    204,
  );
  assert.deepEqual((await request(app).get("/api/quotes")).body.quotes, []);
  assert.equal(
    (
      await request(app)
        .delete(`/api/admin/quotes/${id}`)
        .set("Authorization", "Bearer admin")
    ).status,
    404,
  );
});

test("only approved source records are exposed and used for AI", async () => {
  let providerCalled = false;
  const app = createApp({
    env: { GROQ_API_KEY: "test-only" },
    db: memoryDb(),
    fetcher: async () => {
      providerCalled = true;
      return { ok: false };
    },
  });
  const source = {
    title: "Test source",
    publisher: "Orthodox Church in America",
    url: "https://www.oca.org/orthodoxy",
    content: "This is test editorial content used only for automated testing.",
    content_ckb: "دەقی سۆرانی بۆ تاقیکردنەوە",
    content_kmr: "Nivîsa Kurmancî ji bo ceribandinê",
    keywords: "testing",
    approved: false,
  };
  const created = await request(app)
    .post("/api/admin/sources")
    .set("Authorization", "Bearer admin")
    .send(source);
  assert.equal(created.status, 201);
  assert.deepEqual((await request(app).get("/api/sources")).body.sources, []);
  assert.equal(
    (
      await request(app)
        .post("/api/chat")
        .send({ question: "testing", language: "kmr" })
    ).body.grounded,
    false,
  );
  assert.equal(providerCalled, false);
  await request(app)
    .patch(`/api/admin/sources/${created.body.id}`)
    .set("Authorization", "Bearer admin")
    .send({ ...source, approved: true });
  const pub = await request(app).get("/api/sources");
  assert.equal(pub.body.sources.length, 1);
  assert.equal(pub.body.sources[0].content, undefined);
  assert.equal(
    (
      await request(app)
        .post("/api/chat")
        .send({ question: "testing", language: "kmr" })
    ).status,
    502,
  );
  assert.equal(providerCalled, true);
  assert.equal(
    (
      await request(app)
        .delete(`/api/admin/sources/${created.body.id}`)
        .set("Authorization", "Bearer admin")
    ).status,
    204,
  );
});

test("trusted URLs reject lookalikes, plaintext and credentials", () => {
  assert.equal(approvedUrl("https://www.oca.org/orthodoxy"), true);
  for (const url of [
    "https://oca.org.evil.example/a",
    "http://oca.org/a",
    "https://user:pass@oca.org/a",
    "https://reddit.com/a",
    "javascript:alert(1)",
  ])
    assert.equal(approvedUrl(url), false);
});
test("retrieval requires a relevant approved source in either language", () => {
  assert.ok(
    retrieve("نەریتی پیرۆز چییە؟", starterSources).some(
      (s) => s.id === "tradition",
    ),
  );
  assert.ok(
    retrieve("Bawerî çi ye?", starterSources).some((s) => s.id === "faith"),
  );
  assert.deepEqual(retrieve("how to repair a bicycle", starterSources), []);
});
test("answer validation rejects invented citations, wrong script and generated links", () => {
  assert.equal(
    validateAnswer(
      { answer: "وەڵام", citationIds: ["invented"] },
      starterSources,
      "ckb",
    ),
    null,
  );
  assert.equal(
    validateAnswer(
      { answer: "English response", citationIds: ["faith"] },
      starterSources,
      "ckb",
    ),
    null,
  );
  assert.equal(
    validateAnswer(
      { answer: "وەڵام https://reddit.com", citationIds: ["faith"] },
      starterSources,
      "ckb",
    ),
    null,
  );
  assert.equal(
    validateAnswer({ answer: "وەڵام", citationIds: [] }, starterSources, "ckb"),
    null,
  );
  assert.ok(
    validateAnswer(
      { answer: "باوەڕ [faith]", citationIds: ["faith"] },
      starterSources,
      "ckb",
    ).grounded,
  );
});
test("unconfigured database is explicit and never grants admin access", async () => {
  const app = createApp({ env: {} });
  const health = await request(app).get("/api/health");
  assert.equal(health.body.databaseConfigured, false);
  const quotes = await request(app).get("/api/quotes");
  assert.deepEqual(quotes.body.quotes, []);
  assert.equal(quotes.body.setupRequired, true);
  assert.equal((await request(app).get("/api/admin/quotes")).status, 503);
});
function mockDb({ admin = true, valid = true } = {}) {
  const calls = [];
  const db = {
    auth: {
      getUser: async () =>
        valid
          ? { data: { user: { id: "user-id" } }, error: null }
          : { data: { user: null }, error: {} },
    },
    from(table) {
      const chain = {
        select() {
          return chain;
        },
        eq(field, value) {
          calls.push([table, field, value]);
          return chain;
        },
        order() {
          return chain;
        },
        limit() {
          return Promise.resolve({
            data: table === "sources" ? starterSources : [],
            error: null,
          });
        },
        maybeSingle: async () => ({
          data: admin ? { user_id: "user-id" } : null,
          error: null,
        }),
      };
      return chain;
    },
  };
  return { db, calls };
}
test("admin endpoints reject missing tokens, invalid tokens and ordinary users", async () => {
  assert.equal(
    (
      await request(createApp({ env: {}, db: mockDb().db })).get(
        "/api/admin/me",
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await request(createApp({ env: {}, db: mockDb({ valid: false }).db }))
        .get("/api/admin/me")
        .set("Authorization", "Bearer invalid")
    ).status,
    401,
  );
  assert.equal(
    (
      await request(createApp({ env: {}, db: mockDb({ admin: false }).db }))
        .get("/api/admin/quotes")
        .set("Authorization", "Bearer user")
    ).status,
    403,
  );
  assert.equal(
    (
      await request(createApp({ env: {}, db: mockDb().db }))
        .get("/api/admin/me")
        .set("Authorization", "Bearer admin")
    ).status,
    200,
  );
});
test("public quotes always filter published records", async () => {
  const { db, calls } = mockDb();
  await request(createApp({ env: {}, db })).get("/api/quotes");
  assert.ok(
    calls.some(
      (c) => c[0] === "quotes" && c[1] === "published" && c[2] === true,
    ),
  );
});
test("AI refuses unsupported questions without calling Groq", async () => {
  let called = false;
  const app = createApp({
    env: { GROQ_API_KEY: "test-only" },
    fetcher: async () => {
      called = true;
    },
  });
  const res = await request(app)
    .post("/api/chat")
    .send({ question: "how to repair a bicycle", language: "ckb" });
  assert.equal(res.status, 200);
  assert.equal(res.body.grounded, false);
  assert.equal(called, false);
});
test("AI validates input and reports missing credentials", async () => {
  const app = createApp({ env: {} });
  assert.equal(
    (
      await request(app)
        .post("/api/chat")
        .send({ question: "faith", language: "en" })
    ).status,
    400,
  );
  assert.equal(
    (await request(app).post("/api/chat").send({ question: "faith" })).status,
    503,
  );
});
test("AI returns server-owned citations and defaults to Sorani", async () => {
  let payload;
  const app = createApp({
    env: { GROQ_API_KEY: "test-only" },
    fetcher: async (_url, options) => {
      payload = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  sourceIds: ["faith"],
                  answer:
                    "This malicious generated prose must never reach the visitor",
                }),
              },
            },
          ],
        }),
      };
    },
  });
  const res = await request(app)
    .post("/api/chat")
    .send({ question: "باوەڕ چییە؟" });
  assert.equal(res.status, 200);
  assert.equal(res.body.grounded, true);
  assert.equal(res.body.citations[0].publisher, "Orthodox Church in America");
  assert.ok(
    res.body.answer.startsWith(
      starterSources.find((s) => s.id === "faith").content_ckb,
    ),
  );
  assert.ok(!res.body.answer.includes("malicious"));
  assert.match(payload.messages[0].content, /Sorani/);
});
test("upstream errors and invalid model output fail closed", async () => {
  for (const fetcher of [
    async () => ({ ok: false }),
    async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "invalid json" } }],
      }),
    }),
    async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                answer: "باوەڕ",
                citationIds: ["fake"],
              }),
            },
          },
        ],
      }),
    }),
  ]) {
    const res = await request(
      createApp({ env: { GROQ_API_KEY: "test-only" }, fetcher }),
    )
      .post("/api/chat")
      .send({ question: "faith", language: "ckb" });
    assert.ok(res.status === 502 || res.body.grounded === false);
  }
});
test("admin writes validate all fields and publisher hosts", async () => {
  const app = createApp({ env: {}, db: mockDb().db });
  const res = await request(app)
    .post("/api/admin/quotes")
    .set("Authorization", "Bearer admin")
    .send({
      father: "Father",
      text_ckb: "دەق",
      text_kmr: "Gotin",
      reference: "Homily 1",
      source_url: "https://reddit.com/test",
      topic: "Love",
      published: true,
    });
  assert.equal(res.status, 400);
  assert.equal(
    (
      await request(app)
        .delete("/api/admin/quotes/not-a-uuid")
        .set("Authorization", "Bearer admin")
    ).status,
    400,
  );
});
