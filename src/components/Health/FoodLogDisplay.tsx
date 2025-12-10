import { useState } from 'react';
import { UtensilsCrossed, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../UI/Card';

interface FoodItem {
  id: string;
  foodName: string;
  mealType: string;
  calories: number;
  carbs: number;
  fat: number;
  protein: number;
  loggedAt: string;
}

interface FoodLogDisplayProps {
  foodsByMeal: Record<string, FoodItem[]>;
  totalCalories: number;
  caloriesBurned: number;
  calorieGoal: number;
}

const MEAL_ORDER = ['Breakfast', 'Morning Snack', 'Lunch', 'Afternoon Snack', 'Dinner', 'Anytime'];

const MEAL_COLORS: Record<string, { from: string; to: string }> = {
  Breakfast: { from: '#FFD77A', to: '#FFB86B' }, // warm yellow → orange
  'Morning Snack': { from: '#8CE99A', to: '#38D9A9' }, // green
  Lunch: { from: '#7CC4FF', to: '#4BC0FF' }, // blue
  'Afternoon Snack': { from: '#D6B8FF', to: '#FFB3E6' }, // purple → pink
  Dinner: { from: '#FFB3A7', to: '#FF7A7A' }, // red/orange
  Anytime: { from: '#E2E8F0', to: '#CBD5E1' }, // grey-blue
};

export function FoodLogDisplay({ foodsByMeal, totalCalories, caloriesBurned, calorieGoal }: FoodLogDisplayProps) {
  const [expandedMeals, setExpandedMeals] = useState<Set<string>>(new Set());

  const toggleMeal = (mealType: string) => {
    setExpandedMeals(prev => {
      const newSet = new Set(prev);
      if (newSet.has(mealType)) newSet.delete(mealType);
      else newSet.add(mealType);
      return newSet;
    });
  };

  const getMealTotal = (mealType: string) => {
    const meals = foodsByMeal[mealType] || [];
    return meals.reduce((sum, food) => sum + (Number(food.calories) || 0), 0);
  };

  const netCalories = totalCalories - caloriesBurned;
  const calorieProgress = Math.min((totalCalories / calorieGoal) * 100, 100);

  const displayNetValue = (net: number, intake: number, burned: number) => {
    // if burned >= intake, show positive absolute value without '-' symbol (user requested)
    if (burned >= intake) return Math.abs(net);
    return net;
  };

  return (
    <Card className="shadow-2xl hover:shadow-2xl transition-shadow duration-300">
      <CardHeader
        title="Nutrition from Fitbit"
        icon={<UtensilsCrossed className="w-5 h-5 text-orange-500" />}
      />
      <CardContent>
        {/* Calorie Summary */}
        <div className="mb-6 p-4 rounded-lg" style={{ background: 'linear-gradient(90deg,#fff5eb,#fff1f0)' }}>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="p-3 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg mx-auto mb-2 shadow-lg">
                <UtensilsCrossed className="w-6 h-6 text-white" />
              </div>
              <div className="text-3xl font-semibold text-gray-900">{Math.round(totalCalories)}</div>
              <div className="text-gray-600">Intake</div>
            </div>
            <div className="text-center">
              <div className="p-3 bg-gradient-to-r from-green-500 to-teal-500 rounded-lg mx-auto mb-2 shadow-lg">
                <UtensilsCrossed className="w-6 h-6 text-white" />
              </div>
              <div className="text-3xl font-semibold text-gray-900">{Math.round(caloriesBurned)}</div>
              <div className="text-gray-600">Burned</div>
            </div>
            <div className="text-center">
              <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg mx-auto mb-2 shadow-lg">
                <UtensilsCrossed className="w-6 h-6 text-white" />
              </div>
              <div className={`text-3xl font-semibold text-gray-900`}>
                {displayNetValue(netCalories, totalCalories, caloriesBurned)}
              </div>
              <div className="text-gray-600">{caloriesBurned >= totalCalories ? 'Net (Deficit)' : 'Net'}</div>
            </div>
          </div>

          {/* Progress bar with softened shadow */}
          <div className="relative w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-sm">
            <div
              className="absolute h-3 rounded-full transition-all duration-600"
              style={{
                width: `${calorieProgress}%`,
                background: 'linear-gradient(90deg,#ff9f43,#ff6b6b)',
                boxShadow: '0 6px 18px rgba(255,107,107,0.12), inset 0 -4px 8px rgba(255, 255, 255, 0.25)'
              }}
            />
          </div>
          <div className="text-xs text-gray-500 text-center mt-2">Goal: {calorieGoal} kcal</div>
        </div>

        {/* Meal Breakdown */}
        <div className="space-y-4">
          {MEAL_ORDER.map(mealType => {
            const meals = foodsByMeal[mealType] || [];
            if (meals.length === 0) return null;

            const mealTotal = getMealTotal(mealType);
            const isExpanded = expandedMeals.has(mealType);
            const mealColors = MEAL_COLORS[mealType] ?? { from: '#f3f4f6', to: '#ffffff' };

            return (
              <div key={mealType} className="rounded-lg overflow-hidden border border-gray-100 shadow-md">
                {/* Meal Header */}
                <button
                  onClick={() => toggleMeal(mealType)}
                  className="w-full px-4 py-3 flex items-center justify-between transition-transform transform hover:-translate-y-0.5"
                  style={{
                    background: `linear-gradient(90deg, ${mealColors.from}, ${mealColors.to})`
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-lg font-semibold text-gray-900">{mealType}</div>
                    <div className="text-white text-sm opacity-90">
                      {meals.length} item{meals.length !== 1 ? 's' : ''}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-white font-bold">{Math.round(mealTotal)} kcal</div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-white" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-white" />
                    )}
                  </div>
                </button>

                {/* Expanded Meal Details */}
                {isExpanded && (
                  <div className="bg-white p-4 space-y-3">
                    {meals.map((food) => {
                      const safeCalories = Number(food.calories) || 0;
                      const safeCarbs = Number(food.carbs) || 0;
                      const safeFat = Number(food.fat) || 0;
                      const safeProtein = Number(food.protein) || 0;

                      // Calculate percentages only if we have valid data
                      const totalMacroCalories = (safeCarbs * 4) + (safeFat * 9) + (safeProtein * 4);
                      const hasMacroData = totalMacroCalories > 0;

                      const carbsPercent = hasMacroData && safeCalories > 0
                        ? Math.round((safeCarbs * 4 / safeCalories) * 100)
                        : 0;
                      const fatPercent = hasMacroData && safeCalories > 0
                        ? Math.round((safeFat * 9 / safeCalories) * 100)
                        : 0;
                      const proteinPercent = hasMacroData && safeCalories > 0
                        ? Math.round((safeProtein * 4 / safeCalories) * 100)
                        : 0;

                      return (
                        <div key={food.id} className="p-3 rounded-lg hover:shadow-lg transition-shadow duration-200" style={{ background: 'linear-gradient(180deg,#ffffff,#fbfdff)' }}>
                          <div className="flex justify-between items-start mb-3">
                            <div className="font-semibold text-gray-900 text-lg">{food.foodName}</div>
                            <div className="font-semibold text-orange-600 text-lg">{Math.round(safeCalories)} kcal</div>
                          </div>

                          {/* Show macro data or "estimated" badge */}
                          {hasMacroData ? (
                            <div className="grid grid-cols-3 gap-3 text-xs">
                              <div className="text-center p-3 rounded-md bg-gradient-to-b from-blue-50 to-blue-25">
                                <div className="font-semibold text-blue-800 text-sm">{Math.round(safeCarbs)}g</div>
                                <div className="text-gray-600">Carbs</div>
                                <div className="text-gray-400 text-[11px] mt-1">{carbsPercent}%</div>
                              </div>

                              <div className="text-center p-3 rounded-md bg-gradient-to-b from-red-50 to-red-25">
                                <div className="font-semibold text-red-800 text-sm">{Math.round(safeFat)}g</div>
                                <div className="text-gray-600">Fat</div>
                                <div className="text-gray-400 text-[11px] mt-1">{fatPercent}%</div>
                              </div>

                              <div className="text-center p-3 rounded-md bg-gradient-to-b from-green-50 to-green-25">
                                <div className="font-semibold text-green-800 text-sm">{Math.round(safeProtein)}g</div>
                                <div className="text-gray-600">Protein</div>
                                <div className="text-gray-400 text-[11px] mt-1">{proteinPercent}%</div>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 rounded-md bg-yellow-50 border border-yellow-200">
                              <div className="flex items-center gap-2 text-yellow-700 text-xs">
                                <span className="text-sm">ℹ️</span>
                                <span>Macro breakdown not available from Fitbit</span>
                              </div>
                            </div>
                          )}

                          <div className="text-xs text-gray-500 mt-3">
                            {new Date(food.loggedAt).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {Object.keys(foodsByMeal).length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <UtensilsCrossed className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No food logs for this date</p>
            <p className="text-sm mt-1">Log your meals in the Fitbit app</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default FoodLogDisplay;
