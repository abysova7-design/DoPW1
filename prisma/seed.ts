import { PrismaClient, PositionRank } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminCode = process.env.SEED_ADMIN_CODE ?? "admin-dev-2026";
  const hash = await bcrypt.hash(adminCode, 10);

  await prisma.user.upsert({
    where: { nickname: "Admin" },
    create: {
      nickname: "Admin",
      codeHash: hash,
      isAdmin: true,
      isDispatcher: true,
      positionRank: PositionRank.DIRECTOR,
      department: "Административный отдел",
      displayName: "Администратор портала",
    },
    update: { isAdmin: true, isDispatcher: true, codeHash: hash },
  });

  const mainAdminCode = process.env.SEED_MAIN_ADMIN_CODE ?? "00112579";
  const mainHash = await bcrypt.hash(mainAdminCode, 10);

  await prisma.user.upsert({
    where: { nickname: "Andrei_Frolov" },
    create: {
      nickname: "Andrei_Frolov",
      codeHash: mainHash,
      isAdmin: true,
      isDispatcher: true,
      positionRank: PositionRank.DIRECTOR,
      department: "Административный отдел",
      displayName: "Главный администратор",
    },
    update: {
      isAdmin: true,
      isDispatcher: true,
      codeHash: mainHash,
      positionRank: PositionRank.DIRECTOR,
      displayName: "Главный администратор",
    },
  });

  const vehicles = [
    { plate: "SA 2048", model: "Emperor",  notes: "Тестовая — штрафстоянка" },
    { plate: "LS 9912", model: "Sultan",   notes: "Нарушение парковки" },
    { plate: "SF 7731", model: "Blista",   notes: "Зона эвакуации SF" },
    { plate: "LV 4488", model: "Premier",  notes: "Запрос SAFMD" },
  ];
  for (const v of vehicles) {
    await prisma.vehicleRegistry.upsert({
      where: { plate: v.plate },
      create: v,
      update: { model: v.model, notes: v.notes },
    });
  }

  const channels = [
    { slug: "orders",       title: "📋 Приказы" },
    { slug: "attestations", title: "🎓 Результаты аттестаций" },
  ];
  for (const c of channels) {
    await prisma.channel.upsert({
      where: { slug: c.slug },
      create: c,
      update: { title: c.title },
    });
  }

  console.log("Seed OK. Admin / код:", adminCode);
  console.log("Главный админ: Andrei_Frolov / код:", mainAdminCode);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
