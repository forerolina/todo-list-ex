# Todo List

A todo app built with Vite + Vanilla JavaScript and backed by Supabase.

## Features

- Add new todos
- Mark todos as complete/incomplete
- Delete todos
- View todos in separate To do and Completed sections
- Clear all completed todos
- Sync todos with Supabase
- Anonymous per-browser sessions (no login UI)

## Tech

- Vite
- Vanilla JavaScript
- Supabase (`@supabase/supabase-js`)

## Getting Started

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Configure environment variables:

   ```bash
   cp .env.example .env
   ```

   Fill in:

   - `VITE_SUPABASE_PROJECT_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`

3. Start the development server:

   ```bash
   pnpm dev
   ```

4. Open the local URL shown in the terminal.

## Supabase CLI Setup

Run once for this project:

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref qlpikytyzehkytbwdxfk
pnpm exec supabase config push
pnpm db:push
```

This project uses migrations from `supabase/migrations/`.

For future schema updates:

```bash
pnpm db:new <migration_name>
# edit the generated SQL migration
pnpm db:push
```

## Notes

- Todos are scoped to the browser's anonymous auth session.
- Clearing browser storage creates a new anonymous user and a new empty todo list.

## Build For Production

```bash
pnpm build
pnpm preview
```