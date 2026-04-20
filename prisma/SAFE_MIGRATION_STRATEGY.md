# Safe Migration Strategy (MySQL + Prisma)

This strategy avoids migration conflicts when old Railway databases still contain tables.

## 1) Verify target DB before migrate

Only run migrations against jlpt_master.

1. Check env value:
   - DATABASE_URL must end with /jlpt_master
2. Start backend once:
   - backend now validates DATABASE_URL and refuses other DB names.

## 2) Back up old DB first

Run a dump before applying new migrations:

- mysqldump -h <host> -P <port> -u <user> -p <db_name> > backup.sql

## 3) Check migration history table

Prisma uses \_prisma_migrations.

1. Compare local migration folders with rows in \_prisma_migrations.
2. If a migration failed earlier in Railway, resolve it explicitly:
   - npx prisma migrate resolve --rolled-back <migration_name>
   - npx prisma migrate deploy

## 4) Case sensitivity guard

Linux/Railway MySQL can be case sensitive for table names.

1. Ensure migration SQL uses exact Prisma table casing:
   - User, Admin, Course, Message, etc.
2. Do not mix lower-case and upper-case table names in migration SQL.

## 5) Deploy flow (production)

1. Set correct DATABASE_URL for jlpt_master.
2. Run:
   - npx prisma generate
   - npx prisma migrate deploy
3. Verify:
   - SELECT 1
   - SELECT COUNT(\*) FROM \_prisma_migrations;

## 6) If old Railway DB has extra tables

Do not drop tables immediately.

1. Point app only to jlpt_master.
2. Apply migrations to jlpt_master.
3. Validate app.
4. Archive or remove legacy tables after verification window.
