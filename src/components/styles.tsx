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

export function StylesContent({ setShowStyle, setStylePage }: { setShowStyle: (v: boolean) => void; setStylePage: (v: string | null) => void }) {
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

  const [colors, setColors] = useState<Record<string, string>>({});

  useEffect(() => {
    const styles = getComputedStyle(document.documentElement);
    const initial: Record<string, string> = {};
    colorFields.forEach(c => {
      const raw = styles.getPropertyValue(c.varName).trim();
      initial[c.varName] = normalizeColor(raw || '#000000');
    });
    setColors(initial);
  }, []);

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
      setStylePage('og-dark');
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
          <span className="panel-title" style={{ fontSize: 12 }}>{stylePage ? `Styles / ${stylePage}` : 'Styles'}</span>
          <button className="icon-btn modal-close-btn" onClick={() => { setShowStyle(false); setStylePage(null); }} aria-label="Close style">✕</button>
        </div>
        {!stylePage && (
          <div style={{ flex: 1, padding: 16, overflow: 'auto' }}>
            <button
              onClick={() => setStylePage('og-dark')}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                background: 'transparent', border: 'none',
                borderRadius: 'var(--radius-md)', padding: '16px 20px',
                cursor: 'pointer', color: 'var(--text-secondary)',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>og dark</span>
            </button>
          </div>
        )}
        {stylePage && (
          <StylesContent setShowStyle={setShowStyle} setStylePage={setStylePage} />
        )}
      </div>
    </div>
  );
}