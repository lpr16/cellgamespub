import { Sheet } from './Sheet';
import { useSettings, type Theme } from './settings';

const THEMES: { id: Theme; label: string }[] = [
  { id: 'system', label: 'Auto' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

function Toggle(props: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="setting-row">
      <span>
        <span className="setting-label">{props.label}</span>
        {props.hint && <span className="setting-hint">{props.hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="switch"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
    </label>
  );
}

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { settings, update } = useSettings();
  return (
    <Sheet title="Settings" onClose={onClose}>
      <div className="setting-row">
        <span className="setting-label">Theme</span>
        <div className="segmented" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={settings.theme === t.id}
              className={settings.theme === t.id ? 'on' : ''}
              onClick={() => update({ theme: t.id })}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <Toggle
        label="Vibration"
        hint="A short buzz when you place a piece"
        checked={settings.haptics}
        onChange={(haptics) => update({ haptics })}
      />
      <Toggle
        label="Show mistakes"
        hint="Sudoku marks wrong digits straight away"
        checked={settings.showMistakes}
        onChange={(showMistakes) => update({ showMistakes })}
      />
    </Sheet>
  );
}
