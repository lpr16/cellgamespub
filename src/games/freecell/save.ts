// Tiny summary of the saved FreeCell game for the home screen.
import { load } from '../../shell/storage';

export function savedSummary(): string | null {
  const saved = load<{ moves?: number; done?: boolean; tableau?: unknown } | null>('freecell.game', null);
  if (!saved || saved.done || !saved.tableau) return null;
  const moves = saved.moves ?? 0;
  return `${moves} ${moves === 1 ? 'move' : 'moves'}`;
}
