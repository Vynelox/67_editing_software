import { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { RotateCcw, Plus, ChevronRight } from 'lucide-react';
import type { ShortcutAction } from './shortcuts';
import { getShortcutKeys as scGetKeys, updateShortcuts as scUpdate, resetDefaultShortcuts as scReset } from './shortcuts';
import DraggableModal from './DraggableModal';
import TorusMenu, { insideMenuItems } from './TorusMenu';
import { OpenTorusMenuEditor } from './TorusMenuEditor';
import { OpenPlayneedleEditor } from './PlayneedleEditor';

type SettingsTab = "sliders" | "checkboxes" | "shortcuts" | "multiselects" | "components";

interface Props {
  onClose?: () => void;
  initialPageData?: any;
  initialScroll?: number | null;
}

const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  undo: "Undo",
  redo: "Redo",
  timelineZoomToggle: "Timeline horizontal zoom toggle",
  exitModal: "Exit modal",
};

function loadAllShortcuts(): Record<ShortcutAction, string[][]> {
  return {
    undo: scGetKeys("undo"),
    redo: scGetKeys("redo"),
    timelineZoomToggle: scGetKeys("timelineZoomToggle"),
    exitModal: scGetKeys("exitModal"),
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

function SettingsCategory({ title, children }: { title: string; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="settings-category">
      <button type="button" className="settings-category-header" onClick={() => setExpanded(e => !e)} aria-expanded={expanded}>
        <span className="settings-category-title">{title}</span>
        <ChevronRight size={14} className="settings-category-arrow" style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }} />
      </button>
      <div className="settings-category-body" style={{ display: 'grid', gridTemplateRows: expanded ? '1fr' : '0fr', overflow: 'hidden' }}>
        <div style={{ overflow: 'hidden' }}>
          <div className="settings-category-body-inner">{children}</div>
        </div>
      </div>
    </div>
  );
}

function SliderSetting({ label, value, min, max, step, onChange, onReset, formatValue, logScale }: {
  label: React.ReactNode; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; onReset: () => void; formatValue?: (v: number) => string; logScale?: boolean;
}) {
  const defaultFormat = (v: number) => v.toFixed(3);
  const fmt = formatValue || defaultFormat;
  const displayValue = fmt(value);
  const sliderToValue = (slider: number) => {
    if (!logScale) return min + (slider / 1000) * (max - min);
    const logMin = Math.log10(min); const logMax = Math.log10(max);
    return Math.pow(10, logMin + (slider / 1000) * (logMax - logMin));
  };
  const valueToSlider = (val: number) => {
    if (!logScale) return ((val - min) / (max - min)) * 1000;
    return ((Math.log10(val) - Math.log10(min)) / (Math.log10(max) - Math.log10(min))) * 1000;
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
      <input type="range" className="settings-range-input" min={0} max={1000} step={1} value={valueToSlider(value)} onChange={e => onChange(sliderToValue(Number(e.target.value)))} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)" }}><span>{fmt(min)}</span><span>{fmt(max)}</span></div>
    </div>
  );
}

export default function Settings(props: Props) { return SettingsShell(props); }

function SettingsShell({ onClose, initialPageData, initialScroll }: Props) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    if (initialPageData?.tab === "sliders") return "sliders";
    if (initialPageData?.tab === "checkboxes") return "checkboxes";
    if (initialPageData?.tab === "shortcuts") return "shortcuts";
    if (initialPageData?.tab === "components") return "components";
    return "sliders";
  });
  const panelRef = useRef<HTMLDivElement | null>(null);

  const [guiScale, setGuiScale] = useState<number>(() => { try { const v = window.localStorage.getItem("juicecut.settings.guiScale"); return v ? Number(v) : 100; } catch { return 100; } });
  const [includeResizeInUndo, setIncludeResizeInUndo] = useState<boolean>(() => { try { const v = window.localStorage.getItem("juicecut.settings.includeResizeInUndo"); return v === null ? true : v === "true"; } catch { return true; } });
  const [zoomEpicenter, setZoomEpicenter] = useState<string>(() => { try { return window.localStorage.getItem('juicecut.settings.zoomEpicenter') || 'playneedle'; } catch { return 'playneedle'; } });
  const [scrollSmooth, setScrollSmooth] = useState<number>(() => { try { const v = window.localStorage.getItem("juicecut.settings.scrollSmooth"); return v ? Number(v) : 50; } catch { return 50; } });
  const [scrollAmount, setScrollAmount] = useState<number>(() => { try { const v = window.localStorage.getItem("juicecut.settings.scrollAmount"); return v ? Number(v) : 100; } catch { return 100; } });
  const [scrollZoomAmount, setScrollZoomAmount] = useState<number>(() => { try { const v = window.localStorage.getItem("juicecut.settings.scrollZoomAmount"); return v ? Number(v) : 25; } catch { return 25; } });
  const [scrollZoomSmoothness, setScrollZoomSmoothness] = useState<number>(() => { try { const v = window.localStorage.getItem("juicecut.settings.scrollZoomSmoothness"); return v ? Number(v) : 70; } catch { return 70; } });
  const [viewerControlsType, setViewerControlsType] = useState<string>(() => { try { return window.localStorage.getItem('juicecut.settings.viewerControlsType') || 'compact'; } catch { return 'compact'; } });
  const [timecodePanel, setTimecodePanel] = useState<string>(() => { try { return window.localStorage.getItem('juicecut.settings.timecodePanel') || 'both'; } catch { return 'both'; } });
  const [torusScrollingDisabled, setTorusScrollingDisabled] = useState<string>(() => { try { return window.localStorage.getItem('juicecut.settings.torusScrollingDisabled') || 'none'; } catch { return 'none'; } });
  const [elevatedPanelDarken, setElevatedPanelDarken] = useState<number>(() => { try { const v = window.localStorage.getItem("juicecut.settings.elevatedPanelDarkenAmount"); return v ? Number(v) : 50; } catch { return 50; } });
  const [elevatedPanelBlur, setElevatedPanelBlur] = useState<number>(() => { try { const v = window.localStorage.getItem("juicecut.settings.elevatedPanelBlurAmount"); return v ? Number(v) : 0; } catch { return 0; } });
  const [pnT, setPnT] = useState<number>(() => { try { const v = window.localStorage.getItem("juicecut.settings.playneedle_t"); return v !== null ? Number(v) : 0.092; } catch { return 0.092; } });
  const [pnJ, setPnJ] = useState<number>(() => { try { const v = window.localStorage.getItem("juicecut.settings.playneedle_j"); return v !== null ? Number(v) : 0.049; } catch { return 0.049; } });
  const [pnK, setPnK] = useState<number>(() => { try { const v = window.localStorage.getItem("juicecut.settings.playneedle_k"); return v !== null ? Number(v) : 103; } catch { return 103; } });
  const [draggableHeaderButtons, setDraggableHeaderButtons] = useState<boolean>(() => {
    try {
      const v = window.localStorage.getItem("juicecut.settings.draggableHeaderButtons");
      return v === null ? true : v === "true";
    } catch {
      return true;
    }
  });
  
  useEffect(() => {
    try {
      window.localStorage.setItem("juicecut.settings.draggableHeaderButtons", String(draggableHeaderButtons));
      // Make the setting available globally
      if (!(window as any).juicecut) (window as any).juicecut = {};
      if (!(window as any).juicecut.settings) (window as any).juicecut.settings = {};
      (window as any).juicecut.settings.draggableHeaderButtons = draggableHeaderButtons;
    } catch {}
  }, [draggableHeaderButtons]);
  const [pnS, setPnS] = useState<number>(() => { try { const v = window.localStorage.getItem("juicecut.settings.playneedle_s"); return v !== null ? Number(v) : 16.4; } catch { return 16.4; } });
  const [pnVo, setPnVo] = useState<number>(() => { try { const v = window.localStorage.getItem("juicecut.settings.playneedle_v_o"); return v !== null ? Number(v) : 0.4; } catch { return 0.4; } });
  const [pnHb, setPnHb] = useState<number>(() => { try { const v = window.localStorage.getItem("juicecut.settings.playneedle_h_b"); return v !== null ? Number(v) : 0.8; } catch { return 0.8; } });
  const [pnHr, setPnHr] = useState<number>(() => { try { const v = window.localStorage.getItem("juicecut.settings.playneedle_h_r"); return v !== null ? Number(v) : 1; } catch { return 1; } });
  const [colorTransitionDuration, setColorTransitionDuration] = useState<number>(() => {
    try {
      const v = window.localStorage.getItem("juicecut.settings.colorTransitionDuration");
      return v !== null ? Number(v) : 0;
    } catch {
      return 0;
    }
  });

  const [shortcuts, setShortcuts] = useState<Record<ShortcutAction, string[][]>>(loadAllShortcuts);
  const [editingChip, setEditingChip] = useState<{ action: ShortcutAction; index: number } | null>(null);
  const chipRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const SCROLL_AMOUNT_POWER = 3.355;
  const scrollAmountToSlider = (value: number) => { if (value <= 1) return 0; if (value >= 400) return 1000; return Math.round(1000 * Math.pow((value - 1) / 399, 1 / SCROLL_AMOUNT_POWER)); };
  const sliderToScrollAmount = (sv: number) => { return Math.round(1 + 399 * Math.pow(Math.max(0, Math.min(1, sv / 1000)), SCROLL_AMOUNT_POWER)); };

  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.guiScale", String(guiScale)); document.documentElement.style.setProperty('--gui-scale', `${guiScale / 100}`); window.dispatchEvent(new CustomEvent("juicecut-settings-changed", { detail: { key: "guiScale", value: guiScale } })); } catch {} }, [guiScale]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.includeResizeInUndo", includeResizeInUndo ? "true" : "false"); } catch {} }, [includeResizeInUndo]);
  useEffect(() => { try { window.localStorage.setItem('juicecut.settings.zoomEpicenter', zoomEpicenter); window.dispatchEvent(new CustomEvent('juicecut-settings-changed', { detail: { key: 'zoomEpicenter', value: zoomEpicenter } })); } catch {} }, [zoomEpicenter]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.scrollSmooth", String(scrollSmooth)); } catch {} }, [scrollSmooth]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.scrollAmount", String(scrollAmount)); } catch {} }, [scrollAmount]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.scrollZoomAmount", String(scrollZoomAmount)); window.dispatchEvent(new CustomEvent("juicecut-settings-changed", { detail: { key: "scrollZoomAmount", value: scrollZoomAmount } })); } catch {} }, [scrollZoomAmount]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.scrollZoomSmoothness", String(scrollZoomSmoothness)); window.dispatchEvent(new CustomEvent("juicecut-settings-changed", { detail: { key: "scrollZoomSmoothness", value: scrollZoomSmoothness } })); } catch {} }, [scrollZoomSmoothness]);
  useEffect(() => { try { window.localStorage.setItem('juicecut.settings.viewerControlsType', viewerControlsType); window.dispatchEvent(new CustomEvent('juicecut-settings-changed', { detail: { key: 'viewerControlsType', value: viewerControlsType } })); } catch {} }, [viewerControlsType]);
  useEffect(() => { try { window.localStorage.setItem('juicecut.settings.timecodePanel', timecodePanel); window.dispatchEvent(new CustomEvent('juicecut-settings-changed', { detail: { key: 'timecodePanel', value: timecodePanel } })); } catch {} }, [timecodePanel]);
  useEffect(() => { try { window.localStorage.setItem('juicecut.settings.torusScrollingDisabled', torusScrollingDisabled); window.dispatchEvent(new CustomEvent('juicecut-settings-changed', { detail: { key: 'torusScrollingDisabled', value: torusScrollingDisabled } })); } catch {} }, [torusScrollingDisabled]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.elevatedPanelDarkenAmount", String(elevatedPanelDarken)); window.dispatchEvent(new CustomEvent("juicecut-settings-changed", { detail: { key: "elevatedPanelDarkenAmount", value: elevatedPanelDarken } })); } catch {} }, [elevatedPanelDarken]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.elevatedPanelBlurAmount", String(elevatedPanelBlur)); window.dispatchEvent(new CustomEvent("juicecut-settings-changed", { detail: { key: "elevatedPanelBlurAmount", value: elevatedPanelBlur } })); } catch {} }, [elevatedPanelBlur]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.playneedle_t", String(pnT)); window.dispatchEvent(new CustomEvent("juicecut-settings-changed", { detail: { key: "playneedle_t", value: pnT } })); } catch {} }, [pnT]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.playneedle_j", String(pnJ)); window.dispatchEvent(new CustomEvent("juicecut-settings-changed", { detail: { key: "playneedle_j", value: pnJ } })); } catch {} }, [pnJ]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.playneedle_k", String(pnK)); window.dispatchEvent(new CustomEvent("juicecut-settings-changed", { detail: { key: "playneedle_k", value: pnK } })); } catch {} }, [pnK]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.playneedle_s", String(pnS)); window.dispatchEvent(new CustomEvent("juicecut-settings-changed", { detail: { key: "playneedle_s", value: pnS } })); } catch {} }, [pnS]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.playneedle_v_o", String(pnVo)); window.dispatchEvent(new CustomEvent("juicecut-settings-changed", { detail: { key: "playneedle_v_o", value: pnVo } })); } catch {} }, [pnVo]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.playneedle_h_b", String(pnHb)); window.dispatchEvent(new CustomEvent("juicecut-settings-changed", { detail: { key: "playneedle_h_b", value: pnHb } })); } catch {} }, [pnHb]);
  useEffect(() => { try { window.localStorage.setItem("juicecut.settings.playneedle_h_r", String(pnHr)); window.dispatchEvent(new CustomEvent("juicecut-settings-changed", { detail: { key: "playneedle_h_r", value: pnHr } })); } catch {} }, [pnHr]);

  useEffect(() => {
    try {
      window.localStorage.setItem("juicecut.settings.colorTransitionDuration", String(colorTransitionDuration));
      // Make the setting available globally
      if (!(window as any).juicecut) (window as any).juicecut = {};
      if (!(window as any).juicecut.settings) (window as any).juicecut.settings = {};
      (window as any).juicecut.settings.colorTransitionDuration = colorTransitionDuration;
      
      // Update transition properties on the document
      if (document.documentElement) {
        document.documentElement.style.setProperty('--theme-transition-duration', `${colorTransitionDuration}ms`);
        document.documentElement.style.setProperty('--theme-transition-timing', 'cubic-bezier(0.4, 0, 0.2, 1)');
      }
    } catch {}
  }, [colorTransitionDuration]);

  useEffect(() => {
    if (initialScroll != null && panelRef.current) {
      const el = panelRef.current.querySelector(".settings-panel-content");
      if (el) el.scrollTop = initialScroll;
    }
    // Initialize global settings object
    if (!(window as any).juicecut) (window as any).juicecut = {};
    if (!(window as any).juicecut.settings) (window as any).juicecut.settings = {};
    (window as any).juicecut.settings.draggableHeaderButtons = draggableHeaderButtons;
  }, []);

  const addCombination = (action: ShortcutAction) => { const next = { ...shortcuts, [action]: [...shortcuts[action], []] }; setShortcuts(next); scUpdate(next); const newIndex = next[action].length - 1; setEditingChip({ action, index: newIndex }); setTimeout(() => { chipRefs.current[`${action}-${newIndex}`]?.focus(); }, 0); };
  const removeCombination = (action: ShortcutAction, index: number) => { const arr = shortcuts[action].filter((_, i) => i !== index); const next = { ...shortcuts, [action]: arr.length > 0 ? arr : [[]] }; setShortcuts(next); scUpdate(next); setEditingChip(null); };
  const updateCombination = (action: ShortcutAction, index: number, keys: string[]) => { const arr = [...shortcuts[action]]; arr[index] = keys; const next = { ...shortcuts, [action]: arr }; setShortcuts(next); scUpdate(next); setEditingChip(null); };
  const handleReset = (action: ShortcutAction) => { scReset(action); setShortcuts(loadAllShortcuts()); setEditingChip(null); };
  const handleChipKeyDown = (e: React.KeyboardEvent, action: ShortcutAction, index: number) => {
    e.preventDefault(); e.stopPropagation();
    const keys: string[] = [];
    if (e.ctrlKey || e.metaKey) keys.push("ctrl");
    if (e.shiftKey) keys.push("shift");
    if (e.altKey) keys.push("alt");
    const key = e.key.toLowerCase();
    if (key !== "control" && key !== "shift" && key !== "alt" && key !== "meta") keys.push(key === " " ? "space" : key);
    if (keys.length > 0) updateCombination(action, index, keys);
  };

  return (
    <DraggableModal title="Settings" onClose={() => { onClose?.(); }} className="settings-modal" body={
      <div className="settings-body" ref={panelRef}>
        <nav className="settings-tabs" aria-label="Settings sections">
          <button type="button" className={"settings-tab" + (activeTab === "shortcuts" ? " settings-tab--active" : "")} onClick={() => setActiveTab("shortcuts")}>Keyboard</button>
          <button type="button" className={"settings-tab" + (activeTab === "sliders" ? " settings-tab--active" : "")} onClick={() => setActiveTab("sliders")}>Sliders</button>
          <button type="button" className={"settings-tab" + (activeTab === "checkboxes" ? " settings-tab--active" : "")} onClick={() => setActiveTab("checkboxes")}>Checkboxes</button>
          <button type="button" className={"settings-tab" + (activeTab === "multiselects" ? " settings-tab--active" : "")} onClick={() => setActiveTab("multiselects")}>Multiselects</button>
          <button type="button" className={"settings-tab" + (activeTab === "components" ? " settings-tab--active" : "")} onClick={() => setActiveTab("components")}>Components</button>
        </nav>
        <div className="settings-panel">
          {activeTab === "sliders" && (
            <div className="settings-panel-content">
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
              <SettingsCategory title="Scrolling">
                <SliderSetting label="Timeline scroll smooth factor" value={scrollSmooth} min={0} max={100} step={1} onChange={setScrollSmooth} onReset={() => setScrollSmooth(50)} formatValue={v => `${v.toFixed(3)}%`} />
                <SliderSetting label="Timeline scroll amount" value={scrollAmount} min={1} max={400} step={1} onChange={setScrollAmount} onReset={() => setScrollAmount(100)} formatValue={v => `${v.toFixed(3)}%`} />
                <SliderSetting label="Timeline scroll zoom amount" value={scrollZoomAmount} min={1} max={100} step={1} onChange={setScrollZoomAmount} onReset={() => setScrollZoomAmount(25)} />
                <SliderSetting label="Timeline scroll zoom smoothness" value={scrollZoomSmoothness} min={0} max={100} step={1} onChange={setScrollZoomSmoothness} onReset={() => setScrollZoomSmoothness(70)} formatValue={v => `${v.toFixed(3)}%`} />
              </SettingsCategory>
              <SettingsCategory title="Playneedle">
                <div style={{ padding: 8, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
                  Playneedle settings moved to <strong>Components → Playneedle Editor</strong>
                </div>
              </SettingsCategory>
              <SettingsCategory title="Miscellaneous">
                <SliderSetting label="Draggable modal background darken amount" value={elevatedPanelDarken} min={0} max={100} step={1} onChange={setElevatedPanelDarken} onReset={() => setElevatedPanelDarken(50)} formatValue={v => `${v.toFixed(3)}%`} />
                <SliderSetting label="Draggable modal background blur amount" value={elevatedPanelBlur} min={0} max={100} step={1} onChange={setElevatedPanelBlur} onReset={() => setElevatedPanelBlur(0)} formatValue={v => `${v.toFixed(3)}%`} />
                <SliderSetting 
                  label="Color change transition duration"
                  value={colorTransitionDuration}
                  min={0}
                  max={1000}
                  step={10}
                  onChange={setColorTransitionDuration}
                  onReset={() => setColorTransitionDuration(0)}
                  formatValue={v => `${v}ms`}
                />
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
              <div className="settings-field" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginTop: 12 }}>
                <span style={{ flex: 1, lineHeight: 1.2 }}>Allow ○, ?, and ～ buttons in<br />modals' header bar to be draggable</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" className="settings-checkbox" checked={draggableHeaderButtons} onChange={e => setDraggableHeaderButtons(e.target.checked)} />
                  <button type="button" className="icon-btn" onClick={() => setDraggableHeaderButtons(true)} title="Reset to default (Checked)" style={{ padding: 4 }}><RotateCcw size={14} /></button>
                </div>
              </div>
            </div>
          )}
          {activeTab === "multiselects" && (
            <div className="settings-panel-content">
              <div className="settings-field" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                <span style={{ lineHeight: 1.2 }}>Viewer controls type</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {(['compact', 'centered'] as const).map(opt => { const active = viewerControlsType === opt; return (<button key={opt} type="button" onClick={() => setViewerControlsType(opt)} style={{ padding: "5px 14px", borderRadius: "var(--radius-sm)", border: active ? "1px solid var(--highlight-color)" : "1px solid var(--border-mid)", background: active ? "rgba(56,189,248,0.15)" : "var(--bg-elevated)", color: active ? "var(--highlight-color)" : "var(--text-secondary)", fontSize: 12, fontWeight: active ? 600 : 400, cursor: "pointer" }}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</button>); })}
                </div>
              </div>
              <div className="settings-field" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                <span style={{ lineHeight: 1.2 }}>Timecode display</span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(['timeline', 'viewer', 'both', 'none'] as const).map(opt => { const active = timecodePanel === opt; return (<button key={opt} type="button" onClick={() => setTimecodePanel(opt)} style={{ padding: "5px 14px", borderRadius: "var(--radius-sm)", border: active ? "1px solid var(--highlight-color)" : "1px solid var(--border-mid)", background: active ? "rgba(56,189,248,0.15)" : "var(--bg-elevated)", color: active ? "var(--highlight-color)" : "var(--text-secondary)", fontSize: 12, fontWeight: active ? 600 : 400, cursor: "pointer" }}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</button>); })}
                </div>
              </div>
              <div className="settings-field" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                <span style={{ lineHeight: 1.2 }}>Timeline zoom epicenter</span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(['playneedle', 'middle', 'cursor'] as const).map(opt => { const active = zoomEpicenter === opt; return (<button key={opt} type="button" onClick={() => setZoomEpicenter(opt)} style={{ padding: "5px 14px", borderRadius: "var(--radius-sm)", border: active ? "1px solid var(--highlight-color)" : "1px solid var(--border-mid)", background: active ? "rgba(56,189,248,0.15)" : "var(--bg-elevated)", color: active ? "var(--highlight-color)" : "var(--text-secondary)", fontSize: 12, fontWeight: active ? 600 : 400, cursor: "pointer" }}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</button>); })}
                </div>
              </div>
              <div className="settings-field" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                <span style={{ lineHeight: 1.2 }}>Disable scrolling when torus menu is open and mouse is on:</span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(['whole torus menu', 'annular sectors only', 'none'] as const).map(opt => { const active = torusScrollingDisabled === opt; return (<button key={opt} type="button" onClick={() => setTorusScrollingDisabled(opt)} style={{ padding: "5px 14px", borderRadius: "var(--radius-sm)", border: active ? "1px solid var(--highlight-color)" : "1px solid var(--border-mid)", background: active ? "rgba(56,189,248,0.15)" : "var(--bg-elevated)", color: active ? "var(--highlight-color)" : "var(--text-secondary)", fontSize: 12, fontWeight: active ? 600 : 400, cursor: "pointer" }}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</button>); })}
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
                        <div key={idx} ref={el => { chipRefs.current[`${action}-${idx}`] = el; }} tabIndex={0} onFocus={() => setEditingChip({ action, index: idx })} onBlur={() => { setTimeout(() => setEditingChip(null), 150); }} onKeyDown={(e) => handleChipKeyDown(e, action, idx)} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: isEditing ? "var(--bg-hover)" : "var(--bg-elevated)", border: isEditing ? "1px solid var(--highlight-color)" : "1px solid var(--border-mid)", borderRadius: "var(--radius-sm)", padding: "3px 8px", cursor: "pointer", outline: "none", minHeight: 28 }} title={isEditing ? "Press keys to assign..." : keys.length === 0 ? "Click then press keys to assign" : "Click then press new keys to reassign"}>
                          <span style={{ fontSize: 12, color: keys.length > 0 ? "var(--text-primary)" : "var(--text-muted)", fontFamily: "monospace" }}>{isEditing && keys.length === 0 ? "..." : keys.length > 0 ? formatKeys(keys) : "None"}</span>
                          {shortcuts[action].length > 1 && (<button type="button" style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "0 2px", fontSize: 13, lineHeight: 1, display: "flex", alignItems: "center" }} onMouseDown={(e) => { e.stopPropagation(); removeCombination(action, idx); }} title="Remove this combination">x</button>)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeTab === "components" && (
            <div style={{ flex: 1, padding: 16, overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 90px)', gap: '8px 12px', alignItems: 'flex-start', justifyContent: 'flex-start' }}>
              <button onClick={() => { 
                onClose?.(); 
                OpenTorusMenuEditor(() => {
                  OpenSettings({ tab: 'components' });
                }); 
              }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'transparent', border: 'none', borderRadius: 'var(--radius-md)', padding: '12px 16px', cursor: 'pointer', color: 'var(--text-secondary)', width: 90, height: 100, flexShrink: 0 }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7, flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="4" />
                  <line x1="12" y1="3" x2="12" y2="7" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                  <line x1="3" y1="12" x2="7" y2="12" />
                  <line x1="17" y1="12" x2="21" y2="12" />
                </svg>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.5px', textAlign: 'center' }}>Torus Menu Editor</span>
              </button>
              <button onClick={() => { 
                onClose?.(); 
                OpenPlayneedleEditor(() => {
                  OpenSettings({ tab: 'components' });
                }); 
              }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'transparent', border: 'none', borderRadius: 'var(--radius-md)', padding: '12px 16px', cursor: 'pointer', color: 'var(--text-secondary)', width: 90, height: 100, flexShrink: 0 }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                <svg width="36" height="36" viewBox="0 0 100 200" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7, flexShrink: 0 }}>
                  <path d="M50 10 C50 10, 50 50, 50 50 C50 50, 50 90, 50 90 C50 90, 50 130, 50 130 C50 130, 50 170, 50 170" stroke="currentColor" strokeWidth="2" fill="none"/>
                  <ellipse cx="50" cy="170" rx="15" ry="8" fill="currentColor" opacity="0.3"/>
                  <path d="M35 100 Q50 80 65 100" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5"/>
                  <path d="M35 120 Q50 100 65 120" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5"/>
                </svg>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.5px', textAlign: 'center' }}>Playneedle Editor</span>
              </button>
            </div>
          )}
        </div>
      </div>
    } />
  );
}

export function OpenSettings(pageData?: any, scroll?: number | null) {
  // Set initial transition properties if they haven't been set yet
  if (document.documentElement && !document.documentElement.style.getPropertyValue('--theme-transition-duration')) {
    const duration = (window as any).juicecut?.settings?.colorTransitionDuration || 0;
    document.documentElement.style.setProperty('--theme-transition-duration', `${duration}ms`);
    document.documentElement.style.setProperty('--theme-transition-timing', 'cubic-bezier(0.4, 0, 0.2, 1)');
  }
  
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const cleanup = () => { try { root.unmount(); } catch (e) {} if (container.parentNode) container.parentNode.removeChild(container); (window as any).__popClose?.(); };
  (window as any).__pushClose?.(cleanup);
  root.render(<SettingsShell initialPageData={pageData} initialScroll={scroll ?? null} onClose={cleanup} />);
  return cleanup;
}

export function closeSettings() { const existing = document.querySelector(".modal-overlay.settings-modal"); if (existing && existing.parentNode) existing.parentNode.removeChild(existing); }
(window as any).__onColorPickerClose = null;
try { (window as any).OpenSettings = OpenSettings; } catch (e) {}
try { (window as any).closeSettings = closeSettings; } catch (e) {}