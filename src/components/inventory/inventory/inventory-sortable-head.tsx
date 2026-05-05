'use client';

import React from 'react';
import { TableHead } from '@/components/ui/table';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

interface SortableHeadProps {
  field: string;
  children: React.ReactNode;
  align?: 'left' | 'right';
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSortChange: (field: string) => void;
  onSortOrderToggle: () => void;
}

export default function SortableHead({
  field,
  children,
  align,
  sortBy,
  sortOrder,
  onSortChange,
  onSortOrderToggle,
}: SortableHeadProps) {
  const isActive = sortBy === field;

  function handleClick() {
    if (sortBy === field) {
      onSortOrderToggle();
    } else {
      onSortChange(field);
    }
  }

  return (
    <TableHead
      className={`${align === 'right' ? 'text-right' : ''} cursor-pointer select-none hover:bg-muted/50 transition-colors ${isActive ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
      onClick={handleClick}
    >
      <div className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        {children}
        {isActive ? (
          sortOrder === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </div>
    </TableHead>
  );
}
