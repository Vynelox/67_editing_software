import { useEffect, useState } from 'react';
import ColorPicker from './ColorPicker';

type SettingsTab = 'appearance' | 'misc';

interface Props {
  open: boolean;
  onClose: () => void;
  playheadTop: number;
  onChangePlayheadTop: (v: number) => void;
  includeResizeInUndo: boolean;
  onToggleIncludeResizeInUndo: (v: boolean) => void;
}

function AppearanceControls() {
  const [subTab, setSubTab] = useState<'plain' | 'blend'>('plain');

  const colorFields: { varName: string; label: string }[] = [
    { varName: '--bg-base', label: 'Viewer background' },
    { varName: '--bg-panel', label: 'Timeline & Media Pool background' },
    { varName: '--bg-elevated', label: 'Panel elevated background' },
    { varName: '--bg-hover', label: 'Hover background' },
    { varName: '--border', label: 'Border / Grid line (dark)' },
    { varName: '--border-mid', label: 'Border / Grid line (mid)' },
    { varName: '--text-primary', label: 'Primary text' },
    { varName: '--text-secondary', label: 'Secondary text' },
    { varName: '--text-muted', label: 'Muted text' },
    { varName: '--clip-video-bg', label: 'Clip video background' },
    { varName: '--clip-video-border', label: 'Clip video border' },
    { varName: '--clip-audio-bg', label: 'Clip audio background' },
    { varName: '--clip-audio-border', label: 'Clip audio border' },
    { varName: '--clip-image-bg', label: 'Clip image background' },
    { varName: '--clip-image-border', label: 'Clip image border' },
    { varName: '--accent-green', label: 'Accent - green' },
    { varName: '--accent-rose', label: 'Accent - rose' },
    { varName: '--accent-orange', label: 'Accent - orange' }
  ];

  const [colors, setColors] = useState<Record<string, string>>({});

  useEffect(() => {
    const styles = getComputedStyle(document.documentElement);
    const initial: Record<string, string> = {};
    colorFields.forEach(c => {
      const raw = styles.getPropertyValue(c.varName).trim();
      initial[c.varName] = normalizeColor(raw || '#000000');
    });
    setColors(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function normalizeColor(raw: string) {
    if (!raw) return '#000000';
    const v = raw.trim();
    if (v.startsWith('#')) {
      // ensure 7-char hex
      if (v.length === 4) {
        return (
          '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3]
        ).toLowerCase();
      }
      return v;
    }
    if (v.startsWith('rgb')) {
      const nums = v.replace(/rgba?\(|\)/g, '').split(',').map(s => Number(s.trim()));
      const [r, g, b] = nums;
      return (
        '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('')
      ).toLowerCase();
    }
    return '#000000';
  }

  function updateColor(varName: string, hex: string) {
    document.documentElement.style.setProperty(varName, hex);
    setColors(prev => ({ ...prev, [varName]: hex }));
  }

  return (
    <div>
      <div className="appearance-subtabs">
        <button
          type="button"
          className={`appearance-subtab${subTab === 'plain' ? ' appearance-subtab--active' : ''}`}
          onClick={() => setSubTab('plain')}
        >
          Plain
        </button>
        <button
          type="button"
          className={`appearance-subtab${subTab === 'blend' ? ' appearance-subtab--active' : ''}`}
          onClick={() => setSubTab('blend')}
        >
          Blend
        </button>
      </div>

      {subTab === 'plain' && (
        <div className="appearance-plain">
          {colorFields.map(field => (
            <div key={field.varName} className="color-field">
              <div className="color-label">{field.label}</div>
              <div className="color-controls">
                <ColorPicker
                  value={colors[field.varName] || '#000000'}
                  onChange={(hex) => updateColor(field.varName, hex)}
                  fullScreen
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {subTab === 'blend' && (
        <div className="appearance-blend">
          {/* left intentionally blank for now */}
        </div>
      )}
    </div>
  );
}

export default function Settings({ open, onClose, playheadTop, onChangePlayheadTop, includeResizeInUndo, onToggleIncludeResizeInUndo }: Props) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('misc');

  if (!open) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-box settings-modal">
        <div className="modal-header modal-header--centered">
          <span className="panel-title settings-title">Settings</span>
          <button className="icon-btn modal-close-btn" onClick={onClose} aria-label="Close settings">✕</button>
        </div>

        <div className="settings-body">
          <nav className="settings-tabs" aria-label="Settings sections">
            <button
              type="button"
              className={`settings-tab${activeTab === 'appearance' ? ' settings-tab--active' : ''}`}
              onClick={() => setActiveTab('appearance')}
            >
              Appearance
            </button>
            <button
              type="button"
              className={`settings-tab${activeTab === 'misc' ? ' settings-tab--active' : ''}`}
              onClick={() => setActiveTab('misc')}
            >
              Misc
            </button>
          </nav>

          <div className="settings-panel">
            {activeTab === 'appearance' && (
              <div className="settings-panel-content">
                <div className="appearance-tabs" role="tablist" aria-label="Appearance sub-tabs">
                  <button
                    type="button"
                    className={`appearance-tab${'plain' === 'plain' ? ' appearance-tab--active' : ''}`}
                    onClick={() => { /* placeholder, controlled below */ }}
                    style={{ display: 'none' }}
                  />
                </div>

                <AppearanceControls />
              </div>
            )}

            {activeTab === 'misc' && (
              <div className="settings-panel-content">
                <label className="settings-field">
                  Playneedle vertical offset (%)
                  <input
                    type="number"
                    className="settings-number-input"
                    min={0}
                    max={100}
                    step={1}
                    value={playheadTop}
                    onChange={e => {
                      const v = Number(e.target.value);
                      if (!Number.isNaN(v)) onChangePlayheadTop(Math.min(100, Math.max(0, v)));
                    }}
                  />
                </label>

                <label className="settings-checkbox-field">
                  <span>Include splitter resize actions in Ctrl+Z/Ctrl+Y</span>
                  <input
                    type="checkbox"
                    className="settings-checkbox"
                    checked={includeResizeInUndo}
                    onChange={e => onToggleIncludeResizeInUndo(e.target.checked)}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
