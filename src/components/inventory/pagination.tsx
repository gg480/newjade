'use client';

import React from 'react';
import { Button } from '@/components/ui/button';

interface PaginationProps {
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export default function Pagination({ page, pages, onPageChange, className = '' }: PaginationProps) {
  if (pages <= 1) return null;

  // Generate page numbers to display
  function getPageNumbers(): (number | 'ellipsis')[] {
    const nums: (number | 'ellipsis')[] = [];
    if (pages <= 7) {
      for (let i = 1; i <= pages; i++) nums.push(i);
    } else {
      nums.push(1);
      if (page > 3) nums.push('ellipsis');
      const start = Math.max(2, page - 1);
      const end = Math.min(pages - 1, page + 1);
      for (let i = start; i <= end; i++) nums.push(i);
      if (page < pages - 2) nums.push('ellipsis');
      nums.push(pages);
    }
    return nums;
  }

  return (
    <div className={`flex items-center justify-center gap-1 flex-wrap ${className}`}>
      <Button
        size="sm"
        variant="outline"
        className="h-8 px-2 text-xs"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        上一页
      </Button>

      {getPageNumbers().map((num, idx) => {
        if (num === 'ellipsis') {
          return (
            <span key={`ellipsis-${idx}`} className="px-2 text-xs text-muted-foreground select-none">
              ...
            </span>
          );
        }
        return (
          <Button
            key={num}
            size="sm"
            variant={num === page ? 'default' : 'outline'}
            className={`h-8 w-8 p-0 text-xs ${num === page ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
            onClick={() => onPageChange(num)}
          >
            {num}
          </Button>
        );
      })}

      <Button
        size="sm"
        variant="outline"
        className="h-8 px-2 text-xs"
        disabled={page >= pages}
        onClick={() => onPageChange(page + 1)}
      >
        下一页
      </Button>
    </div>
  );
}
