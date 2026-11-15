# Orthodoxy in Kurdistan — backend

Owner sign-in is restricted server-side to the verified Supabase email `gelaguka6@gmail.com` (override with `OWNER_EMAIL`). Its first authenticated admin request assigns the single `admins` role if vacant. Unverified email accounts, user metadata claims and other addresses cannot claim ownership. Existing conflicting admin records are never deleted or replaced automatically. Published prayers remain available anonymously through `GET /api/prayers`; only writing and draft access require owner authentication.

English (`en`) is supported for AI answers and as an optional comparison translation on prayers/quotations. English source answers use the existing English evidence summary. Content translations use a tagged JSON envelope inside the existing `text_kmr` column and are decoded at API boundaries; legacy plain Kurdish rows remain compatible. No SQL migration is needed. On startup, English is added only to untouched seeded prayer texts, preserving owner edits. English fields are optional on custom records; the frontend clearly indicates missing translations.

## AI answer integrity

The AI now **selects approved source passages instead of writing or translating doctrine**. Groq returns only source IDs; the server supplies the selected Sorani/Kurmanji passage text and citation URLs. Arbitrary generated prose and links are discarded. If a source lacks the selected language or the evidence does not answer the question, the server refuses. This limits answers to the small approved library; expand it with the source editor.

The source editor supports English evidence/context plus Sorani and Kurmanji passages. Both Kurdish passages are required before approval. They are serialized into the existing `sources.content` column, so this update needs no SQL migration. On startup only untouched English starter summaries are upgraded to bilingual content; custom/edited source text is preserved. This prevents generated doctrinal paraphrases, but source selection, translation quality and source accuracy still require editorial review. The starter translations are site editorial translations, not official church translations.

## Initial prayer library

On startup, a configured backend initializes an empty library with eight bilingual traditional prayers/excerpts and four approved editorial AI source summaries. No credentials need to be committed. Existing rows with matching IDs are preserved; once any source exists, restarts leave the library alone, including edited and deleted prayers. A partially completed prayer-only import can recover if only built-in prayer IDs are present. Custom prayer libraries are never overwritten. Set `BOOTSTRAP_STARTER_CONTENT=false` to disable this behavior (also use this if intentionally removing the entire source collection and resetting all built-in content).

The eight entries are the morning opening, a short night prayer, Jesus Prayer, Rejoice O Virgin Theotokos, Our Father, O Heavenly King, Trisagion and a blessing before meals. Each links to an OCA or GOARCH publication and is marked as a site translation. These are **working Sorani/Kurmanji translations**, not official approved liturgical translations or full morning/evening prayer rules. The frontend prominently explains the review requirement. Owner edits can improve them without being replaced on deployment. See `src/prayers.js` for the catalogue and `test/bootstrap.test.js` for import safety tests.

## Prayers, single owner, and Render troubleshooting

Run the latest `supabase/schema.sql` in Supabase SQL Editor even if you ran an earlier version. It adds bilingual prayers and a database constraint permitting **at most one** admin. It never deletes existing users. If multiple old admin rows exist, resolve ownership manually before rerunning the migration.

Prayers use `GET /api/prayers` (published only) and the protected `/api/admin/prayers` CRUD endpoints, with Sorani/Kurmanji titles and texts, topic, source reference/URL and draft/publish state. Add editorially checked prayer translations in the admin panel; none are invented or automatically published.

To create the one owner, configure backend `.env`, run the latest schema, then:

```powershell
npm run setup-admin -- your-email@example.com
```

This creates a real Supabase Auth user with a randomly generated password, assigns the sole admin role, and saves credentials in `backend/admin-credentials.txt`, which Git and Docker ignore. It refuses to replace an existing administrator or overwrite saved credentials. Store the password securely, delete the local credentials file, and disable public sign-ups in Supabase Auth. Existing email accounts must be recovered and assigned manually in Supabase; this command does not reset their passwords. Sign in at `https://orthodoxfrontend.vercel.app/#admin`.

Render environment variables:

```text
FRONTEND_ORIGIN=https://orthodoxfrontend.vercel.app
TRUST_PROXY_HOPS=1
GROQ_API_KEY=<replacement Groq key>
SUPABASE_URL=<project URL>
SUPABASE_SECRET_KEY=<server secret or service-role key>
```

Render defaults to one trusted proxy when `RENDER=true` and `TRUST_PROXY_HOPS` is unset. An explicit hop count overrides this default. Revisit that count if adding another reverse proxy.

`aiConfigured: false` from `/api/health` means no Groq key is present. `databaseConfigured: true` only means the URL and key variables exist; it is not a live database test. Database query errors now distinguish missing schema (`DATABASE_SCHEMA_MISSING`) and invalid credentials (`DATABASE_CREDENTIALS_INVALID`). Run the SQL for missing tables; verify that both the URL and server key belong to the same project for key errors. Add the Groq token only to the backend, never Vercel.

Node 22+ / Express API, Supabase Auth + Postgres, Groq. Frontend: https://github.com/zazadev121/orthodoxfrontend

## Setup

1. Create a Supabase project. Run `supabase/schema.sql` in its SQL Editor.
2. Copy `.env.example` to `.env`. Set `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (a new secret key or legacy service-role key). Find these in Project Settings → API Keys; the project URL is available in the project's Connect dialog / Data API settings. **Never use a server key in the frontend.** A Postgres connection string is not needed.
3. Create an email/password user under Authentication → Users. Copy the user's UUID and run:

   ```sql
   insert into public.admins(user_id) values ('YOUR-USER-UUID') on conflict do nothing;
   ```

   Admin status is stored in a protected table, never in editable user metadata. Disable public sign-ups in Supabase Auth if only the owner needs an account. Set a strong password. Password resets can be sent from Supabase's dashboard; configure its Site URL and redirect URLs for your deployed frontend.

4. Create a **replacement** Groq API key and put it in backend `.env` as `GROQ_API_KEY`. Revoke any key previously pasted in chat. The app does not contain that key.
5. `npm ci`
6. `node --env-file=.env scripts/seed.mjs` to install four reviewed starter editorial summaries. With a configured database, AI uses only approved rows in `sources`; there is no hidden fallback corpus.
7. `npm run dev` (http://localhost:4000). Run the frontend separately.

## Environment

| Variable              | Purpose                                            |
| --------------------- | -------------------------------------------------- |
| `PORT`                | API port; default 4000                             |
| `FRONTEND_ORIGIN`     | Exact allowed frontend origins, comma separated    |
| `SUPABASE_URL`        | Project HTTPS URL                                  |
| `SUPABASE_SECRET_KEY` | Server-only secret or legacy service-role key      |
| `GROQ_API_KEY`        | Server-only replacement Groq key                   |
| `GROQ_MODEL`          | Configurable model; default `openai/gpt-oss-120b`  |
| `TRUST_PROXY_HOPS`    | Exact number of trusted reverse proxies; default 0 |

## API

- `GET /api/health`: configuration status, never secret values.
- `GET /api/quotes`: published quotations only.
- `GET /api/sources`: approved source metadata.
- `POST /api/chat`: `{ "question": "...", "language": "ckb" }`; `kmr` also supported. Defaults to Sorani. Returns answer, grounding status, and server-generated citation links.
- `GET /api/admin/me`: validates an administrator session.
- `GET, POST /api/admin/quotes`, `PATCH, DELETE /api/admin/quotes/:id`.
- `GET, POST /api/admin/sources`, `PATCH, DELETE /api/admin/sources/:id`.

All admin endpoints require `Authorization: Bearer <Supabase user access token>`. RLS and revoked table grants prevent direct browser database reads or writes. The API server owns all database access, checks the user with Supabase Auth, then checks `admins`. CORS is an origin policy, not authentication. Server keys bypass RLS and must remain private.

## Content and AI policy

The server never searches Reddit, forums, or the general web. Approved publishers are an exact allowlist in `src/sources.js`: OCA, Greek Orthodox Archdiocese of America, Ecumenical Patriarchate, Antiochian Archdiocese. Administrators must personally verify each source and Kurdish translation before publishing or approving it. A trusted hostname alone does not prove a passage is accurate.

AI uses lexical retrieval across multilingual keywords and approved source summaries. Expand the corpus and add Sorani/Kurmanji keywords in the admin panel. No match means a Kurdish refusal. The prompt restricts answers to retrieved evidence, and the server rejects missing/invented citation IDs, generated URLs and obvious wrong-script answers. Supplied source summaries are editorial paraphrases, not verbatim quotations. Public Church Fathers quotations start empty deliberately; add correctly attributed, checked Kurdish translations with work/section references.

**Limits:** generation cannot guarantee exclusive factual grounding, perfect Kurdish, or theological accuracy. Citation validation does not prove entailment; the script checks do not establish language fluency. The small initial corpus intentionally declines most topics. Have Kurdish-speaking Orthodox reviewers test answers, expand sources, and review translations before public launch. Pastoral decisions belong with clergy. Questions are sent to Groq but are not stored in this app's database.

Rate limits are per process/IP (100 API requests/minute, 8 AI questions/minute). For multi-instance public deployment, add a shared limiter and provider spend caps. No rate-limit bypass is enabled by default; configure proxy hops accurately for your host.

## Deployment

Deploy this folder as a Node web service (for example, a Node-compatible container host). Build/install command: `npm ci --omit=dev`. Start command: `npm start`. A `Dockerfile` is included. Set server environment variables in the host's secret manager, use HTTPS, and set `FRONTEND_ORIGIN` to the deployed frontend origin. Point the frontend's `VITE_API_URL` at this API and rebuild it. Configure Supabase Auth for the frontend domain. Never commit `.env` files.

## Verification

`npm test` covers authentication and admin-role rejection, published-only reads, input validation, source allowlisting, multilingual retrieval, AI refusal, citation checks, and mocked provider failures. `npm run check` verifies server syntax. Tests mock Supabase/Groq and do not assert live account connectivity. After setting credentials, verify admin sign-in → draft → publish → public quotation → edit → delete, and try grounded/refused AI questions in both languages.
