import { createClient } from "npm:@supabase/supabase-js@2.89.0";
import {
  isPublicEditorialPath,
  readEditorial,
} from "../_shared/editorial-read.js";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey,content-type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const keys = new Set(
  [
    Deno.env.get("SUPABASE_ANON_KEY"),
    ...Object.values(
      JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}"),
    ),
  ].filter(Boolean),
);
// This read-only function authenticates the project's public API key itself.
// There are no admin paths, writes, draft reads, or caller-provided database operations.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "GET")
    return new Response(JSON.stringify({ error: "Read-only endpoint." }), {
      status: 405,
      headers,
    });
  if (!keys.has(req.headers.get("apikey") || ""))
    return new Response(
      JSON.stringify({ error: "A valid project publishable key is required." }),
      { status: 401, headers },
    );
  const url = new URL(req.url),
    path = url.searchParams.get("path") || "";
  if (!isPublicEditorialPath(path))
    return new Response(JSON.stringify({ error: "Route not found." }), {
      status: 404,
      headers,
    });
  try {
    return new Response(
      JSON.stringify(await readEditorial(db, path, url.searchParams)),
      { headers },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: error.status
          ? error.message
          : "Published content is temporarily unavailable.",
      }),
      { status: error.status || 503, headers },
    );
  }
});
