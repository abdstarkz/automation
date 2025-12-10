import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Music, Activity, UtensilsCrossed, Moon, Palette, Book, Edit3,
  Camera, Flower2, Monitor as MonitorIcon, Target, X, CheckCircle, Trash2
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../UI/Card';
import { Button } from '../UI/Button';

// Modernized PersonalTimeTracker with enhanced UI/UX (color fades, bold names, clear numbers, percent,
// unique logo backgrounds, shadow glow, hover effects)

const PASSION_ACTIVITIES = [
  { id: 'music', name: 'Music', icon: Music, color: 'purple' },
  { id: 'dance', name: 'Dance', icon: Activity, color: 'pink' },
  { id: 'cooking', name: 'Cooking', icon: UtensilsCrossed, color: 'orange' },
  { id: 'meditation', name: 'Meditation', icon: Moon, color: 'indigo' },
  { id: 'art', name: 'Art', icon: Palette, color: 'blue' },
  { id: 'reading', name: 'Reading', icon: Book, color: 'green' },
  { id: 'writing', name: 'Writing', icon: Edit3, color: 'teal' },
  { id: 'photography', name: 'Photography', icon: Camera, color: 'cyan' },
  { id: 'gardening', name: 'Gardening', icon: Flower2, color: 'lime' },
  { id: 'gaming', name: 'Gaming', icon: MonitorIcon, color: 'red' },
];

const TIME_OPTIONS = [5, 10, 15, 30, 45, 60, 90];

const COLOR_MAP: Record<string, { from: string; to: string; accent: string }> = {
  music:    { from: '#ede9fe', to: '#f3e8ff', accent: '#7c3aed' },     // purple
  dance:    { from: '#fff1f2', to: '#fff5f7', accent: '#ec4899' },     // pink
  cooking:  { from: '#fff7ed', to: '#fffaf0', accent: '#f97316' },     // orange
  meditation:{ from: '#eef2ff', to: '#eef2ff', accent: '#4f46e5' },   // indigo
  art:      { from: '#eff6ff', to: '#f0f9ff', accent: '#2563eb' },     // blue
  reading:  { from: '#ecfdf5', to: '#f0fdf4', accent: '#16a34a' },     // green
  writing:  { from: '#f0fdfa', to: '#ecfeff', accent: '#0d9488' },     // teal
  photography:{ from: '#ecfeff', to: '#f0f9ff', accent: '#06b6d4' },  // cyan
  gardening:{ from: '#f7fee7', to: '#f0fdf4', accent: '#84cc16' },    // lime
  gaming:   { from: '#fff1f2', to: '#fff7f7', accent: '#ef4444' },     // red
};

interface ActivityData {
  activityType: string;
  totalMinutes: number;
  weeklyGoal?: number | null;
}

interface PersonalTimeGoalRecord {
  activityType: string;
  weeklyGoal: number | null;
}

interface PersonalTimeTrackerProps {
  activities: ActivityData[];
  personalTimeGoals?: PersonalTimeGoalRecord[];
  onLogActivity: (activityType: string, duration: number | null) => Promise<void>;
  onSetGoal: (activityType: string, weeklyGoal: number | null) => Promise<void>;
}

export default function PersonalTimeTracker({
  activities = [],
  personalTimeGoals = [],
  onLogActivity,
  onSetGoal
}: PersonalTimeTrackerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [selectedMinutes, setSelectedMinutes] = useState<number>(15);
  const [logging, setLogging] = useState(false);

  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [goalInputs, setGoalInputs] = useState<Record<string, string>>({});
  const [savingGoals, setSavingGoals] = useState(false);

  useEffect(() => {
    if (!showGoalsModal) return;
    const map: Record<string, string> = {};
    for (const a of PASSION_ACTIVITIES) {
      const goalRec = personalTimeGoals.find(g => g.activityType === a.id);
      const goalValue = goalRec?.weeklyGoal ?? null;
      map[a.id] = (goalValue && goalValue > 0) ? String(goalValue) : '';
    }
    setGoalInputs(map);
  }, [showGoalsModal, personalTimeGoals]);

  const getActivityData = (activityId: string): ActivityData => {
    const fromActivities = activities.find(a => a.activityType === activityId);
    const weeklyGoalFromGoals = personalTimeGoals.find(g => g.activityType === activityId)?.weeklyGoal ?? null;

    return {
      activityType: activityId,
      totalMinutes: fromActivities?.totalMinutes ?? 0,
      weeklyGoal: fromActivities?.weeklyGoal ?? weeklyGoalFromGoals ?? null,
    };
  };

  const openMenuFor = (activityId: string, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    const padding = 12;
    const MENU_WIDTH = 320;
    const MENU_HEIGHT = 220;

    let left = (rect.left - (containerRect?.left ?? 0)) + rect.width / 2 - MENU_WIDTH / 2;
    let top = (rect.top - (containerRect?.top ?? 0)) + rect.height + 10;

    if (containerRect) {
      const maxLeft = containerRect.width - MENU_WIDTH - padding;
      if (left > maxLeft) left = maxLeft;
      if (left < padding) left = padding;

      const spaceBelow = containerRect.height - (rect.top - containerRect.top + rect.height);
      if (spaceBelow < MENU_HEIGHT + 24) {
        top = (rect.top - containerRect.top) - MENU_HEIGHT - 10;
        if (top < padding) top = padding;
      }
    }

    setMenuPos({ top, left });
    setSelectedMinutes(15);
    setSelectedActivity(activityId);
  };

  useEffect(() => {
    const handleDocDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setSelectedActivity(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedActivity(null);
        setShowGoalsModal(false);
      }
    };
    document.addEventListener('mousedown', handleDocDown);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDocDown);
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  const handleLog = async () => {
    if (!selectedActivity || !selectedMinutes || selectedMinutes <= 0) return;
    setLogging(true);
    try {
      await onLogActivity(selectedActivity, selectedMinutes);
      setSelectedActivity(null);
    } catch (err) {
      console.error('Failed to log personal time', err);
      alert('Failed to log activity. Please try again.');
    } finally {
      setLogging(false);
    }
  };

  const handleClearLog = async () => {
    if (!selectedActivity) return;
    if (!confirm(`Clear logged time for ${selectedActivity}?`)) return;
    setLogging(true);
    try {
      await onLogActivity(selectedActivity, null);
      setSelectedActivity(null);
    } catch (err) {
      console.error('Failed to clear personal time', err);
      alert('Failed to clear activity. Please try again.');
    } finally {
      setLogging(false);
    }
  };

  const handleSaveAllGoals = async () => {
    setSavingGoals(true);
    try {
      const entries = Object.entries(goalInputs);
      for (const [activityId, value] of entries) {
        const trimmed = value.trim();
        const goalValue = trimmed === '' ? null : Math.max(0, parseInt(trimmed, 10));

        const currentGoal = personalTimeGoals.find(g => g.activityType === activityId)?.weeklyGoal ?? null;
        const changed = (currentGoal ?? null) !== (goalValue ?? null);
        if (changed) {
          await onSetGoal(activityId, goalValue);
        }
      }
      setShowGoalsModal(false);
    } catch (err: any) {
      console.error('Failed to save goals', err);
      alert(err.message || 'Failed to save goals. Please try again.');
    } finally {
      setSavingGoals(false);
    }
  };

  const handleResetGoal = async (activityId: string) => {
    try {
      setGoalInputs(prev => ({ ...prev, [activityId]: '' }));
      await onSetGoal(activityId, null);
    } catch (err: any) {
      console.error('Failed to reset goal', err);
      alert(err.message || 'Failed to reset goal');
    }
  };

  const formatTime = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  };

  return (
    <Card className="shadow-lg hover:shadow-2xl transition-all">
      <CardHeader
        title="Personal Time"
        icon={<Music className="w-5 h-5 text-purple-600" />}
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowGoalsModal(true)} aria-label="Open goals">
              <Target className="w-4 h-4 mr-2" />
              Goals
            </Button>
            <Button size="sm" onClick={() => { setShowGoalsModal(true); }}>
              <CheckCircle className="w-4 h-4 mr-1" />
              Quick Goals
            </Button>
          </div>
        }
      />

      <CardContent>
        <div ref={containerRef} className="relative">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {PASSION_ACTIVITIES.map(activity => {
              const data = getActivityData(activity.id);
              const Icon = activity.icon;
              const hasGoal = (data.weeklyGoal ?? 0) > 0;
              const progress = hasGoal ? Math.min((data.totalMinutes / (data.weeklyGoal ?? 1)) * 100, 100) : 0;
              const colors = COLOR_MAP[activity.id] ?? { from: '#f3f4f6', to: '#ffffff', accent: '#6b7280' };

              return (
                <motion.button
                  key={activity.id}
                  layout
                  whileHover={{ y: -6, scale: 1.02 }}
                  className="w-full text-left p-3 bg-white rounded-2xl border border-gray-100 flex flex-col items-start gap-3 focus:outline-none relative overflow-hidden"
                  style={{
                    background: colors.from,
                    boxShadow: `0 6px 24px rgba(0,0,0,0.06), 0 0 18px ${colors.accent}22`,
                  }}
                  onClick={(e) => openMenuFor(activity.id, e.currentTarget as HTMLElement)}
                  aria-label={`Log ${activity.name}`}
                >
                  {/* logo badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12, display: 'grid', placeItems: 'center',
                      background: colors.accent,
                      boxShadow: `0 6px 18px ${colors.accent}33, inset 0 -6px 12px ${colors.accent}11`
                    }}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="text-base font-semibold text-gray-900 truncate" style={{ letterSpacing: 0.2 }}>{activity.name}</div>
                      <div className="text-xs text-gray-600 mt-0.5">{formatTime(data.totalMinutes)} logged</div>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-semibold text-gray-900">{hasGoal ? `${data.totalMinutes}` : '-'}</div>
                      <div className="text-xs text-gray-500 mt-1">{hasGoal ? `${Math.round(progress)}%` : '—'}</div>
                    </div>
                  </div>

                  {/* progress bar */}
                  <div className="w-full mt-2">
                    <div className="w-full h-2 bg-white/60 rounded-full overflow-hidden border border-white/30">
                      <div className="h-2 rounded-full" style={{ width: `${progress}%`, background: colors.accent }} />
                    </div>
                  </div>

                  {/* subtle glow */}
                  <div style={{ position: 'absolute', right: -40, top: -40, width: 120, height: 120, borderRadius: 60, background: colors.accent + '20', filter: 'blur(28px)', transform: 'rotate(15deg)' }} aria-hidden />
                </motion.button>
              );
            })}
          </div>

          {/* Floating log menu */}
          {selectedActivity && menuPos && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ top: menuPos.top, left: menuPos.left }}
              className="absolute z-50 w-[320px] p-4 rounded-xl bg-white border border-gray-200 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold capitalize">{selectedActivity}</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedActivity(null)} className="p-1 rounded hover:bg-gray-100">
                    <X className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-3">
                {TIME_OPTIONS.map(m => (
                  <button
                    key={m}
                    onClick={() => setSelectedMinutes(m)}
                    className={`text-sm py-2 rounded-md border transition ${
                      selectedMinutes === m
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-transparent'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                    aria-pressed={selectedMinutes === m}
                  >
                    {m}m
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 justify-end">
                <button
                  className="px-3 py-1 rounded-md border text-sm hover:bg-gray-50"
                  onClick={() => setSelectedActivity(null)}
                >
                  Cancel
                </button>

                <button
                  className="px-3 py-1 rounded-md border text-sm hover:bg-gray-50 flex items-center gap-2"
                  onClick={handleClearLog}
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                  Clear
                </button>

                <button
                  className="px-3 py-1 rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  onClick={handleLog}
                  disabled={logging || !selectedMinutes || selectedMinutes <= 0}
                >
                  {logging ? 'Logging...' : `Log ${selectedMinutes}m`}
                </button>
              </div>
            </motion.div>
          )}
        </div>

        <div className="mt-4 p-3 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl text-sm text-gray-700 flex items-start gap-3">
          <div className="text-purple-600 mt-0.5">✨</div>
          <div>
            <strong>Quick tips:</strong>
            <div className="text-xs text-gray-600">Tap any card to quickly log. Goals live separately so they persist across days.</div>
          </div>
        </div>
      </CardContent>

      {/* Goals modal */}
      {showGoalsModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => !savingGoals && setShowGoalsModal(false)} />

          <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative z-[70] w-full max-w-3xl bg-white rounded-2xl p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Weekly Goals (minutes/week)</h3>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setGoalInputs({}); }} title="Reset inputs">Reset</Button>
                <button onClick={() => setShowGoalsModal(false)} className="p-1 rounded hover:bg-gray-100" disabled={savingGoals}>
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 max-h-[60vh] overflow-y-auto">
              {PASSION_ACTIVITIES.map(activity => {
                const Icon = activity.icon;
                const current = goalInputs[activity.id] ?? '';
                const colors = COLOR_MAP[activity.id] ?? { from: '#f3f4f6', to: '#ffffff', accent: '#6b7280' };
                return (
                  <div key={activity.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: colors.from, boxShadow: `0 6px 18px ${colors.accent}11` }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, display: 'grid', placeItems: 'center', background: `linear-gradient(135deg, ${colors.accent}, ${colors.accent}88)`, boxShadow: `0 8px 20px ${colors.accent}22` }}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{activity.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">Weekly target</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={current}
                        onChange={(e) => setGoalInputs(prev => ({ ...prev, [activity.id]: e.target.value }))}
                        className="w-24 px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-purple-500"
                        disabled={savingGoals}
                        aria-label={`${activity.name} weekly goal`}
                      />

                      <button onClick={() => handleResetGoal(activity.id)} className="px-2 py-1 rounded-md border text-xs hover:bg-gray-100" disabled={savingGoals} title="Clear">
                        Clear
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowGoalsModal(false)} className="px-4 py-2 rounded-md border hover:bg-gray-50" disabled={savingGoals}>Cancel</button>
              <button onClick={handleSaveAllGoals} className="px-4 py-2 rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 text-white" disabled={savingGoals}>{savingGoals ? 'Saving...' : 'Save Goals'}</button>
            </div>
          </motion.div>
        </div>
      )}
    </Card>
  );
}
