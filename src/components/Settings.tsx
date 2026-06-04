import { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { RotateCcw } from 'lucide-react';

type SettingsTab = 'sliders' | 'checkboxes';

interface Props {
  onClose?: () => void;
  initialPageData?: any;
  initialScroll?: number | null;
}

export default function Settings(props: Props) {
  return SettingsShell(props);
}

function SettingsShell({ onClose, initialPageData, initialScroll }: Props) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    if (initialPageData?.tab === 'sliders') return 'sliders';
    if (initialPageData?.tab === 'checkboxes') return 'checkboxes';
    return 'sliders';
  });
  const panelRef = useRef<HTMLDivElement | null>(null);

  const [playheadTop, setPlayheadTop] = useState<number>(() => {
    try { const v = window.localStorage.getItem('juicecut.settings.playheadTopPercent'); return v ? Number(v) : 15; } catch { return 15; }
  });
  const [includeResizeInUndo, setIncludeResizeInUndo] = useState<boolean>(() => {
    try { const v = window.localStorage.getItem('juicecut.settings.includeResizeInUndo'); return v === null ? true : v === 'true'; } catch { return true; }
  });
  const [cancelZoomOnScroll, setCancelZoomOnScroll] = useState<boolean>(() => {
    try { const v = window.localStorage.getItem('juicecut.settings.cancelZoomOnScroll'); return v === null ? true : v === 'true'; } catch { return true; }
  });
  const [centerPlayneedle, setCenterPlayneedle] = useState<boolean>(() => {
    try { const v = window.localStorage.getItem('juicecut.settings.centerPlayneedle'); return v === null ? false : v === 'true'; } catch { return false; }
  });
  const [scrollSmooth, setScrollSmooth] = useState<number>(() => {
    try { const v = window.localStorage.getItem('juicecut.settings.scrollSmooth'); return v ? Number(v) : 50; } catch { return 50; }
  });
  const [scrollAmount, setScrollAmount] = useState<number>(() => {
    try { const v = window.localStorage.getItem('juicecut.settings.scrollAmount'); return v ? Number(v) : 100; } catch { return 100; }
  });
  const [scrollZoomAmount, setScrollZoomAmount] = useState<number>(() => {
    try { const v = window.localStorage.getItem('juicecut.settings.scrollZoomAmount'); return v ? Number(v) : 25; } catch { return 25; }
  });
  const [scrollZoomSmoothness, setScrollZoomSmoothness] = useState<number>(() => {
    try { const v = window.localStorage.getItem('juicecut.settings.scrollZoomSmoothness'); return v ? Number(v) : 70; } catch { return 70; }
  });

  const SCROLL_AMOUNT_POWER = 3.355;
  const scrollAmountToSlider = (value: number) => {
    if (value <= 1) return 0;
    if (value >= 400) return 1000;
    return Math.round(1000 * Math.pow((value - 1) / 399, 1 / SCROLL_AMOUNT_POWER));
  };
  const sliderToScrollAmount = (sliderValue: number) => {
    const ratio = Math.max(0, Math.min(1, sliderValue / 1000));
    return Math.round(1 + 399 * Math.pow(ratio, SCROLL_AMOUNT_POWER));
  };

  useEffect(() => {
    try {
      window.localStorage.setItem('juicecut.settings.playheadTopPercent', String(playheadTop));
      window.dispatchEvent(new CustomEvent('juicecut-settings-changed', { detail: { key: 'playheadTopPercent', value: playheadTop } }));
    } catch {}
  }, [playheadTop]);
  useEffect(() => { try { window.localStorage.setItem('juicecut.settings.includeResizeInUndo', includeResizeInUndo ? 'true' : 'false'); } catch {} }, [includeResizeInUndo]);
  useEffect(() => { try { window.localStorage.setItem('juicecut.settings.cancelZoomOnScroll', cancelZoomOnScroll ? 'true' : 'false'); } catch {} }, [cancelZoomOnScroll]);
  useEffect(() => { try { window.localStorage.setItem('juicecut.settings.centerPlayneedle', centerPlayneedle ? 'true' : 'false'); } catch {} }, [centerPlayneedle]);
  useEffect(() => { try { window.localStorage.setItem('juicecut.settings.scrollSmooth', String(scrollSmooth)); } catch {} }, [scrollSmooth]);
  useEffect(() => { try { window.localStorage.setItem('juicecut.settings.scrollAmount', String(scrollAmount)); } catch {} }, [scrollAmount]);
  useEffect(() => { try { window.localStorage.setItem('juicecut.settings.scrollZoomAmount', String(scrollZoomAmount)); window.dispatchEvent(new CustomEvent('juicecut-settings-changed', { detail: { key: 'scrollZoomAmount', value: scrollZoomAmount } })); } catch {} }, [scrollZoomAmount]);
  useEffect(() => { try { window.localStorage.setItem('juicecut.settings.scrollZoomSmoothness', String(scrollZoomSmoothness)); window.dispatchEvent(new CustomEvent('juicecut-settings-changed', { detail: { key: 'scrollZoomSmoothness', value: scrollZoomSmoothness } })); } catch {} }, [scrollZoomSmoothness]);

  useEffect(() => {
    if (initialScroll != null && panelRef.current) {
      const el = panelRef.current.querySelector('.settings-panel-content');
      if (el) el.scrollTop = initialScroll;
    }
  }, []);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-box settings-modal">
        <div className="modal-header modal-header--centered">
          <span className="panel-title settings-title">Settings</span>
          <button className="icon-btn modal-close-btn" onClick={() => { onClose?.(); }} aria-label="Close settings">✕</button>
        </div>

        <div className="settings-body" ref={panelRef}>
          <nav className="settings-tabs" aria-label="Settings sections">
            <button
              type="button"
              className={`settings-tab${activeTab === 'sliders' ? ' settings-tab--active' : ''}`}
              onClick={() => setActiveTab('sliders')}
            >
              Sliders
            </button>
            <button
              type="button"
              className={`settings-tab${activeTab === 'checkboxes' ? ' settings-tab--active' : ''}`}
              onClick={() => setActiveTab('checkboxes')}
            >
              Checkboxes
            </button>
          </nav>

          <div className="settings-panel">
            {activeTab === 'sliders' && (
              <div className="settings-panel-content">
                <div className="settings-field" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ flex: 1, lineHeight: 1.2 }}>Playneedle vertical<br />offset (%)</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{playheadTop}%</span>
                      <button type="button" className="icon-btn" onClick={() => setPlayheadTop(15)} title="Reset to default (15%)" style={{ padding: 4 }}>
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  </div>
                  <input type="range" className="settings-range-input" min={0} max={100} step={1} value={playheadTop} onChange={e => setPlayheadTop(Number(e.target.value))} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}><span>Top</span><span>Bottom</span></div>
                </div>

                <div className="settings-field" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ flex: 1, lineHeight: 1.2 }}>Timeline scroll<br />smooth factor</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{scrollSmooth}%</span>
                      <button type="button" className="icon-btn" onClick={() => setScrollSmooth(50)} title="Reset to default (50%)" style={{ padding: 4 }}>
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  </div>
                  <input type="range" className="settings-range-input" min={0} max={100} step={1} value={scrollSmooth} onChange={e => setScrollSmooth(Number(e.target.value))} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}><span>Snappy</span><span>Smooth</span></div>
                </div>

                <div className="settings-field" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ flex: 1, lineHeight: 1.2 }}>Timeline scroll<br />amount</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{scrollAmount}%</span>
                      <button type="button" className="icon-btn" onClick={() => setScrollAmount(100)} title="Reset to default (100%)" style={{ padding: 4 }}>
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  </div>
                  <input type="range" className="settings-range-input" min={0} max={1000} step={1} value={scrollAmountToSlider(scrollAmount)} onChange={e => setScrollAmount(sliderToScrollAmount(Number(e.target.value)))} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}><span>1%</span><span>400%</span></div>
                </div>

                <div className="settings-field" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ flex: 1, lineHeight: 1.2 }}>Scroll zoom<br />amount</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{scrollZoomAmount}</span>
                      <button type="button" className="icon-btn" onClick={() => setScrollZoomAmount(25)} title="Reset to default (25)" style={{ padding: 4 }}>
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  </div>
                  <input type="range" className="settings-range-input" min={1} max={100} step={1} value={scrollZoomAmount} onChange={e => setScrollZoomAmount(Number(e.target.value))} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}><span>Slow</span><span>Fast</span></div>
                </div>

                <div className="settings-field" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ flex: 1, lineHeight: 1.2 }}>Scroll zoom<br />smoothness</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{scrollZoomSmoothness}%</span>
                      <button type="button" className="icon-btn" onClick={() => setScrollZoomSmoothness(70)} title="Reset to default (70%)" style={{ padding: 4 }}>
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  </div>
                  <input type="range" className="settings-range-input" min={0} max={100} step={1} value={scrollZoomSmoothness} onChange={e => setScrollZoomSmoothness(Number(e.target.value))} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}><span>Snappy</span><span>Smooth</span></div>
                </div>
              </div>
            )}

            {activeTab === 'checkboxes' && (
              <div className="settings-panel-content">
                <div className="settings-field" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ flex: 1, lineHeight: 1.2 }}>Include splitter resize<br />actions in Ctrl+Z/Ctrl+Y</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      className="settings-checkbox"
                      checked={includeResizeInUndo}
                      onChange={e => setIncludeResizeInUndo(e.target.checked)}
                    />
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => setIncludeResizeInUndo(true)}
                      title="Reset to default (Checked)"
                      style={{ padding: 4 }}
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                </div>

                <div className="settings-field" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ flex: 1, lineHeight: 1.2 }}>Cancel smooth zoom when<br />scrolling timeline</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" className="settings-checkbox" checked={cancelZoomOnScroll} onChange={e => setCancelZoomOnScroll(e.target.checked)} />
                    <button type="button" className="icon-btn" onClick={() => setCancelZoomOnScroll(true)} title="Reset to default (Checked)" style={{ padding: 4 }}><RotateCcw size={14} /></button>
                  </div>
                </div>

                <div className="settings-field" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ flex: 1, lineHeight: 1.2 }}>Center playneedle<br />when zooming</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" className="settings-checkbox" checked={centerPlayneedle} onChange={e => setCenterPlayneedle(e.target.checked)} />
                    <button type="button" className="icon-btn" onClick={() => setCenterPlayneedle(false)} title="Reset to default (Unchecked)" style={{ padding: 4 }}><RotateCcw size={14} /></button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function OpenSettings(pageData?: any, scroll?: number | null) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const cleanup = () => {
    try { root.unmount(); } catch (e) {}
    if (container.parentNode) container.parentNode.removeChild(container);
  };
  root.render(<SettingsShell initialPageData={pageData} initialScroll={scroll ?? null} onClose={cleanup} />);
  return cleanup;
}

export function closeSettings() {
  const existing = document.querySelector('.modal-overlay.settings-modal');
  if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
}

(window as any).__onColorPickerClose = null;
try { (window as any).OpenSettings = OpenSettings; } catch (e) {}
try { (window as any).closeSettings = closeSettings; } catch (e) {}