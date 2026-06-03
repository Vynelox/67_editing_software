import { useState, useEffect } from 'react';
import { OpenColorPicker } from './ColorPicker';

function normalizeColor(raw: string) {
  if (!raw) return '#000000';
  const v = raw.trim();
  if (v.startsWith('#')) {
    if (v.length === 4) return '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
    return v;
  }
  if (v.startsWith('rgb')) {
    const nums = v.replace(/rgba?\(|\)/g, '').split(',').map(s => Number(s.trim()));
    return '#' + nums.slice(0, 3).map(n => n.toString(16).padStart(2, '0')).join('');
  }
  return '#000000';
}

const colorFields: { varName: string; label: string }[] = [
  { varName: '--bg-panel', label: 'Primary background' },
  { varName: '--bg-base', label: 'Secondary background' },
  { varName: '--bg-viewer', label: 'Viewer background' },
  { varName: '--bg-elevated', label: 'Panel elevated background' },
  { varName: '--bg-hover', label: 'Hover background' },
  { varName: '--border', label: 'Border / Grid line (dark)' },
  { varName: '--border-mid', label: 'Border / Grid line (mid)' },
  { varName: '--text-primary', label: 'Primary text' },
  { varName: '--text-secondary', label: 'Secondary text' },
  { varName: '--text-muted', label: 'Muted text' },
  { varName: '--input-field', label: 'Input field primary' },
  { varName: '--input-field-bg', label: 'Input field secondary' }
];

const ogDarkColors: Record<string, string> = {
  '--bg-panel': '#13141a',
  '--bg-base': '#0c0d10',
  '--bg-viewer': '#060608',
  '--bg-elevated': '#1a1c24',
  '--bg-hover': '#21242f',
  '--border': '#262830',
  '--border-mid': '#303340',
  '--text-primary': '#e8eaf0',
  '--text-secondary': '#8b8fa8',
  '--text-muted': '#4a4d5e',
  '--input-field': '#2c3349',
  '--input-field-bg': '#16131a',
};

const ogLightColors: Record<string, string> = {
  '--bg-panel': '#f0f1f5',
  '--bg-base': '#e8e9ed',
  '--bg-viewer': '#d4d5d9',
  '--bg-elevated': '#ffffff',
  '--bg-hover': '#e2e4e8',
  '--border': '#c5c7cc',
  '--border-mid': '#d8dade',
  '--text-primary': '#1a1c24',
  '--text-secondary': '#4a4d5e',
  '--text-muted': '#8b8fa8',
  '--input-field': '#4a5568',
  '--input-field-bg': '#e2e4e8',
};

const themeIcons: Record<string, string> = {
  'og-dark': 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  'og-light': 'M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
};

const themeLabels: Record<string, string> = {
  'og-dark': 'og dark',
  'og-light': 'og light',
};

function getThemeColors(themeName: string): Record<string, string> {
  if (themeName === 'og-light') return ogLightColors;
  return ogDarkColors;
}

export function StylesContent({ themeName, setShowStyle, setStylePage }: {
  themeName: string;
  setShowStyle: (v: boolean) => void;
  setStylePage: (v: string | null) => void;
}) {
  const [colors, setColors] = useState<Record<string, string>>(() => {
    const styles = getComputedStyle(document.documentElement);
    const initial: Record<string, string> = {};
    colorFields.forEach(c => {
      initial[c.varName] = normalizeColor(styles.getPropertyValue(c.varName).trim() || '#000000');
    });
    return initial;
  });

  useEffect(() => {
    const themeColors = getThemeColors(themeName);
    colorFields.forEach(c => {
      document.documentElement.style.setProperty(c.varName, themeColors[c.varName]);
    });
    setColors({ ...themeColors });
  }, [themeName]);

  function updateColor(varName: string, hex: string) {
    document.documentElement.style.setProperty(varName, hex);
    setColors(prev => ({ ...prev, [varName]: hex }));
  }

  function handleColorClick(varName: string, currentValue: string) {
    const colorField = colorFields.find(c => c.varName === varName);
    const colorLabel = colorField ? colorField.label : 'Color';
    setShowStyle(false);
    const cleanup = OpenColorPicker({
      value: currentValue,
      onChange: (hex: string) => updateColor(varName, hex),
      targetElement: colorLabel
    });
    (window as any).__onColorPickerClose = () => {
      setShowStyle(true);
      setStylePage(themeName);
    };
    (window as any).__colorPickerCleanup = () => {
      cleanup();
      if ((window as any).__onColorPickerClose) {
        (window as any).__onColorPickerClose();
        (window as any).__onColorPickerClose = null;
      }
    };
  }

  return (
    <div style={{ flex: 1, padding: 12, overflow: 'auto' }}>
      <div className="appearance-plain">
        {colorFields.map(field => (
          <div key={field.varName} className="color-field">
            <div className="color-label">{field.label}</div>
            <div className="color-controls">
              <button
                type="button"
                className="color-swatch"
                style={{ backgroundColor: colors[field.varName] || '#000000' }}
                onClick={() => handleColorClick(field.varName, colors[field.varName] || '#000000')}
                title="Click to pick a color"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StylesModal({ showStyle, setShowStyle, stylePage, setStylePage }: {
  showStyle: boolean;
  setShowStyle: (v: boolean) => void;
  stylePage: string | null;
  setStylePage: (v: string | null) => void;
}) {
  const [activeTheme, setActiveTheme] = useState<string>(() => {
    try { return window.localStorage.getItem('juicecut.styles.activeTheme') || 'og-dark'; } catch { return 'og-dark'; }
  });
  const [themePage, setThemePage] = useState<string | null>(stylePage);

  useEffect(() => {
    setThemePage(stylePage);
  }, [stylePage]);

  useEffect(() => {
    try { window.localStorage.setItem('juicecut.styles.activeTheme', activeTheme); } catch {}
  }, [activeTheme]);

  if (!showStyle) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-box settings-modal" style={{ width: 480, height: '72vh', minHeight: '72vh', maxHeight: '72vh', overflow: 'hidden' }}>
        <div className="modal-header modal-header--centered">
          {stylePage && (
            <button className="icon-btn" onClick={() => setStylePage(null)} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 26, height: 26, color: 'var(--text-secondary)' }} title="Back">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"/>
                <polyline points="12 19 5 12 12 5"/>
              </svg>
            </button>
          )}
          <span className="panel-title" style={{ fontSize: 12 }}>{stylePage ? `Styles / ${themeLabels[stylePage] || stylePage}` : 'Styles'}</span>
          <button className="icon-btn modal-close-btn" onClick={() => { setShowStyle(false); setStylePage(null); }} aria-label="Close style">✕</button>
        </div>
        {!stylePage && (
          <div style={{ flex: 1, padding: 16, overflow: 'auto', display: 'flex', flexDirection: 'row', gap: 12, alignItems: 'flex-start', justifyContent: 'flex-start' }}>
            {Object.entries(themeIcons).map(([key, path]) => {
              const isActive = activeTheme === key;
              return (
                <button
                  key={key}
                  onClick={() => { setStylePage(key); setThemePage(key); setActiveTheme(key); }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                    background: isActive ? 'rgba(52, 211, 153, 0.2)' : 'transparent',
                    border: isActive ? '1px solid var(--accent-green)' : '1px solid transparent',
                    borderRadius: 'var(--radius-md)', padding: '12px 16px',
                    cursor: 'pointer', color: isActive ? 'var(--accent-green)' : 'var(--text-secondary)',
                    transition: 'background 0.12s, color 0.12s, border-color 0.12s',
                    width: 90, height: 100, flexShrink: 0,
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={isActive ? 'var(--accent-green)' : 'var(--text-secondary)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: isActive ? 1 : 0.7, flexShrink: 0 }}>
                    <path d={path}></path>
                  </svg>
                  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.5px', color: isActive ? 'var(--accent-green)' : 'var(--text-secondary)', textAlign: 'center' }}>{themeLabels[key]}</span>
                </button>
              );
            })}
          </div>
        )}
        {stylePage && (
          <StylesContent themeName={stylePage} setShowStyle={setShowStyle} setStylePage={setStylePage} />
        )}
      </div>
    </div>
  );
}