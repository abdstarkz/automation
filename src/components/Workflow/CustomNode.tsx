// src/components/Workflow/CustomNode.tsx
import { Handle, Position, NodeProps } from 'reactflow';
import clsx from 'clsx';
import type { NodeData } from '@/types/workflow.types';

export function CustomNode({ data }: NodeProps<NodeData>) {
  const variant = data.variant || 'default';

  return (
    <div
      className={clsx(
        'relative flex items-center justify-center rounded-xl shadow-md border transition-all duration-150 hover:scale-105 hover:shadow-lg',
        {
          'w-32 h-10 border-slate-200 bg-white':
            variant === 'default',
          'w-32 h-10 border-emerald-400 bg-emerald-50':
            variant === 'schedule',
          'w-32 h-10 border-violet-400 bg-violet-50':
            variant === 'loop',
        }
      )}
      style={{
        boxShadow:
          variant === 'schedule'
            ? '0 0 0 2px rgba(16, 185, 129, 0.25)'
            : variant === 'loop'
            ? '0 0 0 2px rgba(139, 92, 246, 0.25)'
            : '0 6px 14px rgba(15, 23, 42, 0.08)',
      }}
    >
      <div className="flex items-center h-full w-full px-3">
        {data.icon && <span className="flex-shrink-0 text-base mr-1">{data.icon}</span>}
        <span className="text-xs font-medium text-slate-700 whitespace-nowrap overflow-hidden text-ellipsis">
          {data.label}
        </span>
      </div>

      {/* connection handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-slate-400"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-slate-400"
      />
    </div>
  );
}
