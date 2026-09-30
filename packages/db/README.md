# @mathgo/db

Drizzle schema (`src/schema.ts`) and SQL migrations (`drizzle/`) for Postgres.

## Changing the schema

1. Edit `src/schema.ts`.
2. `pnpm --filter @mathgo/db db:generate --name <short-name>` writes the next migration to `drizzle/`.
   Commit it with the schema change; never edit a migration that has shipped.
3. `pnpm --filter @mathgo/db test` applies every migration to an empty Postgres (PGlite, in memory)
   and checks the constraints.

Deleting a user removes their consent and trophy ledger and anonymises their matches, answers and
events, so an erasure request (UU PDP) is one `DELETE FROM users`.
