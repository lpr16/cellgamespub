import { CardGameScreen } from '../cards/CardGameScreen';
import type { GameProps } from '../registry';
import { klondikeRules } from './rules';
import './solitaire.css';

export default function Solitaire({ onExit }: GameProps) {
  return <CardGameScreen rules={klondikeRules} onExit={onExit} />;
}
