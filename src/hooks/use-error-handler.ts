'use client';

import { useCallback } from 'react';
import { toast } from '@/hooks/use-toast';

export function useErrorHandler() {
  const handleError = useCallback((error: unknown, options?: { title?: string; silent?: boolean }) => {
    const message = error instanceof Error ? error.message : '操作失败';
    if (!options?.silent) {
      toast({ title: options?.title || '错误', description: message, variant: 'destructive' });
    }
    console.error('[UI Error]', error);
    return message;
  }, []);
  return { handleError };
}
