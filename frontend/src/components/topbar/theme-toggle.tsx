'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  // Always start with 'dark' so server and client render identically.
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  // Block the real icon/label until after hydration to avoid mismatch.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('apex-theme') as 'dark' | 'light' | null;
    const initial = stored ?? 'dark';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme, mounted]);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('apex-theme', next);
  };

  // Before hydration, render a static dark-theme icon so server/client match.
  const label = mounted
    ? `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`
    : 'Switch to light theme';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      {mounted ? (
        theme === 'dark' ? (
          <Sun className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Moon className="h-4 w-4" aria-hidden="true" />
        )
      ) : (
        // Static placeholder that matches the server render (dark → Sun)
        <Sun className="h-4 w-4" aria-hidden="true" />
      )}
    </Button>
  );
}
