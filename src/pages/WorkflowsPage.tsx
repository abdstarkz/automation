// src/pages/WorkflowsPage.tsx
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { WorkflowTemplate } from '@/types/workflow.types';
import { WORKFLOW_TEMPLATES}  from '@/data/workflowTemplates';

const WORKFLOW_CATEGORIES = ['All', 'email', 'engagement', 'chat', 'automation', 'files', 'other'] as const;

interface WorkflowsPageProps {
  onSelectTemplate?: (template: WorkflowTemplate) => void;
}

export function WorkflowsPage({ onSelectTemplate }: WorkflowsPageProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<(typeof WORKFLOW_CATEGORIES)[number]>('All');

  const filtered = useMemo(() => {
    return WORKFLOW_TEMPLATES.filter((tpl: WorkflowTemplate) => {
      const matchesCategory =
        category === 'All' || tpl.category.toLowerCase() === category.toLowerCase();
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        tpl.name.toLowerCase().includes(q) ||
        tpl.description.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [category, search]);

  return (
    <div className="h-full w-full flex flex-col">
      <div className="px-8 pt-6 pb-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Workflow Templates</h1>
            <p className="text-sm text-slate-500">
              Choose from pre-built automations for email, data, health, and more.
            </p>
          </div>

          <div className="relative w-72 max-w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {WORKFLOW_CATEGORIES.map((cat: (typeof WORKFLOW_CATEGORIES)[number]) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-full border ${
                category === cat
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6 bg-slate-50">
        {filtered.length === 0 ? (
          <div className="text-center text-sm text-slate-500 mt-12">
            No templates match your search yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((tpl: WorkflowTemplate) => (
              <div
                key={tpl.id}
                onClick={() => onSelectTemplate?.(tpl)}
                className="relative flex flex-col border border-slate-200 rounded-xl bg-white hover:shadow-md hover:border-violet-300 transition-all duration-150 cursor-pointer"
              >
                <div
                  className="p-5 flex items-center gap-3"
                  style={{ borderBottom: `1px solid ${tpl.color}` }}
                >
                  <div
                    className="w-10 h-10 flex items-center justify-center rounded-full"
                    style={{ backgroundColor: `${tpl.color}20`, color: tpl.color }}
                  >
                    {tpl.icon}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-sm font-semibold text-slate-900 line-clamp-2">
                      {tpl.name}
                    </h2>
                    <p className="mt-2 text-xs text-slate-500 line-clamp-3">
                      {tpl.description}
                    </p>
                  </div>
                </div>

                <div className="p-5 mt-auto flex items-center justify-between text-xs">
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {tpl.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
