# Todo List

A todo app built with Vite + Vanilla JavaScript and backed by Supabase.

## Features

- Add new todos
- Mark todos as complete/incomplete
- Delete todos
- View todos in separate To do and Completed sections
- Clear all completed todos
- Sync todos with Supabase
- Automatic anonymous session for first-time visitors
- Account auth with email/password
- Account auth with magic links
- Automatic migration of guest todos into user accounts on login

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

   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

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

- Every todo row belongs to a single Supabase auth user.
- Guests are transparently signed in anonymously and can use the app immediately.
- Signing in with an existing account merges the current guest todos into that account.
- Signing up from a guest session links the current anonymous user to email/password.
- Signing out creates a fresh anonymous session for continued usage.

## Required Supabase Auth Settings

- Enable the **Email** provider in Supabase Auth.
- Keep **Confirm email** enabled or disabled based on your preference:
  - Enabled: user receives confirmation before a normal password login.
  - Disabled: user can sign in immediately after sign up.
- Add your app URL(s) in Auth URL configuration:
  - Local dev: `http://localhost:5173`
  - Production: your deployed app origin
- Add the same URLs to redirect allow-list for magic-link callbacks.

## Build For Production

```bash
pnpm build
pnpm preview
```