// Simple DOM-based speech bubble dialog
// This is intentionally NOT a React component to avoid timing/import issues

let activeBubble: HTMLDivElement | null = null;
let activeTimer: ReturnType<typeof setTimeout> | null = null;

export function showBlockedDialog(reason: string, targetElement?: HTMLElement | null) {
  // Remove any existing bubble
  if (activeBubble) {
    activeBubble.remove();
    activeBubble = null;
  }
  if (activeTimer) {
    clearTimeout(activeTimer);
    activeTimer = null;
  }
  
  // Get the target position
  let left = 0;
  let top = 0;
  
  if (targetElement) {
    const rect = targetElement.getBoundingClientRect();
    left = rect.left + rect.width / 2 - 110;
    top = rect.bottom + 10;
  } else {
    left = (window as any).mouseX || window.innerWidth / 2;
    top = (window as any).mouseY || window.innerHeight / 2;
  }
  
  // Clamp to viewport
  if (left < 10) left = 10;
  if (left > window.innerWidth - 230) left = window.innerWidth - 230;
  
  // Create the arrow
  const arrow = document.createElement('div');
  arrow.style.cssText = `
    position: absolute;
    bottom: 100%;
    left: 50%;
    margin-left: -8px;
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-bottom: 8px solid var(--border-mid, #334155);
  `;
  
  // Create the arrow fill (overlaps the arrow border minus 1px)
  const arrowFill = document.createElement('div');
  arrowFill.style.cssText = `
    position: absolute;
    bottom: calc(100% - 1px);
    left: 50%;
    margin-left: -7px;
    width: 0;
    height: 0;
    border-left: 7px solid transparent;
    border-right: 7px solid transparent;
    border-bottom: 7px solid var(--bg-elevated, #1e293b);
  `;
  
  // Create the bubble content
  const content = document.createElement('div');
  content.innerHTML = reason;
  content.style.cssText = `
    background: var(--bg-elevated, #1e293b);
    border: 1px solid var(--border-mid, #334155);
    border-radius: 10px;
    padding: 8px 14px;
    font-size: 12px;
    color: var(--text-primary, #f1f5f9);
    box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 180px;
    justify-content: center;
  `;
  
  // Create the container
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    left: ${left}px;
    top: ${top}px;
    z-index: 999999;
    pointer-events: none;
  `;
  container.appendChild(arrow);
  container.appendChild(arrowFill);
  container.appendChild(content);
  document.body.appendChild(container);
  
  // Track as active bubble
  activeBubble = container;
  
  // Auto-hide after 2 seconds
  activeTimer = setTimeout(() => {
    container.style.opacity = '0';
    container.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
      if (container.parentNode) container.parentNode.removeChild(container);
      if (activeBubble === container) activeBubble = null;
    }, 300);
  }, 2000);
}

// Track mouse position globally
if (typeof window !== 'undefined') {
  window.addEventListener('mousemove', (e) => {
    (window as any).mouseX = e.clientX;
    (window as any).mouseY = e.clientY;
  }, true);
}

// Default export - empty component (kept for backwards compatibility with App.tsx)
export default function BlockedDialogManager() {
  // This component no longer needs to render anything
  // The dialog is created directly via DOM manipulation
  return null;
}