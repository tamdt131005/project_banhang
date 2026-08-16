import { useCallback, useEffect, useState } from 'react';

export interface BannerCarouselState {
  current: number;
  previous: number | null;
  direction: 1 | -1;
  paused: boolean;
  reducedMotion: boolean;
  goTo(index: number, direction?: 1 | -1): void;
  next(): void;
  previousSlide(): void;
  setHovered(value: boolean): void;
  setFocusWithin(value: boolean): void;
}

export function useBannerCarousel(length: number): BannerCarouselState {
  const [current, setCurrent] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const paused = hovered || focusWithin;

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const goTo = useCallback((index: number, nextDirection: 1 | -1 = 1) => {
    if (length < 2) return;
    const normalized = (index + length) % length;
    setCurrent((value) => {
      if (value === normalized) return value;
      setPrevious(value);
      setDirection(nextDirection);
      return normalized;
    });
  }, [length]);

  const next = useCallback(() => goTo(current + 1, 1), [current, goTo]);
  const previousSlide = useCallback(() => goTo(current - 1, -1), [current, goTo]);

  useEffect(() => {
    if (previous === null) return;
    const timer = window.setTimeout(() => setPrevious(null), reducedMotion ? 0 : 520);
    return () => window.clearTimeout(timer);
  }, [previous, reducedMotion]);

  useEffect(() => {
    if (length < 2 || paused || reducedMotion) return;
    const timer = window.setInterval(next, 4_000);
    return () => window.clearInterval(timer);
  }, [length, next, paused, reducedMotion]);

  useEffect(() => {
    if (current >= length) setCurrent(0);
  }, [current, length]);

  return {
    current,
    previous,
    direction,
    paused,
    reducedMotion,
    goTo,
    next,
    previousSlide,
    setHovered,
    setFocusWithin,
  };
}
