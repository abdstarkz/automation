// scripts/estimate-missing-macros.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function estimateMissingMacros() {
  console.log('🔧 Estimating missing macronutrients...\n');
  
  const foods = await prisma.fitbitFood.findMany({
    where: {
      OR: [
        { carbs: 0 },
        { fat: 0 },
        { protein: 0 }
      ],
      calories: { gt: 0 }
    }
  });
  
  console.log(`Found ${foods.length} food items with missing macros but valid calories`);
  
  for (const food of foods) {
    // If macros are all zero but we have calories, estimate them
    if (food.carbs === 0 && food.fat === 0 && food.protein === 0) {
      const calories = food.calories;
      
      // Standard estimation: 40% carbs, 30% fat, 30% protein
      const estimatedCarbs = Math.round(((calories * 0.4) / 4) * 10) / 10;
      const estimatedFat = Math.round(((calories * 0.3) / 9) * 10) / 10;
      const estimatedProtein = Math.round(((calories * 0.3) / 4) * 10) / 10;
      
      await prisma.fitbitFood.update({
        where: { id: food.id },
        data: {
          carbs: estimatedCarbs,
          fat: estimatedFat,
          protein: estimatedProtein
        }
      });
      
      console.log(`✓ ${food.foodName}: ${calories} kcal → ${estimatedCarbs}g C, ${estimatedFat}g F, ${estimatedProtein}g P`);
    }
  }
  
  console.log('\n✅ Macro estimation completed!');
}

estimateMissingMacros()
  .catch(console.error)
  .finally(() => prisma.$disconnect());