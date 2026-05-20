'use client';

import { InfoTooltip } from './InfoTooltip';

export type SortDir = 'asc' | 'desc';

interface Props<K extends string> {
  sortKey: K;
  activeKey: K;
  dir: SortDir;
  onClick: (k: K) => void;
  tooltip: string;
  align?: 'left' | 'right';
  children: React.ReactNode;
}

export function SortableTh<K extends string>({
  sortKey,
  activeKey,
  dir,
  onClick,
  tooltip,
  align = 'left',
  children,
}: Props<K>) {
  const active = sortKey === activeKey;
  const indicator = active ? (dir === 'asc' ? '↑' : '↓') : '↕';
  const alignClass = align === 'right' ? 'text-right' : 'text-left';
  const justifyClass = align === 'right' ? 'justify-end' : 'justify-start';
  return (
    <th className={`${alignClass} px-4 py-3 font-medium`}>
      <span className={`inline-flex items-center ${justifyClass} gap-1`}>
        <button
          type="button"
          onClick={() => onClick(sortKey)}
          className="inline-flex items-center gap-1 hover:text-white transition-colors"
        >
          <span className={active ? 'text-white' : ''}>{children}</span>
          <span className={`text-[10px] ${active ? 'text-blue-400' : 'text-gray-700'}`}>{indicator}</span>
        </button>
        <InfoTooltip position="bottom" text={tooltip} />
      </span>
    </th>
  );
}
