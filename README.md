# Divvy 🍕

Split bills with friends, in any currency.

**Live:** [divvy-money.vercel.app](https://divvy-money.vercel.app/)

Divvy is a Splitwise-style expense-splitting app: create a group, invite
friends, log shared expenses, and let Divvy work out who owes whom. With
support for guest (anonymous) users, multi-currency expenses, and flexible
splitting (equal, exact, percentage, or shares).

## Stack

- **React 19** + **TypeScript**, built with **Vite**
- **Firebase Authentication** (anonymous + email/password, with in-place
  upgrade from guest to permanent account)
- **Cloud Firestore** for all data, with **Firestore Security Rules** as the
  sole authorization layer
- **Tailwind CSS v4** for styling
- **Vitest** for unit tests, plus an emulator-backed Firestore rules test
  suite (`@firebase/rules-unit-testing`)
- **Vercel** for hosting, with PWA support via `vite-plugin-pwa`

## Features

- Create a group and invite others via a shareable link (configurable
  expiration, max uses, and revocation)
- Join as a guest (anonymous account) or a permanent account; guests can
  upgrade in place without losing their history
- Add expenses in any currency, split equally, by exact amount, by
  percentage, or by shares, with live FX conversion to the group's base
  currency
- Automatic debt simplification ("who owes whom") and one-tap settle-up
- Placeholder members for people who haven't joined yet, with a merge flow
  once they do
- Rename, leave, remove a member, and archive/unarchive a group

## Getting started

```bash
npm install
cp .env.example .env   # fill in your Firebase project's web config
npm run dev
```

The app expects a Firebase project with **Authentication** (Anonymous +
Email/Password providers enabled) and **Firestore** set up. Copy your web
app config from the Firebase console into `.env` (see `.env.example` for the
required variable names).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run oxlint |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:rules` | Run the Firestore security rules test suite against a local emulator |

## Testing

- **Unit tests** (`tests/*.test.ts`) cover pure logic: expense splitting,
  debt simplification, invite-option logic — and run with plain `npm test`.
- **Firestore rules tests** (`tests/rules/*.rules.test.ts`) run the real
  `firestore.rules` against the Firebase Emulator Suite, including
  end-to-end tests that exercise the actual app functions
  (`src/lib/firestoreActions.ts`) through the real rules, not just isolated
  rule assertions. Run with `npm run test:rules`, which wraps
  `firebase emulators:exec`: no manual emulator setup needed. Requires
  **Java 21+** on `PATH` for the emulator.

## Deployment

**Hosting** is handled by Vercel's native GitHub integration — every push to
`main` is built and deployed automatically at
[divvy-money.vercel.app](https://divvy-money.vercel.app/). No manual steps
or CI config needed for this part.

**Firestore rules and indexes** (`firestore.rules` and
`firestore.indexes.json`) are separate from app hosting — Vercel doesn't
touch Firestore at all — and are deployed via
[`.github/workflows/firestore-rules.yml`](.github/workflows/firestore-rules.yml),
which runs the full test suite (lint, unit tests, emulator-backed rules
tests) before deploying on every push to `main`. To deploy them manually:

```bash
firebase deploy --only firestore
```

## Project structure

```
src/
  components/   Reusable UI components
  hooks/        Firestore-backed React hooks (live data via onSnapshot)
  lib/          Pure logic + Firestore read/write functions
  pages/        Route-level components
  types/        Shared TypeScript models
tests/
  *.test.ts       Unit tests for pure logic
  rules/          Firestore security rules tests (emulator-backed)
firestore.rules   Firestore security rules (the app's only authorization layer)
```
