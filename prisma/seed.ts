import "dotenv/config";

import bcrypt from "bcrypt";
import { AdminRole } from "@prisma/client";

import { prisma } from "../src/shared/prisma";

const saltRounds = 12;

async function main() {
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  const name = process.env.ADMIN_SEED_NAME ?? "JLPT Master";

  let admin = await prisma.admin.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true },
  });

  if (email && password) {
    const passwordHash = await bcrypt.hash(password, saltRounds);

    admin = await prisma.admin.upsert({
      where: { email },
      update: { name, password: passwordHash, role: AdminRole.super_admin },
      create: {
        name,
        email,
        password: passwordHash,
        role: AdminRole.super_admin,
      },
      select: { id: true, email: true, name: true },
    });

    console.log(`Seeded admin: ${admin.email}`);
  }

  if (!admin) {
    console.log(
      "Seed skipped: create an Admin first or set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD",
    );
    return;
  }

  const courses = [
    {
      title: "JLPT N5 kursi",
      duration: 3,
      description: "Boshlang‘ich daraja\nDavomiyligi: 3 oy",
    },
    {
      title: "JLPT N4 kursi",
      duration: 4,
      description: "Boshlang‘ich-o‘rta daraja\nDavomiyligi: 4 oy",
    },
    {
      title: "JLPT N3 kursi",
      duration: 5,
      description: "O‘rta daraja\nDavomiyligi: 5 oy",
    },
    {
      title: "JLPT N2 kursi",
      duration: 6,
      description: "Yuqori daraja\nDavomiyligi: 6 oy",
    },
    {
      title: "JLPT N1 kursi",
      duration: 6,
      description: "Eng yuqori daraja\nDavomiyligi: 6 oy",
    },
  ];

  for (const c of courses) {
    const existing = await prisma.course.findFirst({
      where: { title: c.title },
      select: { id: true },
    });

    if (existing) {
      await prisma.course.update({
        where: { id: existing.id },
        data: {
          title: c.title,
          description: c.description,
          duration: c.duration,
          isActive: true,
        },
      });
      continue;
    }

    await prisma.course.create({
      data: {
        title: c.title,
        description: c.description,
        duration: c.duration,
        isActive: true,
      },
    });
  }

  console.log(`Seeded courses: ${courses.length}`);

  const goals = [
    { sortOrder: 10, title: "📝 JLPT imtihoni" },
    { sortOrder: 20, title: "💼 Ishlash uchun" },
    { sortOrder: 30, title: "🎓 O‘qish uchun" },
    { sortOrder: 40, title: "✈️ Sayohat uchun" },
    { sortOrder: 50, title: "🗣 Muloqot uchun" },
    { sortOrder: 60, title: "🎬 Anime/Manga" },
    { sortOrder: 70, title: "🏯 Madaniyat" },
    { sortOrder: 80, title: "📈 Shaxsiy rivojlanish" },
    { sortOrder: 90, title: "✅ Boshqa" },
  ];

  for (const g of goals) {
    const existing = await prisma.goal.findFirst({
      where: { title: g.title },
      select: { id: true },
    });

    if (existing) {
      await prisma.goal.update({
        where: { id: existing.id },
        data: { title: g.title, sortOrder: g.sortOrder, isActive: true },
      });
      continue;
    }

    await prisma.goal.create({
      data: { title: g.title, sortOrder: g.sortOrder, isActive: true },
    });
  }

  console.log(`Seeded goals: ${goals.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
