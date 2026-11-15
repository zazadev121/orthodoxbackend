export const defaultOwnerEmail = "gelaguka6@gmail.com";
export function verifiedOwner(user, email = defaultOwnerEmail) {
  return (
    typeof user?.email === "string" &&
    user.email.trim().toLowerCase() === email.trim().toLowerCase() &&
    !!user.email_confirmed_at
  );
}
export async function ensureOwnerRole(db, user) {
  async function find() {
    const result = await db
      .from("admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (result.error) throw result.error;
    return !!result.data;
  }
  if (await find()) return true;
  const added = await db.from("admins").insert({ user_id: user.id });
  if (added.error && added.error.code !== "23505") throw added.error;
  // Re-read after insertion so simultaneous requests are safe. A different sole
  // owner is never silently removed or replaced.
  return find();
}
