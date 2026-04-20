import "dotenv/config";

import bcrypt from "bcrypt";
import { AdminRole } from "@prisma/client";

import { prisma } from "../src/shared/prisma";

const saltRounds = 12;

/**
 * Seed admin from environment variables
 * - Upsert by email (unique key)
 * - Does NOT delete existing admins
 * - Updates existing admin if email matches
 * - Safe to run multiple times (idempotent)
 */
async function seedAdmin(): Promise<void> {
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  const name = process.env.ADMIN_SEED_NAME ?? "JLPT Master";
  const tgUsernameRaw = process.env.ADMIN_SEED_TELEGRAM_USERNAME;

  // Normalize Telegram username
  const tgUsername =
    typeof tgUsernameRaw === "string" && tgUsernameRaw.trim().length > 0
      ? tgUsernameRaw.trim().replace(/^@+/, "").toLowerCase()
      : null;

  if (!email || !password) {
    console.log(
      "⚠️  Admin seed skipped: ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD not set",
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password, saltRounds);

  const admin = await prisma.admin.upsert({
    where: { email },
    update: {
      name,
      password: passwordHash,
      role: AdminRole.super_admin,
      tgUsername,
      // Note: tgChatId is NOT updated here - populated by bot /start
    },
    create: {
      name,
      email,
      password: passwordHash,
      role: AdminRole.super_admin,
      tgUsername,
      tgChatId: null,
    },
    select: { id: true, email: true, name: true, tgUsername: true },
  });

  console.log(`✅ Admin upserted: ${admin.email}`);
}

async function main() {
  await seedAdmin();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
