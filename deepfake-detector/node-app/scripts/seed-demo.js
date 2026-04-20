import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const prisma = new PrismaClient();

const DEMO_USERS = [
  { email: 'admin@example.com', role: 'ADMIN' },
  { email: 'analyst@example.com', role: 'ANALYST' },
  { email: 'operative@example.com', role: 'FIELD_OPERATIVE' },
];

const ANALYSIS_FIXTURES = [
  { id: 1, riskLevel: 'HIGH_RISK', conf: 0.94, frames: 10, std: 0.08, needsReview: false },
  { id: 2, riskLevel: 'HIGH_RISK', conf: 0.88, frames: 10, std: 0.32, needsReview: true },
  { id: 3, riskLevel: 'MEDIUM_SUSPICION', conf: 0.72, frames: 10, std: 0.22, needsReview: true },
  { id: 4, riskLevel: 'MEDIUM_SUSPICION', conf: 0.65, frames: 8, std: 0.19, needsReview: true },
  { id: 5, riskLevel: 'AUTHENTIC', conf: 0.28, frames: 10, std: 0.07, needsReview: false },
  { id: 6, riskLevel: 'AUTHENTIC', conf: 0.14, frames: 10, std: 0.05, needsReview: false },
];

const gradcamDir = path.join(process.cwd(), 'uploads', 'gradcams');

function riskColors(riskLevel) {
  if (riskLevel === 'HIGH_RISK') return ['#7f1d1d', '#dc2626'];
  if (riskLevel === 'MEDIUM_SUSPICION') return ['#78350f', '#f59e0b'];
  return ['#064e3b', '#10b981'];
}

async function createGradcamPng(filePath, riskLevel) {
  const [start, end] = riskColors(riskLevel);
  const gradientSvg = `<svg width="224" height="224" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${start}" stop-opacity="0.85" />
        <stop offset="100%" stop-color="${end}" stop-opacity="0.75" />
      </linearGradient>
    </defs>
    <rect width="224" height="224" fill="#0a0a0a" />
    <rect width="224" height="224" fill="url(#g)" />
  </svg>`;
  await sharp(Buffer.from(gradientSvg)).png().toFile(filePath);
}

async function upsertDemoUsers() {
  const passwordHash = await bcrypt.hash('DemoPass123!', 10);
  const users = {};
  for (const user of DEMO_USERS) {
    users[user.email] = await prisma.user.upsert({
      where: { email: user.email },
      update: { role: user.role },
      create: {
        email: user.email,
        role: user.role,
        offlinePasswordHash: passwordHash,
      },
    });
  }
  return users;
}

async function seedAnalyses(analystUser) {
  const existingCount = await prisma.analysis.count({
    where: { userId: analystUser.id, videoFilename: { startsWith: 'demo-' } },
  });
  if (existingCount >= 6) {
    console.log('Demo seed already present. Skipping duplicate analysis creation.');
    return { analyses: [], skipped: true };
  }

  fs.mkdirSync(gradcamDir, { recursive: true });

  const created = [];
  for (const fixture of ANALYSIS_FIXTURES) {
    const frameScores = Array.from({ length: fixture.frames }, () => Number(fixture.conf.toFixed(2)));
    const gradcamName = `demo-${fixture.id}.png`;
    const gradcamPath = `/gradcams/${gradcamName}`;
    await createGradcamPng(path.join(gradcamDir, gradcamName), fixture.riskLevel);

    const analysis = await prisma.analysis.create({
      data: {
        userId: analystUser.id,
        videoFilename: `demo-${fixture.id}.mp4`,
        frameScores,
        aggregatedConfidence: fixture.conf,
        scoreStd: fixture.std,
        framesAnalyzed: fixture.frames,
        facesDetected: Math.max(1, fixture.frames - 2),
        riskLevel: fixture.riskLevel,
        needsReview: fixture.needsReview,
        reasoning: `Demo seed record ${fixture.id} for ${fixture.riskLevel}`,
        gradcamPath,
      },
    });
    created.push(analysis);
  }
  return { analyses: created, skipped: false };
}

async function seedReviewQueue(analyses) {
  let count = 0;
  for (const analysis of analyses) {
    if (!analysis.needsReview) continue;
    await prisma.reviewQueueItem.upsert({
      where: { analysisId: analysis.id },
      update: {},
      create: { analysisId: analysis.id, status: 'PENDING' },
    });
    count += 1;
  }

  if (analyses[0]) {
    await prisma.reviewQueueItem.upsert({
      where: { analysisId: analyses[0].id },
      update: { status: 'REVIEWED' },
      create: { analysisId: analyses[0].id, status: 'REVIEWED' },
    });
    count += 1;
  }

  return count;
}

async function seedChatSession(userId) {
  const existing = await prisma.chatSession.findFirst({
    where: { userId, title: 'Demo explanation thread' },
  });
  if (existing) return false;

  const session = await prisma.chatSession.create({
    data: {
      userId,
      title: 'Demo explanation thread',
    },
  });

  await prisma.chatMessage.createMany({
    data: [
      { sessionId: session.id, role: 'user', content: 'Why was this flagged as high risk?' },
      {
        sessionId: session.id,
        role: 'model',
        content:
          'The model identified unusually consistent facial blending artifacts around the jawline and temporal flicker around eye regions.',
      },
      {
        sessionId: session.id,
        role: 'user',
        content: 'Could it be compression noise instead?',
      },
    ],
  });
  return true;
}

async function main() {
  const users = await upsertDemoUsers();
  const { analyses, skipped } = await seedAnalyses(users['analyst@example.com']);
  if (skipped) {
    console.log('✓ Demo seed already exists. No new records were created.');
    return;
  }

  const reviewCount = await seedReviewQueue(analyses);
  const chatCreated = await seedChatSession(users['analyst@example.com'].id);

  console.log(
    `✓ Seeded 3 users, ${analyses.length} analyses, ${reviewCount} review items, ${chatCreated ? 1 : 0} chat session`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
