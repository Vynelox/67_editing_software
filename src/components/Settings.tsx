import { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { RotateCcw, Plus } from 'lucide-react';
import type { ShortcutAction } from './shortcuts';
import { getShortcutKeys as scGetKeys, updateShortcuts as scUpdate, resetDefaultShortcuts as scReset } from './shortcuts';

type SettingsTab = "sliders" | "checkboxes" | "shortcuts" | "multiselects";

interface Props {
  onClose?: () => void;
  initialPageData?: any;
  initialScroll?: number | null;
}

const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  undo: "Undo",
  redo: "Redo",
  timelineZoomToggle: "Timeline horizontal zoom toggle",
};

function loadAllShortcuts(): Record<ShortcutAction, string[][]> {
  return {
    undo: scGetKeys("undo"),
    redo: scGetKeys("redo"),
    timelineZoomToggle: scGetKeys("timelineZoomToggle"),
  };
}

function formatKeys(keys: string[]): string {
  const sorted = [...keys].sort((a, b) => {
    const order = ["ctrl", "shift", "alt", "meta"];
    const ia = order.indexOf(a.toLowerCase());
    const ib = order.indexOf(b.toLowerCase());
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
  return sorted.map(k => k.charAt(0).toUpperCase() + k.slice(1)).join(" + ");
}

export default function Settings(props: Props) {
  return SettingsShell(props);
}

function SettingsShell({ onClose, initialPageData, initialScroll }: Props) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    if (initialPageData?.tab === "sliders") return "sliders";
    if (initialPageData?.tab === "checkboxes") return "checkboxes";
    if (initialPageData?.tab === "shortcuts") return "shortcuts";
    return "sliders";
  });
  const panelRef = useRef<HTMLDivElement | null>(null);

  const [guiScale, setGuiScale] = useState<number>(() => {
    try { const v = window.localStorage.getItem("juicecut.settings.guiScale"); return v ? Number(v) : 100; } catch { return 100; }
  });
  const [playheadTop, setPlayheadTop] = useState<number>(() => {
    try { const v = window.localStorage.getItem("juicecut.settings.playheadTopPercent"); return v ? Number(v) : 15; } catch { return 15; }
  });
  const [includeResizeInUndo, setIncludeResizeInUndo] = useState<boolean>(() => {
    try { const v = window.localStorage.getItem("juicecut.settings.includeResizeInUndo"); return v === null ? true : v === "true"; } catch { return true; }
  });
  const [cancelZoomOnScroll, setCancelZoomOnScroll] = useState<boolean>(() => {
    try { const v = window.localStorage.getItem("juicecut.settings.cancelZoomOnScroll"); return v === null ? true : v === "true"; } catch { return true; }
  });
  const [centerPlayneedle, setCenterPlayneedle] = useState<boolean>(() => {
    try { const v = window.localStorage.getItem("juicecut.settings.centerPlayneedle"); return v === null ? true : v === "true"; } catch { return true; }
  });
  const [scrollSmooth, setScrollSmooth] = useState<number>(() => {
    try { const v = window.localStorage.getItem("juicecut.settings.scrollSmooth"); return v ? Number(v) : 50; } catch { return 50; }
  });
  const [scrollAmount, setScrollAmount] = useState<number>(() => {
    try { const v = window.localStorage.getItem("juicecut.settings.scrollAmount"); return v ? Number(v) : 100; } catch { return 100; }
  });
  const [scrollZoomAmount, setScrollZoomAmount] = useState<number>(() => {
    try { const v = window.localStorage.getItem("juicecut.settings.scrollZoomAmount"); return v ? Number(v) : 25; } catch { return 25; }
  });
  const [scrollZoomSmoothness, setScrollZoomSmoothness] = useState<number>(() => {
    try { const v = window.localStorage.getItem("juicecut.settings.scrollZoomSmoothness"); return v ? Number(v) : 70; } catch { return 70; }
  });
  const [viewerControlsType, setViewerControlsType] = useState<string>(() => {
    try { return window.localStorage.getItem('juicecut.settings.viewerControlsType') || 'compact'; } catch { return 'compact'; }
  });
  const [timecodePanel, setTimecodePanel] = useState<string>(() => {
    try { return window.localStorage.getItem('juicecut.settings.timecodePanel') || 'both'; } catch { return 'both'; }
  });
  const [elevatedPanelDarken, setElevatedPanelDarken] = useState<number>(() => {
    try { const v = window.localStorage.getItem("juicecut.settings.elevatedPanelDarkenAmount"); return v ? Number(v) : 50; } catch { return 50; }
  });
  const [elevatedPanelBlur, setElevatedPanelBlur] = useState<number>(() => {
    try { const v = window.localStorage.getItem("juicecut.settings.elevatedPanelBlurAmount"); return v ? Number(v) : 0; } catch { return 0; }
  });
  const [shortcuts, setShortcuts] = useState<Record<ShortcutAction, string[][]>>(loadAllShortcuts);
  const [editingChip, setEditingChip] = useState<{ action: ShortcutAction; index: number } | null>(null);
  const chipRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
      window.localStorage.setItem("juicecut.settings.guiScale", String(guiScale));
      document.documentElement.style.setProperty('--gui-scale', `${guiScale / 100}`);
      window.dispatchEvent(new CustomEvent("juicecut-settings-changed", { detail: { key: "guiScale", value: guiScale } }));
    } catch {}
  }, [guiScale]);
  useEffect(() => {
    try {
      window.localStorage.setItem("juicecut.settings.playheadTopPercent", String(playheadTop));
      window.dispatchEvent(new CustomEvent("juicecut-settings-changed", { detail: { key: "playheadTopPercent", value: playheadTop } }));
    } catch {}
  }, [playheadTop]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.includeResizeInUndo", includeResizeInUndo ? "true" : "false"); } catch {} }, [includeResizeInUndo]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.cancelZoomOnScroll", cancelZoomOnScroll ? "true" : "false"); } catch {} }, [cancelZoomOnScroll]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.centerPlayneedle", centerPlayneedle ? "true" : "false"); } catch {} }, [centerPlayneedle]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.scrollSmooth", String(scrollSmooth)); } catch {} }, [scrollSmooth]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.scrollAmount", String(scrollAmount)); } catch {} }, [scrollAmount]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.scrollZoomAmount", String(scrollZoomAmount)); window.dispatchEvent(new CustomEvent("juicecut-settings-changed", { detail: { key: "scrollZoomAmount", value: scrollZoomAmount } })); } catch {} }, [scrollZoomAmount]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.scrollZoomSmoothness", String(scrollZoomSmoothness)); window.dispatchEvent(new CustomEvent("juicecut-settings-changed", { detail: { key: "scrollZoomSmoothness", value: scrollZoomSmoothness } })); } catch {} }, [scrollZoomSmoothness]);
  useEffect(() => { try { window.localStorage.setItem('juicecut.settings.viewerControlsType', viewerControlsType); window.dispatchEvent(new CustomEvent('juicecut-settings-changed', { detail: { key: 'viewerControlsType', value: viewerControlsType } })); } catch {} }, [viewerControlsType]);
  useEffect(() => { try { window.localStorage.setItem('juicecut.settings.timecodePanel', timecodePanel); window.dispatchEvent(new CustomEvent('juicecut-settings-changed', { detail: { key: 'timecodePanel', value: timecodePanel } })); } catch {} }, [timecodePanel]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.elevatedPanelDarkenAmount", String(elevatedPanelDarken)); window.dispatchEvent(new CustomEvent("juicecut-settings-changed", { detail: { key: "elevatedPanelDarkenAmount", value: elevatedPanelDarken } })); } catch {} }, [elevatedPanelDarken]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.elevatedPanelBlurAmount", String(elevatedPanelBlur)); window.dispatchEvent(new CustomEvent("juicecut-settings-changed", { detail: { key: "elevatedPanelBlurAmount", value: elevatedPanelBlur } })); } catch {} }, [elevatedPanelBlur]);

  useEffect(() => {
    if (initialScroll != null && panelRef.current) {
      const el = panelRef.current.querySelector(".settings-panel-content");
      if (el) el.scrollTop = initialScroll;
    }
  }, []);

  const addCombination = (action: ShortcutAction) => {
    const next = { ...shortcuts, [action]: [...shortcuts[action], []] };
    setShortcuts(next);
    scUpdate(next);
    const newIndex = next[action].length - 1;
    setEditingChip({ action, index: newIndex });
    // Focus the new chip after render
    setTimeout(() => {
      const key = `${action}-${newIndex}`;
      chipRefs.current[key]?.focus();
    }, 0);
  };

  const removeCombination = (action: ShortcutAction, index: number) => {
    const arr = shortcuts[action].filter((_, i) => i !== index);
    const next = { ...shortcuts, [action]: arr.length > 0 ? arr : [[]] };
    setShortcuts(next);
    scUpdate(next);
    setEditingChip(null);
  };

  const updateCombination = (action: ShortcutAction, index: number, keys: string[]) => {
    const arr = [...shortcuts[action]];
    arr[index] = keys;
    const next = { ...shortcuts, [action]: arr };
    setShortcuts(next);
    scUpdate(next);
    setEditingChip(null);
  };

  const handleReset = (action: ShortcutAction) => {
    scReset(action);
    setShortcuts(loadAllShortcuts());
    setEditingChip(null);
  };

  const handleChipKeyDown = (e: React.KeyboardEvent, action: ShortcutAction, index: number) => {
    e.preventDefault();
    e.stopPropagation();

    const keys: string[] = [];
    if (e.ctrlKey || e.metaKey) keys.push("ctrl");
    if (e.shiftKey) keys.push("shift");
    if (e.altKey) keys.push("alt");

    const key = e.key.toLowerCase();
    const isModifier = key === "control" || key === "shift" || key === "alt" || key === "meta";
    if (!isModifier) {
      keys.push(key === " " ? "space" : key);
    }

    if (keys.length > 0) {
      updateCombination(action, index, keys);
    }
  };

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
              className={"settings-tab" + (activeTab === "shortcuts" ? " settings-tab--active" : "")}
              onClick={() => setActiveTab("shortcuts")}
            >
              Keyboard
            </button>
            <button
              type="button"
              className={"settings-tab" + (activeTab === "sliders" ? " settings-tab--active" : "")}
              onClick={() => setActiveTab("sliders")}
            >
              Sliders
            </button>
            <button
              type="button"
              className={"settings-tab" + (activeTab === "checkboxes" ? " settings-tab--active" : "")}
              onClick={() => setActiveTab("checkboxes")}
            >
              Checkboxes
            </button>
            <button
              type="button"
              className={"settings-tab" + (activeTab === "multiselects" ? " settings-tab--active" : "")}
              onClick={() => setActiveTab("multiselects")}
            >
              Multiselects
            </button>
          </nav>

          <div className="settings-panel">
            {activeTab === "sliders" && (
              <div className="settings-panel-content">
                <div className="settings-field" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ flex: 1, lineHeight: 1.2 }}>GUI scale</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "var(--text-primary)", fontFamily: "monospace", fontSize: 12, whiteSpace: "nowrap" }}>{guiScale}%</span>
                      <button type="button" className="icon-btn" onClick={() => setGuiScale(100)} title="Reset to default (100%)" style={{ padding: 4 }}>
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  </div>
                  <input type="range" className="settings-range-input" min={50} max={200} step={5} value={guiScale} onChange={e => setGuiScale(Number(e.target.value))} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)" }}><span>50%</span><span>200%</span></div>
                </div>

                <div className="settings-field" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ flex: 1, lineHeight: 1.2 }}>Playneedle vertical<br />offset (%)</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "var(--text-primary)", fontFamily: "monospace", fontSize: 12, whiteSpace: "nowrap" }}>{playheadTop}%</span>
                      <button type="button" className="icon-btn" onClick={() => setPlayheadTop(15)} title="Reset to default (15%)" style={{ padding: 4 }}>
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  </div>
                  <input type="range" className="settings-range-input" min={0} max={100} step={1} value={playheadTop} onChange={e => setPlayheadTop(Number(e.target.value))} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)" }}><span>Top</span><span>Bottom</span></div>
                </div>

                <div className="settings-field" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ flex: 1, lineHeight: 1.2 }}>Timeline scroll<br />smooth factor</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "var(--text-primary)", fontFamily: "monospace", fontSize: 12, whiteSpace: "nowrap" }}>{scrollSmooth}%</span>
                      <button type="button" className="icon-btn" onClick={() => setScrollSmooth(50)} title="Reset to default (50%)" style={{ padding: 4 }}>
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  </div>
                  <input type="range" className="settings-range-input" min={0} max={100} step={1} value={scrollSmooth} onChange={e => setScrollSmooth(Number(e.target.value))} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)" }}><span>Snappy</span><span>Smooth</span></div>
                </div>

                <div className="settings-field" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ flex: 1, lineHeight: 1.2 }}>Timeline scroll<br />amount</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "var(--text-primary)", fontFamily: "monospace", fontSize: 12, whiteSpace: "nowrap" }}>{scrollAmount}%</span>
                      <button type="button" className="icon-btn" onClick={() => setScrollAmount(100)} title="Reset to default (100%)" style={{ padding: 4 }}>
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  </div>
                  <input type="range" className="settings-range-input" min={0} max={1000} step={1} value={scrollAmountToSlider(scrollAmount)} onChange={e => setScrollAmount(sliderToScrollAmount(Number(e.target.value)))} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)" }}><span>1%</span><span>400%</span></div>
                </div>

                <div className="settings-field" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ flex: 1, lineHeight: 1.2 }}>Scroll zoom<br />amount</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "var(--text-primary)", fontFamily: "monospace", fontSize: 12, whiteSpace: "nowrap" }}>{scrollZoomAmount}</span>
                      <button type="button" className="icon-btn" onClick={() => setScrollZoomAmount(25)} title="Reset to default (25)" style={{ padding: 4 }}>
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  </div>
                  <input type="range" className="settings-range-input" min={1} max={100} step={1} value={scrollZoomAmount} onChange={e => setScrollZoomAmount(Number(e.target.value))} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)" }}><span>Slow</span><span>Fast</span></div>
                </div>

                <div className="settings-field" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ flex: 1, lineHeight: 1.2 }}>Scroll zoom<br />smoothness</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "var(--text-primary)", fontFamily: "monospace", fontSize: 12, whiteSpace: "nowrap" }}>{scrollZoomSmoothness}%</span>
                      <button type="button" className="icon-btn" onClick={() => setScrollZoomSmoothness(70)} title="Reset to default (70%)" style={{ padding: 4 }}>
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  </div>
                  <input type="range" className="settings-range-input" min={0} max={100} step={1} value={scrollZoomSmoothness} onChange={e => setScrollZoomSmoothness(Number(e.target.value))} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)" }}><span>Snappy</span><span>Smooth</span></div>
                </div>

                <div className="settings-field" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ flex: 1, lineHeight: 1.2 }}>Elevated panel background<br />darken amount</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "var(--text-primary)", fontFamily: "monospace", fontSize: 12, whiteSpace: "nowrap" }}>{elevatedPanelDarken}%</span>
                      <button type="button" className="icon-btn" onClick={() => setElevatedPanelDarken(50)} title="Reset to default (50%)" style={{ padding: 4 }}>
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  </div>
                  <input type="range" className="settings-range-input" min={0} max={100} step={1} value={elevatedPanelDarken} onChange={e => { setElevatedPanelDarken(Number(e.target.value)); }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)" }}><span>White</span><span>Black</span></div>
                </div>

                <div className="settings-field" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ flex: 1, lineHeight: 1.2 }}>Elevated panel background<br />blur amount</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "var(--text-primary)", fontFamily: "monospace", fontSize: 12, whiteSpace: "nowrap" }}>{elevatedPanelBlur}%</span>
                      <button type="button" className="icon-btn" onClick={() => setElevatedPanelBlur(0)} title="Reset to default (0%)" style={{ padding: 4 }}>
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  </div>
                  <input type="range" className="settings-range-input" min={0} max={100} step={1} value={elevatedPanelBlur} onChange={e => { setElevatedPanelBlur(Number(e.target.value)); }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)" }}><span>No blur</span><span>Max blur</span></div>
                </div>
              </div>
            )}

            {activeTab === "checkboxes" && (
              <div className="settings-panel-content">
                <div className="settings-field" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <span style={{ flex: 1, lineHeight: 1.2 }}>Include splitter resize<br />actions in Ctrl+Z/Ctrl+Y</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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

                <div className="settings-field" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <span style={{ flex: 1, lineHeight: 1.2 }}>Cancel smooth zoom when<br />scrolling timeline</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" className="settings-checkbox" checked={cancelZoomOnScroll} onChange={e => setCancelZoomOnScroll(e.target.checked)} />
                    <button type="button" className="icon-btn" onClick={() => setCancelZoomOnScroll(true)} title="Reset to default (Checked)" style={{ padding: 4 }}><RotateCcw size={14} /></button>
                  </div>
                </div>

                <div className="settings-field" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <span style={{ flex: 1, lineHeight: 1.2 }}>Center playneedle<br />when zooming</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" className="settings-checkbox" checked={centerPlayneedle} onChange={e => setCenterPlayneedle(e.target.checked)} />
                    <button type="button" className="icon-btn" onClick={() => setCenterPlayneedle(true)} title="Reset to default (Checked)" style={{ padding: 4 }}><RotateCcw size={14} /></button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "multiselects" && (
              <div className="settings-panel-content">
                <div className="settings-field" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                  <span style={{ lineHeight: 1.2 }}>Viewer controls type</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {(['compact', 'centered'] as const).map(opt => {
                      const active = viewerControlsType === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setViewerControlsType(opt)}
                          style={{
                            padding: "5px 14px",
                            borderRadius: "var(--radius-sm)",
                            border: active ? "1px solid var(--accent-blue)" : "1px solid var(--border-mid)",
                            background: active ? "rgba(56,189,248,0.15)" : "var(--bg-elevated)",
                            color: active ? "var(--accent-blue)" : "var(--text-secondary)",
                            fontSize: 12,
                            fontWeight: active ? 600 : 400,
                            cursor: "pointer",
                            transition: "all 0.12s",
                          }}
                        >
                          {opt.charAt(0).toUpperCase() + opt.slice(1)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="settings-field" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                  <span style={{ lineHeight: 1.2 }}>Timecode display</span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(['timeline', 'viewer', 'both', 'none'] as const).map(opt => {
                      const active = timecodePanel === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setTimecodePanel(opt)}
                          style={{
                            padding: "5px 14px",
                            borderRadius: "var(--radius-sm)",
                            border: active ? "1px solid var(--accent-blue)" : "1px solid var(--border-mid)",
                            background: active ? "rgba(56,189,248,0.15)" : "var(--bg-elevated)",
                            color: active ? "var(--accent-blue)" : "var(--text-secondary)",
                            fontSize: 12,
                            fontWeight: active ? 600 : 400,
                            cursor: "pointer",
                            transition: "all 0.12s",
                          }}
                        >
                          {opt.charAt(0).toUpperCase() + opt.slice(1)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "shortcuts" && (
              <div className="settings-panel-content">
                {(Object.keys(SHORTCUT_LABELS) as ShortcutAction[]).map(action => (
                  <div
                    key={action}
                    className="settings-field"
                    style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span style={{ lineHeight: 1.2 }}>{SHORTCUT_LABELS[action]}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => addCombination(action)}
                          title="Add shortcut combination"
                          style={{ padding: 4 }}
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => handleReset(action)}
                          title="Reset to default shortcuts"
                          style={{ padding: 4 }}
                        >
                          <RotateCcw size={14} />
                        </button>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {shortcuts[action].map((keys, idx) => {
                        const isEditing = editingChip?.action === action && editingChip?.index === idx;
                        return (
                          <div
                            key={idx}
                            ref={el => { chipRefs.current[`${action}-${idx}`] = el; }}
                            tabIndex={0}
                            onFocus={() => setEditingChip({ action, index: idx })}
                            onBlur={() => {
                              setTimeout(() => setEditingChip(null), 150);
                            }}
                            onKeyDown={(e) => handleChipKeyDown(e, action, idx)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              background: isEditing ? "var(--bg-hover)" : "var(--bg-elevated)",
                              border: isEditing ? "1px solid var(--accent-blue)" : "1px solid var(--border-mid)",
                              borderRadius: "var(--radius-sm)",
                              padding: "3px 8px",
                              cursor: "pointer",
                              outline: "none",
                              transition: "border-color 0.12s, background 0.12s",
                              minHeight: 28,
                            }}
                            title={
                              isEditing
                                ? "Press keys to assign..."
                                : keys.length === 0
                                  ? "Click then press keys to assign"
                                  : "Click then press new keys to reassign"
                            }
                          >
                            <span style={{
                              fontSize: 12,
                              color: keys.length > 0 ? "var(--text-primary)" : "var(--text-muted)",
                              fontFamily: "monospace",
                            }}>
                              {isEditing && keys.length === 0
                                ? "..."
                                : keys.length > 0
                                  ? formatKeys(keys)
                                  : "None"}
                            </span>
                            {shortcuts[action].length > 1 && (
                              <button
                                type="button"
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "var(--text-muted)",
                                  cursor: "pointer",
                                  padding: "0 2px",
                                  fontSize: 13,
                                  lineHeight: 1,
                                  display: "flex",
                                  alignItems: "center",
                                }}
                                onMouseDown={(e) => { e.stopPropagation(); removeCombination(action, idx); }}
                                title="Remove this combination"
                              >
                                x
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function OpenSettings(pageData?: any, scroll?: number | null) {
  const container = document.createElement("div");
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
  const existing = document.querySelector(".modal-overlay.settings-modal");
  if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
}

(window as any).__onColorPickerClose = null;
try { (window as any).OpenSettings = OpenSettings; } catch (e) {}
try { (window as any).closeSettings = closeSettings; } catch (e) {}


