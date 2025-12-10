import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create test user
  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      fullName: 'Test User',
      passwordHash: 'hashed_password_here',
      emailVerified: true,
      isActive: true,
    },
  });

  console.log('✓ Created user:', user.id);

  // Create sample workflow
  const workflow = await prisma.workflow.create({
    data: {
      userId: user.id,
      name: 'Sample Workflow',
      description: 'A sample workflow for testing',
      workflowData: {
        nodes: [
          {
            id: 'node-1',
            type: 'custom',
            position: { x: 250, y: 50 },
            data: {
              label: 'Start',
              type: 'trigger_manual',
            },
          },
        ],
        edges: [],
      },
      isActive: true,
    },
  });

  console.log('✓ Created workflow:', workflow.id);

  console.log('✅ Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });