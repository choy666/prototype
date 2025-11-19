# TODO: Fix Drizzle Migration Error for Enum Creation

## Problem
Running `npx drizzle-kit migrate` fails with error: type "order_status" already exists. This occurs because the enum is being created in multiple migration files, and the database already has it from a previous run or manual creation.

## Information Gathered
- The `order_status` enum is defined in `lib/schema.ts` with values: 'pending', 'paid', 'shipped', 'delivered', 'cancelled', 'rejected'.
- Migration files attempting to create the enum:
  - `drizzle/0000_violet_stardust.sql`: Creates with full values including 'rejected'.
  - `drizzle/0004_known_sleeper.sql`: Creates with values missing 'rejected'.
  - `drizzle/0002_high_loki.sql`: Creates `payment_status` enum.
- The database already contains the `order_status` enum, causing CREATE TYPE to fail.

## Plan
- Edit migration files to conditionally create types only if they do not exist, using PostgreSQL DO blocks.
- Update `drizzle/0000_violet_stardust.sql` to wrap CREATE TYPE for `order_status`.
- Update `drizzle/0002_high_loki.sql` to wrap CREATE TYPE for `payment_status`.
- Update `drizzle/0004_known_sleeper.sql` to wrap CREATE TYPE for `order_status`.

## Dependent Files to Edit
- `drizzle/0000_violet_stardust.sql`
- `drizzle/0002_high_loki.sql`
- `drizzle/0004_known_sleeper.sql`

## Followup Steps
- Since migrations are failing due to existing database objects, use `npx drizzle-kit push` to sync the schema directly.
- Run `npx drizzle-kit push` to push the current schema to the database.
- Verify that the push completes successfully.
- Test the application to ensure database schema is correct.

## Status
- [x] Edit `drizzle/0000_violet_stardust.sql`
- [x] Edit `drizzle/0002_high_loki.sql`
- [x] Edit `drizzle/0004_known_sleeper.sql`
- [ ] Run `npx drizzle-kit push`
- [ ] Verify success
