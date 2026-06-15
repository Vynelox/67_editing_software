import { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { RotateCcw, Plus, ChevronRight } from 'lucide-react';
import type { ShortcutAction } from './shortcuts';
import { getShortcutKeys as scGetKeys, updateShortcuts as scUpdate, resetDefaultShortcuts as scReset } from './shortcuts';
import DraggableModal from './DraggableModal';

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

/** Collapsible category with animated arrow and smooth expand/collapse */
function SettingsCategory({ title, children }: { title: string; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="settings-category">
      <button
        type="button"
        className="settings-category-header"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
      >
        <span className="settings-category-title">{title}</span>
        <ChevronRight
          size={14}
          className="settings-category-arrow"
          style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
        />
      </button>
      <div
        className="settings-category-body"
        style={{
          display: 'grid',
          gridTemplateRows: expanded ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.2s ease',
          overflow: 'hidden',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div className="settings-category-body-inner">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A slider setting row with label, value, reset button, range input, and min/max labels */
function SliderSetting({ label, value, min, max, step, onChange, onReset, formatValue, logScale }: {
  label: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onReset: () => void;
  formatValue?: (v: number) => string;
  logScale?: boolean;
}) {
  const displayValue = formatValue ? formatValue(value) : String(value);

  // For log scale: the slider position is logarithmic
  // Map slider 0-1000 to log(min)-log(max)
  const sliderToValue = (slider: number) => {
    if (!logScale) return min + (slider / 1000) * (max - min);
    const logMin = Math.log10(min);
    const logMax = Math.log10(max);
    const logVal = logMin + (slider / 1000) * (logMax - logMin);
    return Math.pow(10, logVal);
  };

  const valueToSlider = (val: number) => {
    if (!logScale) return ((val - min) / (max - min)) * 1000;
    const logMin = Math.log10(min);
    const logMax = Math.log10(max);
    return ((Math.log10(val) - logMin) / (logMax - logMin)) * 1000;
  };

  return (
    <div className="settings-field" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <span style={{ flex: 1, lineHeight: 1.2 }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--text-primary)", fontFamily: "monospace", fontSize: 12, whiteSpace: "nowrap" }}>{displayValue}</span>
          <button type="button" className="icon-btn" onClick={onReset} title="Reset to default" style={{ padding: 4 }}><RotateCcw size={14} /></button>
        </div>
      </div>
      <input
        type="range"
        className="settings-range-input"
        min={0}
        max={1000}
        step={1}
        value={valueToSlider(value)}
        onChange={e => onChange(sliderToValue(Number(e.target.value)))}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)" }}>
        <span>{formatValue ? formatValue(min) : min}</span>
        <span>{formatValue ? formatValue(max) : max}</span>
      </div>
    </div>
  );
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
  const [includeResizeInUndo, setIncludeResizeInUndo] = useState<boolean>(() => {
    try { const v = window.localStorage.getItem("juicecut.settings.includeResizeInUndo"); return v === null ? true : v === "true"; } catch { return true; }
  });
  const [zoomEpicenter, setZoomEpicenter] = useState<string>(() => {
    try { return window.localStorage.getItem('juicecut.settings.zoomEpicenter') || 'playneedle'; } catch { return 'playneedle'; }
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

  // Playneedle formula parameters
  const [pnT, setPnT] = useState<number>(() => {
    try { const v = window.localStorage.getItem("juicecut.settings.playneedle_t"); return v !== null ? Number(v) : 0.092; } catch { return 0.092; }
  });
  const [pnJ, setPnJ] = useState<number>(() => {
    try { const v = window.localStorage.getItem("juicecut.settings.playneedle_j"); return v !== null ? Number(v) : 0.049; } catch { return 0.049; }
  });
  const [pnK, setPnK] = useState<number>(() => {
    try { const v = window.localStorage.getItem("juicecut.settings.playneedle_k"); return v !== null ? Number(v) : 103; } catch { return 103; }
  });
  const [pnS, setPnS] = useState<number>(() => {
    try { const v = window.localStorage.getItem("juicecut.settings.playneedle_s"); return v !== null ? Number(v) : 16.4; } catch { return 16.4; }
  });
  const [pnVo, setPnVo] = useState<number>(() => {
    try { const v = window.localStorage.getItem("juicecut.settings.playneedle_v_o"); return v !== null ? Number(v) : 0.4; } catch { return 0.4; }
  });
  const [pnHb, setPnHb] = useState<number>(() => {
    try { const v = window.localStorage.getItem("juicecut.settings.playneedle_h_b"); return v !== null ? Number(v) : 0.8; } catch { return 0.8; }
  });
  const [pnHr, setPnHr] = useState<number>(() => {
    try { const v = window.localStorage.getItem("juicecut.settings.playneedle_h_r"); return v !== null ? Number(v) : 1; } catch { return 1; }
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

  // Persist all settings
  useEffect(() => {
    try {
      window.localStorage.setItem("juicecut.settings.guiScale", String(guiScale));
      document.documentElement.style.setProperty('--gui-scale', `${guiScale / 100}`);
      window.dispatchEvent(new CustomEvent("juicecut-settings-changed", { detail: { key: "guiScale", value: guiScale } }));
    } catch {}
  }, [guiScale]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.includeResizeInUndo", includeResizeInUndo ? "true" : "false"); } catch {} }, [includeResizeInUndo]);
  useEffect(() => { try { window.localStorage.setItem('juicecut.settings.zoomEpicenter', zoomEpicenter); window.dispatchEvent(new CustomEvent('juicecut-settings-changed', { detail: { key: 'zoomEpicenter', value: zoomEpicenter } })); } catch {} }, [zoomEpicenter]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.scrollSmooth", String(scrollSmooth)); } catch {} }, [scrollSmooth]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.scrollAmount", String(scrollAmount)); } catch {} }, [scrollAmount]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.scrollZoomAmount", String(scrollZoomAmount)); window.dispatchEvent(new CustomEvent("juicecut-settings-changed", { detail: { key: "scrollZoomAmount", value: scrollZoomAmount } })); } catch {} }, [scrollZoomAmount]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.scrollZoomSmoothness", String(scrollZoomSmoothness)); window.dispatchEvent(new CustomEvent("juicecut-settings-changed", { detail: { key: "scrollZoomSmoothness", value: scrollZoomSmoothness } })); } catch {} }, [scrollZoomSmoothness]);
  useEffect(() => { try { window.localStorage.setItem('juicecut.settings.viewerControlsType', viewerControlsType); window.dispatchEvent(new CustomEvent('juicecut-settings-changed', { detail: { key: 'viewerControlsType', value: viewerControlsType } })); } catch {} }, [viewerControlsType]);
  useEffect(() => { try { window.localStorage.setItem('juicecut.settings.timecodePanel', timecodePanel); window.dispatchEvent(new CustomEvent('juicecut-settings-changed', { detail: { key: 'timecodePanel', value: timecodePanel } })); } catch {} }, [timecodePanel]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.elevatedPanelDarkenAmount", String(elevatedPanelDarken)); window.dispatchEvent(new CustomEvent("juicecut-settings-changed", { detail: { key: "elevatedPanelDarkenAmount", value: elevatedPanelDarken } })); } catch {} }, [elevatedPanelDarken]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.elevatedPanelBlurAmount", String(elevatedPanelBlur)); window.dispatchEvent(new CustomEvent("juicecut-settings-changed", { detail: { key: "elevatedPanelBlurAmount", value: elevatedPanelBlur } })); } catch {} }, [elevatedPanelBlur]);

  // Persist playneedle formula params
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.playneedle_t", String(pnT)); window.dispatchEvent(new CustomEvent("juicecut-settings-changed", { detail: { key: "playneedle_t", value: pnT } })); } catch {} }, [pnT]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.playneedle_j", String(pnJ)); window.dispatchEvent(new CustomEvent("juicecut-settings-changed", { detail: { key: "playneedle_j", value: pnJ } })); } catch {} }, [pnJ]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.playneedle_k", String(pnK)); window.dispatchEvent(new CustomEvent("juicecut-settings-changed", { detail: { key: "playneedle_k", value: pnK } })); } catch {} }, [pnK]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.playneedle_s", String(pnS)); window.dispatchEvent(new CustomEvent("juicecut-settings-changed", { detail: { key: "playneedle_s", value: pnS } })); } catch {} }, [pnS]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.playneedle_v_o", String(pnVo)); window.dispatchEvent(new CustomEvent("juicecut-settings-changed", { detail: { key: "playneedle_v_o", value: pnVo } })); } catch {} }, [pnVo]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.playneedle_h_b", String(pnHb)); window.dispatchEvent(new CustomEvent("juicecut-settings-changed", { detail: { key: "playneedle_h_b", value: pnHb } })); } catch {} }, [pnHb]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.playneedle_h_r", String(pnHr)); window.dispatchEvent(new CustomEvent("juicecut-settings-changed", { detail: { key: "playneedle_h_r", value: pnHr } })); } catch {} }, [pnHr]);

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
    <DraggableModal
      title="Settings"
      onClose={() => { onClose?.(); }}
      className="settings-modal"
      body={
        <div className="settings-body" ref={panelRef}>
          <nav className="settings-tabs" aria-label="Settings sections">
            <button type="button" className={"settings-tab" + (activeTab === "shortcuts" ? " settings-tab--active" : "")} onClick={() => setActiveTab("shortcuts")}>Keyboard</button>
            <button type="button" className={"settings-tab" + (activeTab === "sliders" ? " settings-tab--active" : "")} onClick={() => setActiveTab("sliders")}>Sliders</button>
            <button type="button" className={"settings-tab" + (activeTab === "checkboxes" ? " settings-tab--active" : "")} onClick={() => setActiveTab("checkboxes")}>Checkboxes</button>
            <button type="button" className={"settings-tab" + (activeTab === "multiselects" ? " settings-tab--active" : "")} onClick={() => setActiveTab("multiselects")}>Multiselects</button>
          </nav>
          <div className="settings-panel">
            {activeTab === "sliders" && (
              <div className="settings-panel-content">
                {/* GUI scale — not in any category */}
                <div className="settings-field" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ flex: 1, lineHeight: 1.2 }}>GUI scale</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "var(--text-primary)", fontFamily: "monospace", fontSize: 12, whiteSpace: "nowrap" }}>{guiScale}%</span>
                      <button type="button" className="icon-btn" onClick={() => setGuiScale(100)} title="Reset to default (100%)" style={{ padding: 4 }}><RotateCcw size={14} /></button>
                    </div>
                  </div>
                  <input type="range" className="settings-range-input" min={50} max={200} step={1} value={guiScale} onChange={e => setGuiScale(Number(e.target.value))} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)" }}><span>50%</span><span>200%</span></div>
                </div>

                {/* Scrolling category */}
                <SettingsCategory title="Scrolling">
                  <SliderSetting label="Timeline scroll smooth factor" value={scrollSmooth} min={0} max={100} step={1} onChange={setScrollSmooth} onReset={() => setScrollSmooth(50)} formatValue={v => `${v}%`} />
                  <SliderSetting label="Timeline scroll amount" value={scrollAmount} min={1} max={400} step={1} onChange={setScrollAmount} onReset={() => setScrollAmount(100)} formatValue={v => `${v}%`} />
                  <SliderSetting label="Timeline scroll zoom amount" value={scrollZoomAmount} min={1} max={100} step={1} onChange={setScrollZoomAmount} onReset={() => setScrollZoomAmount(25)} />
                  <SliderSetting label="Timeline scroll zoom smoothness" value={scrollZoomSmoothness} min={0} max={100} step={1} onChange={setScrollZoomSmoothness} onReset={() => setScrollZoomSmoothness(70)} formatValue={v => `${v}%`} />
                </SettingsCategory>

                {/* Playneedle category */}
                <SettingsCategory title="Playneedle">
                  <SliderSetting label={<span>t — Total thickness of the needle part</span>} value={pnT} min={0} max={0.5} step={0.001} onChange={setPnT} onReset={() => setPnT(0.092)} formatValue={v => v.toFixed(3)} />
                  <SliderSetting label={<span>j — Length of the ribbon at the top</span>} value={pnJ} min={-0.05} max={0.25} step={0.001} onChange={setPnJ} onReset={() => setPnJ(0.049)} formatValue={v => v.toFixed(3)} />
                  <SliderSetting label={<span>k — Falloff of the ribbon (log scale)</span>} value={pnK} min={10} max={1000} step={1} onChange={setPnK} onReset={() => setPnK(103)} logScale formatValue={v => v.toFixed(3)} />
                  <SliderSetting label={<span>s — Vertical height of the playneedle button</span>} value={pnS} min={10} max={50} step={0.1} onChange={setPnS} onReset={() => setPnS(16.4)} formatValue={v => v.toFixed(1)} />
                  <SliderSetting label={<span>v<sub>o</sub> — Vertical offset of the playneedle button</span>} value={pnVo} min={0} max={1} step={0.001} onChange={setPnVo} onReset={() => setPnVo(0.4)} formatValue={v => v.toFixed(3)} />
                  <SliderSetting label={<span>h<sub>b</sub> — Horizontal width of the playneedle button</span>} value={pnHb} min={0.5} max={1} step={0.001} onChange={setPnHb} onReset={() => setPnHb(0.8)} formatValue={v => v.toFixed(3)} />
                  <SliderSetting label={<span>h<sub>r</sub> — Horizontal width of the ribbon</span>} value={pnHr} min={0} max={1} step={0.001} onChange={setPnHr} onReset={() => setPnHr(1)} formatValue={v => v.toFixed(3)} />
                </SettingsCategory>

                {/* Miscellaneous category */}
                <SettingsCategory title="Miscellaneous">
                  <SliderSetting label="Draggable modal background darken amount" value={elevatedPanelDarken} min={0} max={100} step={1} onChange={setElevatedPanelDarken} onReset={() => setElevatedPanelDarken(50)} formatValue={v => `${v}%`} />
                  <SliderSetting label="Draggable modal background blur amount" value={elevatedPanelBlur} min={0} max={100} step={1} onChange={setElevatedPanelBlur} onReset={() => setElevatedPanelBlur(0)} formatValue={v => `${v}%`} />
                </SettingsCategory>
              </div>
            )}
            {activeTab === "checkboxes" && (
              <div className="settings-panel-content">
                <div className="settings-field" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <span style={{ flex: 1, lineHeight: 1.2 }}>Include splitter resize<br />actions in Ctrl+Z/Ctrl+Y</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" className="settings-checkbox" checked={includeResizeInUndo} onChange={e => setIncludeResizeInUndo(e.target.checked)} />
                    <button type="button" className="icon-btn" onClick={() => setIncludeResizeInUndo(true)} title="Reset to default (Checked)" style={{ padding: 4 }}><RotateCcw size={14} /></button>
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
                        <button key={opt} type="button" onClick={() => setViewerControlsType(opt)} style={{ padding: "5px 14px", borderRadius: "var(--radius-sm)", border: active ? "1px solid var(--accent-blue)" : "1px solid var(--border-mid)", background: active ? "rgba(56,189,248,0.15)" : "var(--bg-elevated)", color: active ? "var(--accent-blue)" : "var(--text-secondary)", fontSize: 12, fontWeight: active ? 600 : 400, cursor: "pointer", transition: "all 0.12s" }}>
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
                        <button key={opt} type="button" onClick={() => setTimecodePanel(opt)} style={{ padding: "5px 14px", borderRadius: "var(--radius-sm)", border: active ? "1px solid var(--accent-blue)" : "1px solid var(--border-mid)", background: active ? "rgba(56,189,248,0.15)" : "var(--bg-elevated)", color: active ? "var(--accent-blue)" : "var(--text-secondary)", fontSize: 12, fontWeight: active ? 600 : 400, cursor: "pointer", transition: "all 0.12s" }}>
                          {opt.charAt(0).toUpperCase() + opt.slice(1)}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="settings-field" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                  <span style={{ lineHeight: 1.2 }}>Timeline zoom epicenter</span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(['playneedle', 'middle', 'cursor'] as const).map(opt => {
                      const active = zoomEpicenter === opt;
                      return (
                        <button key={opt} type="button" onClick={() => setZoomEpicenter(opt)} style={{ padding: "5px 14px", borderRadius: "var(--radius-sm)", border: active ? "1px solid var(--accent-blue)" : "1px solid var(--border-mid)", background: active ? "rgba(56,189,248,0.15)" : "var(--bg-elevated)", color: active ? "var(--accent-blue)" : "var(--text-secondary)", fontSize: 12, fontWeight: active ? 600 : 400, cursor: "pointer", transition: "all 0.12s" }}>
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
                  <div key={action} className="settings-field" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span style={{ lineHeight: 1.2 }}>{SHORTCUT_LABELS[action]}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button type="button" className="icon-btn" onClick={() => addCombination(action)} title="Add shortcut combination" style={{ padding: 4 }}><Plus size={14} /></button>
                        <button type="button" className="icon-btn" onClick={() => handleReset(action)} title="Reset to default shortcuts" style={{ padding: 4 }}><RotateCcw size={14} /></button>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {shortcuts[action].map((keys, idx) => {
                        const isEditing = editingChip?.action === action && editingChip?.index === idx;
                        return (
                          <div key={idx} ref={el => { chipRefs.current[`${action}-${idx}`] = el; }} tabIndex={0} onFocus={() => setEditingChip({ action, index: idx })} onBlur={() => { setTimeout(() => setEditingChip(null), 150); }} onKeyDown={(e) => handleChipKeyDown(e, action, idx)} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: isEditing ? "var(--bg-hover)" : "var(--bg-elevated)", border: isEditing ? "1px solid var(--accent-blue)" : "1px solid var(--border-mid)", borderRadius: "var(--radius-sm)", padding: "3px 8px", cursor: "pointer", outline: "none", transition: "border-color 0.12s, background 0.12s", minHeight: 28 }} title={isEditing ? "Press keys to assign..." : keys.length === 0 ? "Click then press keys to assign" : "Click then press new keys to reassign"}>
                            <span style={{ fontSize: 12, color: keys.length > 0 ? "var(--text-primary)" : "var(--text-muted)", fontFamily: "monospace" }}>
                              {isEditing && keys.length === 0 ? "..." : keys.length > 0 ? formatKeys(keys) : "None"}
                            </span>
                            {shortcuts[action].length > 1 && (
                              <button type="button" style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "0 2px", fontSize: 13, lineHeight: 1, display: "flex", alignItems: "center" }} onMouseDown={(e) => { e.stopPropagation(); removeCombination(action, idx); }} title="Remove this combination">x</button>
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
      }
    />
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