import 'dotenv/config';

import { prisma } from '../lib/prisma.js';

const demoEntries = [
  {
    userId: 'demo-user',
    ambience: 'forest',
    text: 'I felt calm and steady after listening to layered rain in the forest.'
  },
  {
    userId: 'demo-user',
    ambience: 'ocean',
    text: 'The ocean session helped me slow my breathing and let go of work stress.'
  },
  {
    userId: 'demo-user',
    ambience: 'mountain',
    text: 'I left the mountain ambience feeling focused, clear, and ready for tomorrow.'
  },
  {
    userId: 'review-user',
    ambience: 'forest',
    text: 'The birds and wind made the journal entry feel easier to write tonight.'
  }
];

async function main() {
  const demoUserIds = Array.from(new Set(demoEntries.map((entry) => entry.userId)));
  const existingEntries = await prisma.journalEntry.findMany({
    where: {
      userId: {
        in: demoUserIds
      }
    },
    select: {
      id: true
    }
  });

  const existingEntryIds = existingEntries.map((entry) => entry.id);

  if (existingEntryIds.length > 0) {
    await prisma.journalAnalysis.deleteMany({
      where: {
        journalEntryId: {
          in: existingEntryIds
        }
      }
    });
  }

  await prisma.journalEntry.deleteMany({
    where: {
      userId: {
        in: demoUserIds
      }
    }
  });

  await prisma.journalEntry.createMany({
    data: demoEntries
  });

  console.log(`Seeded ${demoEntries.length} journal entries for demo users.`);
}

main()
  .catch((error) => {
    console.error('Seed failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

