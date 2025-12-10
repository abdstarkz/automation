import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function toStartOfDayUTC(dateInput: Date): Date {
  const dateStr = dateInput.toISOString().split('T')[0];
  return new Date(`${dateStr}T00:00:00.000Z`);
}

async function fixAllDates() {
  console.log('🔧 Starting comprehensive date fix...\n');
  
  // 1. Fix health_data
  console.log('1️⃣ Fixing health_data...');
  const healthData = await prisma.healthData.findMany();
  console.log(`   Found ${healthData.length} health records`);
  
  for (const record of healthData) {
    const fixedDate = toStartOfDayUTC(record.recordedAt);
    
    // Only update if dates are different
    if (record.recordedAt.getTime() !== fixedDate.getTime()) {
      await prisma.healthData.update({
        where: { id: record.id },
        data: { recordedAt: fixedDate }
      });
    }
  }
  console.log('   ✅ Health data fixed\n');
  
  // 2. Fix fitbit_foods
  console.log('2️⃣ Fixing fitbit_foods...');
  const foods = await prisma.fitbitFood.findMany();
  console.log(`   Found ${foods.length} food logs`);
  
  for (const food of foods) {
    const fixedDate = toStartOfDayUTC(food.recordedDate);
    
    if (food.recordedDate.getTime() !== fixedDate.getTime() || 
        food.loggedAt.getTime() !== fixedDate.getTime()) {
      await prisma.fitbitFood.update({
        where: { id: food.id },
        data: { 
          recordedDate: fixedDate,
          loggedAt: fixedDate
        }
      });
    }
  }
  console.log('   ✅ Food logs fixed\n');
  
  // 3. Fix fitbit_activities
  console.log('3️⃣ Fixing fitbit_activities...');
  const activities = await prisma.fitbitActivity.findMany();
  console.log(`   Found ${activities.length} activities`);
  
  for (const activity of activities) {
    const fixedDate = toStartOfDayUTC(activity.recordedAt);
    
    if (activity.recordedAt.getTime() !== fixedDate.getTime()) {
      await prisma.fitbitActivity.update({
        where: { id: activity.id },
        data: { recordedAt: fixedDate }
      });
    }
  }
  console.log('   ✅ Activities fixed\n');
  
  console.log('✅ All dates fixed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - Health data: ${healthData.length} records`);
  console.log(`   - Food logs: ${foods.length} records`);
  console.log(`   - Activities: ${activities.length} records`);
}

fixAllDates()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());