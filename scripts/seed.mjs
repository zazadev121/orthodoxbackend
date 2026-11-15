import { createClient } from "@supabase/supabase-js";
import { starterSources } from "../src/sources.js";
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY)
  throw new Error("Configure backend .env first.");
const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
);
// Stable IDs make repeated runs idempotent. Custom admin sources are preserved.
const rows = starterSources.map((s, i) => ({
  ...s,
  id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  approved: true,
}));
const { error } = await db.from("sources").upsert(rows);
if (error) throw error;
console.log(
  "Seeded four editorial source summaries. Review them in the admin panel.",
);
