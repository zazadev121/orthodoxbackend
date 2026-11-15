import { createClient } from "@supabase/supabase-js";
import { starterSourceRows } from "../src/bootstrap.js";
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY)
  throw new Error("Configure backend .env first.");
const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
);
// Stable IDs make repeated runs idempotent. Custom admin sources are preserved.
const rows = starterSourceRows;
const { error } = await db.from("sources").upsert(rows);
if (error) throw error;
console.log(
  "Seeded four editorial source summaries. Review them in the admin panel.",
);
