import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash('AdminPass123!', 10);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      role: 'ADMIN',
      offlinePasswordHash: adminPassword,
    },
  });

  const analyst = await prisma.user.upsert({
    where: { email: 'analyst@example.com' },
    update: {},
    create: {
      email: 'analyst@example.com',
      role: 'ANALYST',
      offlinePasswordHash: adminPassword,
    },
  });

  const operative = await prisma.user.upsert({
    where: { email: 'operative@example.com' },
    update: {},
    create: {
      email: 'operative@example.com',
      role: 'FIELD_OPERATIVE',
      offlinePasswordHash: adminPassword,
    },
  });

  console.log('Seed completed successfully:', { admin, analyst, operative });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
