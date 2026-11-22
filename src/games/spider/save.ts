// Tiny summary of the saved Spider game for the home screen.
import { load } from '../../shell/storage';

const SUITS: Record<number, string> = { 1: 'One suit', 2: 'Two suits', 4: 'Four suits' };

export function savedSummary(): string | null {
  const saved = load<{ suits?: number; done?: boolean; foundations?: unknown[] } | null>('spider.game', null);
  if (!saved || saved.done || !saved.suits) return null;
  return `${SUITS[saved.suits] ?? 'Spider'} · ${saved.foundations?.length ?? 0}/8 runs`;
}
