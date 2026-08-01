import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed a demo board so a fresh database has something to explore.
 * Safe to run repeatedly: it is a no-op once any board exists.
 */
async function main() {
  const existing = await prisma.board.count();
  if (existing > 0) {
    console.log(`Skipping seed: ${existing} board(s) already exist.`);
    return;
  }

  const board = await prisma.board.create({
    data: {
      title: "Product Launch",
      lists: {
        create: [
          {
            title: "To Do",
            position: 0,
            cards: {
              create: [
                { title: "Draft launch announcement", position: 0 },
                { title: "Design landing page", position: 1 },
              ],
            },
          },
          {
            title: "In Progress",
            position: 1,
            cards: {
              create: [
                {
                  title: "Set up analytics",
                  description: "Add funnel + conversion tracking",
                  position: 0,
                },
              ],
            },
          },
          { title: "Done", position: 2 },
        ],
      },
    },
  });

  console.log(`Seeded demo board: ${board.title} (${board.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
