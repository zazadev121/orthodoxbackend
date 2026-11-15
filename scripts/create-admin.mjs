import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
import { z } from "zod";

const email = z.email().parse(process.argv[2] || process.env.ADMIN_EMAIL);
if (existsSync(new URL("../admin-credentials.txt", import.meta.url)))
  throw new Error(
    "admin-credentials.txt already exists. Store those credentials safely before running setup again.",
  );
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY)
  throw new Error(
    "Set SUPABASE_URL and SUPABASE_SECRET_KEY in backend/.env first.",
  );
const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const existing = await db.from("admins").select("user_id").limit(2);
if (existing.error)
  throw new Error(
    "Run the latest supabase/schema.sql before creating the owner.",
  );
if (existing.data.length)
  throw new Error(
    "An administrator already exists. No account or password was changed. Use Supabase Auth to recover that account.",
  );
const password = randomBytes(24).toString("base64url");
const created = await db.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (created.error)
  throw new Error(`Account creation failed: ${created.error.message}`);
const role = await db.from("admins").insert({ user_id: created.data.user.id });
if (role.error) {
  // Do not delete auth users automatically; any partial account can be recovered in Supabase.
  throw new Error(
    `User created but admin assignment failed. No password was saved. Inspect admins in Supabase and recover this user there. Code: ${role.error.code}`,
  );
}
writeFileSync(
  new URL("../admin-credentials.txt", import.meta.url),
  `Admin URL: https://orthodoxfrontend.vercel.app/#admin\nEmail: ${email}\nPassword: ${password}\n`,
  { flag: "wx", mode: 0o600 },
);
console.log(
  "Created the sole administrator. Credentials are in backend/admin-credentials.txt (ignored by Git). Store them in your password manager and delete that file afterward. Disable public sign-ups in Supabase Auth.",
);
