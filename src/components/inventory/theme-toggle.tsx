'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Moon, Sun, Monitor } from 'lucide-react';

// ========== Theme Toggle ==========
function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);
  return mounted;
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  if (!mounted) return <Button variant="ghost" size="sm" className="h-9 w-9 p-0"><Sun className="h-4 w-4" /></Button>;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
          {theme === 'dark' ? <Moon className="h-4 w-4" /> : theme === 'light' ? <Sun className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}><Sun className="h-4 w-4 mr-2" />浅色</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}><Moon className="h-4 w-4 mr-2" />深色</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}><Monitor className="h-4 w-4 mr-2" />跟随系统</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { useMounted, ThemeToggle };
export default ThemeToggle;
