/** Single reusable floating tooltip shared across dashboard D3 charts. */

let sharedTooltip: ChartTooltip | null = null;

export class ChartTooltip {
  private readonly el: HTMLDivElement;
  private visible = false;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  private constructor() {
    this.el = document.createElement('div');
    this.el.className = 'd3-chart-tooltip';
    this.el.setAttribute('role', 'tooltip');
    this.el.setAttribute('aria-hidden', 'true');
    Object.assign(this.el.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '10000',
      opacity: '0',
      transition: 'opacity 0.18s ease',
      background: '#ffffff',
      borderRadius: '10px',
      padding: '10px 12px',
      fontSize: '13px',
      lineHeight: '1.45',
      color: '#111827',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)',
      border: '1px solid #E5E7EB',
      maxWidth: '240px',
      whiteSpace: 'nowrap'
    });
    document.body.appendChild(this.el);
  }

  static getInstance(): ChartTooltip {
    if (!sharedTooltip) {
      sharedTooltip = new ChartTooltip();
    }
    return sharedTooltip;
  }

  static destroyInstance(): void {
    sharedTooltip?.destroy();
    sharedTooltip = null;
  }

  show(html: string, clientX: number, clientY: number): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.el.innerHTML = html;
    this.el.setAttribute('aria-hidden', 'false');
    this.move(clientX, clientY);
    if (!this.visible) {
      this.visible = true;
      requestAnimationFrame(() => {
        this.el.style.opacity = '1';
      });
    } else {
      this.move(clientX, clientY);
    }
  }

  move(clientX: number, clientY: number): void {
    const pad = 14;
    const w = this.el.offsetWidth || 160;
    const h = this.el.offsetHeight || 60;
    let left = clientX + pad;
    let top = clientY + pad;
    if (left + w > window.innerWidth - 8) {
      left = clientX - w - pad;
    }
    if (top + h > window.innerHeight - 8) {
      top = clientY - h - pad;
    }
    this.el.style.left = `${Math.max(8, left)}px`;
    this.el.style.top = `${Math.max(8, top)}px`;
  }

  hide(): void {
    if (!this.visible) return;
    this.el.style.opacity = '0';
    this.el.setAttribute('aria-hidden', 'true');
    this.hideTimer = setTimeout(() => {
      this.visible = false;
      this.el.innerHTML = '';
      this.hideTimer = null;
    }, 180);
  }

  destroy(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
    }
    this.el.remove();
  }
}

export function formatChartDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function capitalizeStatus(status: string): string {
  if (!status) return '';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function tooltipRows(rows: { label: string; value: string }[]): string {
  return rows
    .map(
      (r) =>
        `<div style="display:flex;justify-content:space-between;gap:20px;margin:2px 0;">` +
        `<span style="color:#6B7280;">${r.label}</span>` +
        `<strong style="color:#111827;">${r.value}</strong></div>`
    )
    .join('');
}
