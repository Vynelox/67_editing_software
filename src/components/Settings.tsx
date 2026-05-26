import { useState } from 'react';
import { X, Settings as SettingsIcon } from 'lucide-react';

interface Settings {
  playneedleVerticalOffset: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onChange: (settings: Settings) => void;
}

export const DEFAULT_SETTINGS: Settings = {
  playneedleVerticalOffset: 50,
};

export default function Settings({ open, onClose, settings, onChange }: Props) {
  const [local, setLocal] = useState<Settings>(settings);

  if (!open) return null;

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const next = { ...local, [key]: value };
    setLocal(next);
    onChange(next);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="flex items-center gap-2">
            <SettingsIcon size={15} />
            Settings
          </span>
          <button className="icon-btn" onClick={onClose}><X size={15} /></button>
        </div>

        <div className="settings-fields">
          <label className="settings-field">
            <span className="settings-label">Playneedle Vertical Offset</span>
            <span className="settings-hint">Pixels from top of the timeline ruler</span>
            <input
              type="number"
              className="settings-input"
              value={local.playneedleVerticalOffset}
              min={0}
              max={500}
              onChange={e => update('playneedleVerticalOffset', Number(e.target.value))}
            />
          </label>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
