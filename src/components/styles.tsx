import { useState, useEffect } from 'react';
import { OpenColorPicker } from './ColorPicker';
import { colorFields, type ThemeColors } from './GlobalStyleSettings';

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

const ogDarkColors: ThemeColors = {
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

const ogLightColors: ThemeColors = {
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

const monokaiColors: ThemeColors = {
  '--bg-panel': '#272822',
  '--bg-base': '#1c1e19',
  '--bg-viewer': '#1c1e19',
  '--bg-elevated': '#3c3d38',
  '--bg-hover': '#49483e',
  '--border': '#414339',
  '--border-mid': '#5a5c54',
  '--text-primary': '#f8f8f2',
  '--text-secondary': '#a6e22e',
  '--text-muted': '#75715e',
  '--input-field': '#66d9ef',
  '--input-field-bg': '#3b3a32',
};

const lavenderColors: ThemeColors = {
  '--bg-panel': '#2D1C4D',
  '--bg-base': '#1B0A3A',
  '--bg-viewer': '#15043A',
  '--bg-elevated': '#392358',
  '--bg-hover': '#432A66',
  '--border': '#684A9C',
  '--border-mid': '#7E5DBA',
  '--text-primary': '#E5DEF1',
  '--text-secondary': '#B1A3D0',
  '--text-muted': '#8A7B9C',
  '--input-field': '#7953C2',
  '--input-field-bg': '#27184A',
};

const cyberpunkColors: ThemeColors = {
  '--bg-panel': '#0D0221',
  '--bg-base': '#05010F',
  '--bg-viewer': '#000000',
  '--bg-elevated': '#1A0440',
  '--bg-hover': '#240650',
  '--border': '#FF00C8',
  '--border-mid': '#00F0FF',
  '--text-primary': '#F5F5FF',
  '--text-secondary': '#00F0FF',
  '--text-muted': '#8A2BE2',
  '--input-field': '#FF00C8',
  '--input-field-bg': '#0A0118',
};

const oakColors: ThemeColors = {
  '--bg-panel': '#362E2E',
  '--bg-base': '#2A2222',
  '--bg-viewer': '#1F1717',
  '--bg-elevated': '#4C4242',
  '--bg-hover': '#5D5050',
  '--border': '#706060',
  '--border-mid': '#857373',
  '--text-primary': '#D4C4C4',
  '--text-secondary': '#A99A9A',
  '--text-muted': '#807070',
  '--input-field': '#A0522D',
  '--input-field-bg': '#3F3737',
};

const forestColors: ThemeColors = {
  '--bg-panel': '#1A332A',
  '--bg-base': '#0F261E',
  '--bg-viewer': '#0A1C15',
  '--bg-elevated': '#2B4D40',
  '--bg-hover': '#3C6656',
  '--border': '#4A7A6C',
  '--border-mid': '#609181',
  '--text-primary': '#D8E8D8',
  '--text-secondary': '#A7C2A7',
  '--text-muted': '#7D9E7D',
  '--input-field': '#5F9EA0',
  '--input-field-bg': '#223D34',
};



const folderIcon: string = 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2z';
const ogDarkIcon: string = 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z';
const ogLightIcon: string = 'M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z';
const monokaiIcon: string = 'm8 6-6 6 6 6M16 6l6 6-6 6'; // Code brackets (Monokai is a code editor theme)
const lavenderIcon: string = 'M12 22V8M9 11l3-3 3 3M10 11c0 1 1 2 2 2s2-1 2-2M10 8c0 1 1 2 2 2s2-1 2-2M9 5c0 1 1 2 3 2s3-1 3-2M11 14c0-1 1-2 1-3s-1-2-1-3M13 14c0-1-1-2-1-3s1-2 1-3'; // Lavender plant strand
const cyberpunkIcon: string = 'M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3M6 6h12v12H6zM10 10h4v4h-4z'; // Microprocessor / chip (cyberpunk tech)
const oakIcon: string = 'M5 8a7 3 0 0 1 14 0v10a7 3 0 0 1-14 0V8zM8 8a4 1.5 0 0 1 8 0 4 1.5 0 0 1-8 0zM10 8a2 0.7 0 0 1 4 0 2 0.7 0 0 1-4 0z'; // Tree stump (oak)
const forestIcon: string = 'M12 2L7 9h3l-5 7h4l-4 5h12l-4-5h4l-5-7h3L12 2zM11 21h2'; // Pine tree (forest)

interface DisplayItem {
  id: string;
  label: string;
  type: 'theme' | 'folder';
  icon: string;
  children?: string[]; // IDs of children items, only for 'folder' type
}

const topLevelItems: string[] = ['vynelox-built-in-folder'];

const allDisplayItems: Record<string, DisplayItem> = {
  'vynelox-built-in-folder': {
    id: 'vynelox-built-in-folder',
    label: 'Vynelox built-in',
    type: 'folder',
    icon: folderIcon,
    children: ['plain-folder']
  },
  'plain-folder': {
    id: 'plain-folder',
    label: 'plain',
    type: 'folder',
    icon: folderIcon,
    children: ['og-dark', 'og-light', 'monokai', 'lavender', 'cyberpunk', 'oak', 'forest']
  },
  'og-dark': { id: 'og-dark', label: 'og dark', type: 'theme', icon: ogDarkIcon },
  'og-light': { id: 'og-light', label: 'og light', type: 'theme', icon: ogLightIcon },
  'monokai': { id: 'monokai', label: 'monokai', type: 'theme', icon: monokaiIcon },
  'lavender': { id: 'lavender', label: 'lavender', type: 'theme', icon: lavenderIcon },
  'cyberpunk': { id: 'cyberpunk', label: 'cyberpunk', type: 'theme', icon: cyberpunkIcon },
  'oak': { id: 'oak', label: 'oak', type: 'theme', icon: oakIcon },
  'forest': { id: 'forest', label: 'forest', type: 'theme', icon: forestIcon },
};

const parentMap: Record<string, string | undefined> = {};
for (const itemId in allDisplayItems) {
  const item = allDisplayItems[itemId];
  if (item.type === 'folder' && item.children) {
    item.children.forEach(childId => {
      parentMap[childId] = itemId;
    });
  }
}

function getPathLabel(itemId: string | null): string {
  if (!itemId) return 'Styles';
  const path: string[] = [];
  let currentId: string | undefined = itemId;

  while (currentId) {
    const item = allDisplayItems[currentId];
    if (item) {
      path.unshift(item.label);
      currentId = parentMap[currentId];
    } else {
      break;
    }
  }
  return 'Styles / ' + path.join(' / ');
}

const themesByName: Record<string, ThemeColors> = {
  'og-dark': ogDarkColors,
  'og-light': ogLightColors,
  'monokai': monokaiColors,
  'lavender': lavenderColors,
  'cyberpunk': cyberpunkColors,
  'oak': oakColors,
  'forest': forestColors,
};

function getThemeColors(themeName: string): ThemeColors {
  return themesByName[themeName] ?? ogDarkColors;
}

// Applies a theme's colors to the document root. Used both when equipping a
// theme from the folder view and when opening the color editor for it.
function applyThemeToDocument(themeName: string) {
  const themeColors = getThemeColors(themeName);
  colorFields.forEach(c => {
    document.documentElement.style.setProperty(c.varName, themeColors[c.varName]);
  });
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
    applyThemeToDocument(themeName);
    setColors({ ...getThemeColors(themeName) });
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
            <button className="icon-btn" onClick={() => {
              const parentId = parentMap[stylePage];
              setStylePage(parentId || null);
            }} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 26, height: 26, color: 'var(--text-secondary)' }} title="Back">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"/>
                <polyline points="12 19 5 12 12 5"/>
              </svg>
            </button>
          )}
          <span className="panel-title" style={{ fontSize: 12 }}>{getPathLabel(stylePage)}</span>
          <button className="icon-btn modal-close-btn" onClick={() => { setShowStyle(false); setStylePage(null); }} aria-label="Close style">✕</button>
        </div>
        {!stylePage && (
          <div style={{ flex: 1, padding: 16, overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 90px)', gap: '8px 12px', alignItems: 'flex-start', justifyContent: 'flex-start' }}>
            {topLevelItems.map(itemId => {
              const item = allDisplayItems[itemId];
              if (!item) return null;

              return (
                <button
                  key={item.id}
                  onClick={() => setStylePage(item.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-md)', padding: '12px 16px',
                    cursor: 'pointer', color: 'var(--text-secondary)',
                    transition: 'background 0.12s, color 0.12s',
                    width: 90, height: 100, flexShrink: 0,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7, flexShrink: 0 }}>
                    <path d={item.icon}></path>
                  </svg>
                  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.5px', textAlign: 'center' }}>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
        {stylePage && allDisplayItems[stylePage]?.type === 'folder' && (
          <div style={{ flex: 1, padding: 16, overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 90px)', gap: '4px 12px', alignItems: 'start', alignContent: 'start', justifyContent: 'start' }}>
            {allDisplayItems[stylePage].children?.map(childId => {
              const childItem = allDisplayItems[childId];
              if (!childItem) return null;

              const isActive = activeTheme === childItem.id; // Only themes can be active for highlighting

              return (
                <button
                  key={childItem.id}
                  onClick={() => {
                    if (childItem.type === 'folder') {
                      setStylePage(childItem.id);
                    } else { // type === 'theme'
                      if (activeTheme === childItem.id) {
                        // The theme is already active: open the color editor for it
                        setStylePage(childItem.id);
                        setThemePage(childItem.id);
                      } else {
                        // The theme is not active yet: equip/activate it AND apply its colors to the editor
                        setActiveTheme(childItem.id);
                        applyThemeToDocument(childItem.id);
                      }
                    }
                  }}
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
                    <path d={childItem.icon}></path>
                  </svg>
                  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.5px', color: isActive ? 'var(--accent-green)' : 'var(--text-secondary)', textAlign: 'center' }}>{childItem.label}</span>
                </button>
              );
            })}
          </div>
        )}
        {stylePage && allDisplayItems[stylePage]?.type === 'theme' && (
          <StylesContent themeName={stylePage} setShowStyle={setShowStyle} setStylePage={setStylePage} />
        )}
      </div>
    </div>
  );
}