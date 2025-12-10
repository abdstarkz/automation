// src/components/Workflow/WorkflowScheduleBar.tsx
import { Clock } from 'lucide-react';

export type ScheduleMode = 'once' | 'repeat';

export interface WorkflowSchedule {
  enabled: boolean;
  mode: ScheduleMode;
  every: number;
  unit: 'minutes' | 'hours' | 'days';
}

interface Props {
  value: WorkflowSchedule;
  onChange: (next: WorkflowSchedule) => void;
}

export default function WorkflowScheduleBar({ value, onChange }: Props) {
  const toggleEnabled = () => {
    onChange({ ...value, enabled: !value.enabled });
  };

  const handleEveryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = parseInt(e.target.value || '1', 10);
    onChange({ ...value, every: isNaN(n) ? 1 : n });
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...value, unit: e.target.value as WorkflowSchedule['unit'] });
  };

  return (
    <div className="border-t border-slate-200 bg-white px-6 py-3 flex items-center justify-between text-xs">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-violet-600 flex items-center justify-center">
          <Clock className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="font-semibold text-slate-900">
            {value.enabled ? 'Scheduled run' : 'Run once'}
          </p>
          <p className="text-[11px] text-slate-500">
            {value.enabled
              ? `Executes every ${value.every} ${value.unit}`
              : 'Workflow runs only when started manually or by trigger nodes.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 uppercase tracking-wide">
            Scheduling
          </span>
          <button
            type="button"
            onClick={toggleEnabled}
            className={`relative inline-flex h-6 w-10 items-center rounded-full transition ${
              value.enabled ? 'bg-violet-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                value.enabled ? 'translate-x-4' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {value.enabled && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={value.every}
              onChange={handleEveryChange}
              className="w-16 px-2 py-1 border border-slate-300 rounded text-xs"
            />
            <select
              value={value.unit}
              onChange={handleUnitChange}
              className="px-2 py-1 border border-slate-300 rounded text-xs bg-white"
            >
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
              <option value="days">days</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
