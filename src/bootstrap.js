import { createClient } from "@supabase/supabase-js";
import { starterSources, encodeSource } from "./sources.js";
import { starterPrayers } from "./prayers.js";

export const starterSourceRows = starterSources.map((source, i) =>
  encodeSource({
    ...source,
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    approved: true,
  }),
);
// Initialize a completely empty library only. Never replace editorial content.
// When any source or a custom prayer exists, future starts leave the library alone.
export async function bootstrapContent({ env = process.env, db } = {}) {
  if (env.BOOTSTRAP_STARTER_CONTENT === "false") return { status: "disabled" };
  if (!db && (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY))
    return { status: "unconfigured" };
  const client =
    db ||
    createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  const [sources, prayers] = await Promise.all([
    client.from("sources").select("id").limit(1),
    client.from("prayers").select("id").limit(200),
  ]);
  if (sources.error) throw sources.error;
  if (prayers.error) throw prayers.error;
  // Upgrade only untouched English starter summaries; owner-edited text is preserved.
  for (let i = 0; i < starterSources.length; i++) {
    const update = await client
      .from("sources")
      .update({ content: starterSourceRows[i].content })
      .eq("id", starterSourceRows[i].id)
      .eq("content", starterSources[i].content);
    if (update.error) throw update.error;
  }
  if (
    sources.data.length ||
    prayers.data.some((p) => !starterPrayers.some((s) => s.id === p.id))
  )
    return { status: "existing-content" };
  // Ignore existing IDs so a partial first import can recover without overwriting edits.
  const prayerResult = await client
    .from("prayers")
    .upsert(starterPrayers, { onConflict: "id", ignoreDuplicates: true });
  if (prayerResult.error) throw prayerResult.error;
  const sourceResult = await client
    .from("sources")
    .upsert(starterSourceRows, { onConflict: "id", ignoreDuplicates: true });
  if (sourceResult.error) throw sourceResult.error;
  return {
    status: "initialized",
    prayers: starterPrayers.length,
    sources: starterSourceRows.length,
  };
}
