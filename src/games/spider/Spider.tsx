import { CardGameScreen } from '../cards/CardGameScreen';
import type { GameProps } from '../registry';
import { spiderRules } from './rules';

export default function Spider({ onExit }: GameProps) {
  return <CardGameScreen rules={spiderRules} onExit={onExit} />;
}
