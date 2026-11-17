import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
export const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20261117171939_editorial_cms.sql",
    import.meta.url,
  ),
  "utf8",
);
export async function sqlFixture({ migrate = false } = {}) {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`,
  );
  await db.exec(
    readFileSync(
      new URL("../../supabase/schema.sql", import.meta.url),
      "utf8",
    ).replace("create extension if not exists pgcrypto;", ""),
  );
  if (migrate) await db.exec(migration);
  return db;
}
export function postgrestFixture(pg) {
  const images = new Map(),
    owner = {
      id: "11111111-1111-4111-8111-111111111111",
      email: "owner@example.test",
      email_confirmed_at: "2026-11-17T00:00:00Z",
    };
  const ident = (s) => {
    if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw Error("Unsafe fixture identifier");
    return `"${s}"`;
  };
  function from(table) {
    let operation = "read",
      body,
      projection = "*",
      filters = [],
      orders = [],
      offset = 0,
      limit = null,
      count = false;
    const execute = async () => {
      try {
        const params = [],
          param = (v) => {
            params.push(v);
            return "$" + params.length;
          };
        const joined = projection.includes("author:authors");
        const column = (k) =>
          k.startsWith("author.") ? "a." + ident(k.slice(7)) : "t." + ident(k);
        const conditions = filters.map(([op, k, v]) => {
          if (op === "is")
            return `${column(k)} is ${v === null ? "null" : v ? "true" : "false"}`;
          if (op === "notnull") return `${column(k)} is not null`;
          if (op === "in")
            return v.length
              ? `${column(k)} in (${v.map(param).join(",")})`
              : "false";
          if (op === "or") {
            const terms = [
              ...k.matchAll(/([a-z_]+)\.ilike\."((?:\\.|[^"])*)"/g),
            ].map(
              (m) =>
                `${column(m[1])} ilike ${param(m[2].replace(/\\([\\"])/g, "$1"))}`,
            );
            return "(" + (terms.join(" or ") || "true") + ")";
          }
          return `${column(k)} ${op === "eq" ? "=" : op === "gte" ? ">=" : op === "lte" ? "<=" : op === "ilike" ? "ilike" : "!="} ${param(v)}`;
        });
        const where = conditions.length
          ? " where " + conditions.join(" and ")
          : "";
        let rows, total;
        if (operation === "read") {
          const join = joined
            ? " join public.authors a on a.id=t.author_id"
            : "";
          if (count)
            total = (
              await pg.query(
                `select count(*)::int n from public.${ident(table)} t${join}${where}`,
                params,
              )
            ).rows[0].n;
          const order = orders.length
            ? " order by " +
              orders
                .map(([k, asc]) => column(k) + (asc ? " asc" : " desc"))
                .join(",")
            : "";
          const relation = joined
            ? ` || jsonb_build_object('author',to_jsonb(a))`
            : "";
          rows = (
            await pg.query(
              `select to_jsonb(t)${relation} as row from public.${ident(table)} t${join}${where}${order}${limit === null ? "" : " limit " + limit}${offset ? " offset " + offset : ""}`,
              params,
            )
          ).rows.map((r) => r.row);
          if (table === "doctrines" && projection.includes("doctrine_authors"))
            for (const row of rows)
              row.doctrine_authors = (
                await pg.query(
                  "select author_id from doctrine_authors where doctrine_id=$1",
                  [row.id],
                )
              ).rows;
        } else if (operation === "insert") {
          const fields = Object.keys(body),
            values = fields.map((k) => param(body[k]));
          rows = (
            await pg.query(
              `insert into public.${ident(table)} (${fields.map(ident).join(",")}) values(${values.join(",")}) returning to_jsonb(${ident(table)}.*) as row`,
              params,
            )
          ).rows.map((r) => r.row);
        } else if (operation === "update") {
          const set = Object.keys(body)
            .map((k) => `${ident(k)}=${param(body[k])}`)
            .join(",");
          rows = (
            await pg.query(
              `update public.${ident(table)} t set ${set}${where} returning to_jsonb(t) as row`,
              params,
            )
          ).rows.map((r) => r.row);
        } else
          rows = (
            await pg.query(
              `delete from public.${ident(table)} t${where} returning to_jsonb(t) as row`,
              params,
            )
          ).rows.map((r) => r.row);
        return { data: rows, error: null, count: total };
      } catch (error) {
        return {
          data: null,
          error: {
            code: error.code || "FIXTURE_ERROR",
            message: error.message,
          },
          count: null,
        };
      }
    };
    const chain = {
      select(value = "*", options = {}) {
        projection = value;
        count = !!options.count;
        return chain;
      },
      eq(k, v) {
        filters.push(["eq", k, v]);
        return chain;
      },
      is(k, v) {
        filters.push(["is", k, v]);
        return chain;
      },
      not(k, op, v) {
        if (op !== "is" || v !== null)
          throw Error("Unsupported fixture filter");
        filters.push(["notnull", k, v]);
        return chain;
      },
      in(k, v) {
        filters.push(["in", k, v]);
        return chain;
      },
      gte(k, v) {
        filters.push(["gte", k, v]);
        return chain;
      },
      lte(k, v) {
        filters.push(["lte", k, v]);
        return chain;
      },
      or(value) {
        filters.push(["or", value]);
        return chain;
      },
      order(k, { ascending = true } = {}) {
        orders.push([k, ascending]);
        return chain;
      },
      limit(n) {
        limit = n;
        return chain;
      },
      range(start, end) {
        offset = start;
        limit = end - start + 1;
        return chain;
      },
      insert(v) {
        operation = "insert";
        body = v;
        return chain;
      },
      update(v) {
        operation = "update";
        body = v;
        return chain;
      },
      delete() {
        operation = "delete";
        return chain;
      },
      async single() {
        const r = await execute();
        return { ...r, data: r.data?.[0] || null };
      },
      async maybeSingle() {
        return chain.single();
      },
      then(resolve, reject) {
        return execute().then(resolve, reject);
      },
    };
    return chain;
  }
  return {
    from,
    images,
    owner,
    auth: {
      getUser: async (token) => ({
        data: {
          user:
            token === "fixture-owner"
              ? owner
              : token === "ordinary-user"
                ? { ...owner, email: "reader@example.test" }
                : null,
        },
        error:
          token === "fixture-owner" || token === "ordinary-user"
            ? null
            : { message: "Invalid token" },
      }),
    },
    storage: {
      from: () => ({
        upload: async (path, bytes) => {
          images.set(path, bytes);
          return { data: { path }, error: null };
        },
        getPublicUrl: (path) => ({
          data: { publicUrl: "/api/_fixture-media/" + path },
        }),
      }),
    },
    rpc: async (name, args) => {
      try {
        if (name !== "save_doctrine_article")
          throw Error("Unknown fixture function");
        const r = await pg.query(
          "select public.save_doctrine_article($1::jsonb,$2::uuid[],$3::uuid,$4::timestamptz) as result",
          [
            JSON.stringify(args.p_row),
            args.p_authors,
            args.p_id,
            args.p_expected,
          ],
        );
        return { data: r.rows[0].result, error: null };
      } catch (error) {
        return {
          data: null,
          error: { code: error.code, message: error.message },
        };
      }
    },
  };
}
