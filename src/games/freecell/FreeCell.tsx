import { CardGameScreen } from '../cards/CardGameScreen';
import type { GameProps } from '../registry';
import { freecellRules } from './rules';

export default function FreeCell({ onExit }: GameProps) {
  return <CardGameScreen rules={freecellRules} onExit={onExit} />;
}
