import { useEffect, useState } from 'react';
import { type Theme, applyTheme, readTheme } from '../../lib/theme';
import { MoonIcon, SunIcon } from '../ui/icons';

export interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = '' }: Readonly<ThemeToggleProps>) {
  const [theme, setTheme] = useState<Theme>(() => readTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const next = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={next === 'dark' ? 'Chuyển sang chế độ tối' : 'Chuyển sang chế độ sáng'}
      className={`grid size-9 place-items-center rounded-full transition-colors duration-[160ms] hover:bg-sunken ${className}`}
    >
      {/* Icon là ĐÍCH ĐẾN (bấm để sang chế độ đó), khớp với aria-label. */}
      {theme === 'dark' ? <SunIcon className="size-4.5" /> : <MoonIcon className="size-4.5" />}
    </button>
  );
}
