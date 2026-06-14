import * as d3 from 'd3';
import { categorizeVehicleName } from '../../utils/vehicle.utils';
import {
  ChartTooltip,
  capitalizeStatus,
  formatChartDate,
  tooltipRows
} from './chart-tooltip';

export type ChartCleanup = () => void;

const ANIM_MS = 800;

export interface ChartTheme {
  primary: string;
  palette: string[];
  status: Record<string, string>;
  axis: string;
  grid: string;
  surface: string;
}

function readCssVar(name: string, fallback: string, root?: HTMLElement): string {
  if (typeof document === 'undefined') return fallback;
  const el = root || document.documentElement;
  const value = getComputedStyle(el).getPropertyValue(name).trim();
  return value || fallback;
}

export function getChartTheme(root?: HTMLElement): ChartTheme {
  return {
    primary: readCssVar('--chart-primary', '#0066B1', root),
    palette: [
      readCssVar('--chart-primary', '#0066B1', root),
      readCssVar('--chart-accent-2', '#10B981', root),
      readCssVar('--chart-accent-3', '#F59E0B', root),
      readCssVar('--chart-accent-4', '#6B7280', root)
    ],
    status: {
      pending: readCssVar('--chart-pending', '#F59E0B', root),
      confirmed: readCssVar('--chart-confirmed', '#0066B1', root),
      completed: readCssVar('--chart-completed', '#10B981', root),
      cancelled: readCssVar('--chart-cancelled', '#EF4444', root)
    },
    axis: readCssVar('--chart-axis', '#9CA3AF', root),
    grid: readCssVar('--chart-grid', '#E5E7EB', root),
    surface: readCssVar('--chart-surface', '#FFFFFF', root)
  };
}

function styleAxes(g: d3.Selection<SVGGElement, unknown, null, undefined>, theme: ChartTheme): void {
  g.selectAll('.domain, .tick line').attr('stroke', theme.grid);
  g.selectAll('.tick text').attr('fill', theme.axis);
}

function addGlowFilter(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  id: string,
  color: string
): void {
  const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs');
  const filter = defs
    .append('filter')
    .attr('id', id)
    .attr('x', '-50%')
    .attr('y', '-50%')
    .attr('width', '200%')
    .attr('height', '200%');
  filter.append('feDropShadow').attr('dx', 0).attr('dy', 0).attr('stdDeviation', 3).attr('flood-color', color).attr('flood-opacity', 0.45);
}

export interface BookingChartRow {
  created_at?: string;
  status?: string;
  vehicle_name?: string;
  booking_source?: string;
  attendance_status?: string;
  start_time?: string;
  slot_date?: string;
}

export function aggregateSourceCounts(
  bookings: BookingChartRow[]
): { label: string; value: number }[] {
  let online = 0;
  let offline = 0;
  for (const row of bookings || []) {
    if (String(row.booking_source || 'ONLINE').toUpperCase() === 'OFFLINE') {
      offline += 1;
    } else {
      online += 1;
    }
  }
  return [
    { label: 'Online', value: online },
    { label: 'Offline', value: offline }
  ].filter((entry) => entry.value > 0);
}

export function aggregateAttendanceCounts(
  bookings: BookingChartRow[]
): { label: string; value: number }[] {
  const counts = { Scheduled: 0, Attended: 0, 'No Show': 0, Cancelled: 0 };
  for (const row of bookings || []) {
    const key = String(row.attendance_status || 'SCHEDULED').toUpperCase();
    if (key === 'ATTENDED') counts.Attended += 1;
    else if (key === 'NO_SHOW') counts['No Show'] += 1;
    else if (key === 'CANCELLED') counts.Cancelled += 1;
    else counts.Scheduled += 1;
  }
  return Object.entries(counts)
    .map(([label, value]) => ({ label, value }))
    .filter((entry) => entry.value > 0);
}

export function aggregateMonthlyAttendanceTrend(
  bookings: BookingChartRow[]
): { month: string; attended: number; noShow: number }[] {
  const map = new Map<string, { attended: number; noShow: number }>();
  for (const row of bookings || []) {
    const raw = row.start_time || row.created_at || row.slot_date;
    if (!raw) continue;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const bucket = map.get(month) || { attended: 0, noShow: 0 };
    const att = String(row.attendance_status || '').toUpperCase();
    if (att === 'ATTENDED') bucket.attended += 1;
    if (att === 'NO_SHOW') bucket.noShow += 1;
    map.set(month, bucket);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, v]) => ({ month, attended: v.attended, noShow: v.noShow }));
}

export function renderAttendanceTrendChart(
  container: HTMLElement,
  data: { month: string; attended: number; noShow: number }[]
): ChartCleanup {
  const theme = getChartTheme(container);
  const tooltip = ChartTooltip.getInstance();
  d3.select(container).selectAll('*').remove();

  const width = container.clientWidth || 480;
  const height = 260;
  const margin = { top: 16, right: 16, bottom: 36, left: 40 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`);

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const months = data.map((d) => d.month);
  const x = d3.scaleBand().domain(months).range([0, innerW]).padding(0.2);
  const maxVal = Math.max(1, d3.max(data, (d) => Math.max(d.attended, d.noShow)) || 0);
  const y = d3.scaleLinear().domain([0, maxVal]).nice().range([innerH, 0]);

  g.append('g').attr('transform', `translate(0,${innerH})`).call(d3.axisBottom(x).tickFormat((m) => String(m).slice(5)));
  g.append('g').call(d3.axisLeft(y).ticks(5));
  styleAxes(g as unknown as d3.Selection<SVGGElement, unknown, null, undefined>, theme);

  const barW = x.bandwidth() / 2;
  data.forEach((d) => {
    const xPos = x(d.month) || 0;
    g.append('rect')
      .attr('x', xPos)
      .attr('y', innerH)
      .attr('width', barW)
      .attr('height', 0)
      .attr('fill', theme.palette[1])
      .transition()
      .duration(ANIM_MS)
      .attr('y', y(d.attended))
      .attr('height', innerH - y(d.attended))
      .on('end', function handleEnd(this: SVGRectElement) {
        d3.select(this)
          .on('mouseenter', (event: MouseEvent) =>
            tooltip.show(
              tooltipRows([
                { label: 'Attended', value: String(d.attended) },
                { label: 'Month', value: d.month }
              ]),
              event.clientX,
              event.clientY
            )
          )
          .on('mousemove', (event: MouseEvent) => tooltip.move(event.clientX, event.clientY))
          .on('mouseleave', () => tooltip.hide());
      });
    g.append('rect')
      .attr('x', xPos + barW)
      .attr('y', innerH)
      .attr('width', barW)
      .attr('height', 0)
      .attr('fill', theme.palette[2])
      .transition()
      .duration(ANIM_MS)
      .attr('y', y(d.noShow))
      .attr('height', innerH - y(d.noShow));
  });

  return () => {
    d3.select(container).selectAll('*').remove();
  };
}

export function lastNDaysLabels(n: number): string[] {
  const labels: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    labels.push(d.toISOString().slice(0, 10));
  }
  return labels;
}

export function aggregateDailyBookings(bookings: BookingChartRow[], days = 30): { date: string; count: number }[] {
  const labels = lastNDaysLabels(days);
  const counts = new Map(labels.map((d) => [d, 0]));
  for (const b of bookings) {
    const raw = b.created_at || b.start_time || b.slot_date;
    if (!raw) continue;
    const key = new Date(raw).toISOString().slice(0, 10);
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return labels.map((date) => ({ date, count: counts.get(date) || 0 }));
}

export function aggregateVehicleUsage(bookings: BookingChartRow[]): { label: string; value: number }[] {
  const buckets = {
    'Petrol Scooty': 0,
    'Electric Scooty': 0,
    Bike: 0,
    Other: 0
  };
  for (const b of bookings) {
    const cat = categorizeVehicleName(b.vehicle_name || '');
    if (cat === 'petrol_scooty') buckets['Petrol Scooty']++;
    else if (cat === 'ev_scooty') buckets['Electric Scooty']++;
    else if (cat === 'bike') buckets.Bike++;
    else buckets.Other++;
  }
  return Object.entries(buckets)
    .filter(([, v]) => v > 0)
    .map(([label, value]) => ({ label, value }));
}

export function aggregateStatusCounts(bookings: BookingChartRow[]): { status: string; count: number }[] {
  const order = ['pending', 'confirmed', 'completed', 'cancelled'];
  const counts = new Map(order.map((s) => [s, 0]));
  for (const b of bookings) {
    const s = (b.status || '').toLowerCase();
    if (counts.has(s)) counts.set(s, (counts.get(s) || 0) + 1);
  }
  return order.map((status) => ({ status, count: counts.get(status) || 0 }));
}

export function renderLineChart(
  container: HTMLElement,
  data: { date: string; count: number }[]
): ChartCleanup {
  const theme = getChartTheme(container);
  const color = theme.primary;
  const tooltip = ChartTooltip.getInstance();
  d3.select(container).selectAll('*').remove();

  const width = container.clientWidth || 480;
  const height = 260;
  const margin = { top: 16, right: 16, bottom: 36, left: 40 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`);

  addGlowFilter(svg, 'line-point-glow', color);

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3
    .scalePoint<string>()
    .domain(data.map((d) => d.date))
    .range([0, innerW])
    .padding(0.5);

  const y = d3
    .scaleLinear()
    .domain([0, Math.max(1, d3.max(data, (d) => d.count) || 0)])
    .nice()
    .range([innerH, 0]);

  const line = d3
    .line<{ date: string; count: number }>()
    .x((d) => x(d.date) || 0)
    .y((d) => y(d.count))
    .curve(d3.curveMonotoneX);

  g.append('g')
    .attr('transform', `translate(0,${innerH})`)
    .call(
      d3
        .axisBottom(x)
        .tickValues(data.filter((_, i) => i % 5 === 0 || i === data.length - 1).map((d) => d.date))
        .tickFormat((d) => {
          const dt = new Date(String(d));
          return `${dt.getMonth() + 1}/${dt.getDate()}`;
        })
    )
    .selectAll('text')
    .attr('font-size', 10);

  g.append('g').call(d3.axisLeft(y).ticks(5)).selectAll('text').attr('font-size', 10);
  styleAxes(g, theme);

  const area = d3
    .area<{ date: string; count: number }>()
    .x((d) => x(d.date) || 0)
    .y0(innerH)
    .y1((d) => y(d.count))
    .curve(d3.curveMonotoneX);

  const areaPath = g
    .append('path')
    .datum(data)
    .attr('fill', color)
    .attr('fill-opacity', 0)
    .attr('d', area);

  areaPath.transition().duration(ANIM_MS).attr('fill-opacity', 0.08);

  const linePath = g
    .append('path')
    .datum(data)
    .attr('fill', 'none')
    .attr('stroke', color)
    .attr('stroke-width', 2.5)
    .attr('d', line);

  const lineNode = linePath.node();
  const totalLength = lineNode?.getTotalLength() ?? 0;
  linePath
    .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
    .attr('stroke-dashoffset', totalLength)
    .transition()
    .duration(ANIM_MS)
    .ease(d3.easeCubicOut)
    .attr('stroke-dashoffset', 0);

  const guide = g
    .append('line')
    .attr('class', 'chart-guide')
    .attr('stroke', theme.primary)
    .attr('stroke-opacity', 0.35)
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '4 4')
    .attr('opacity', 0);

  const focus = g
    .append('circle')
    .attr('class', 'chart-focus')
    .attr('r', 7)
    .attr('fill', color)
    .attr('stroke', theme.surface)
    .attr('stroke-width', 2.5)
    .attr('filter', 'url(#line-point-glow)')
    .attr('opacity', 0)
    .style('transition', 'opacity 0.2s ease');

  const dots = g
    .selectAll<SVGCircleElement, { date: string; count: number }>('.data-point')
    .data(data)
    .join('circle')
    .attr('class', 'data-point')
    .attr('cx', (d) => x(d.date) || 0)
    .attr('cy', (d) => y(d.count))
    .attr('r', 0)
    .attr('fill', color)
    .attr('opacity', 0.85)
    .style('transition', 'r 0.2s ease, opacity 0.2s ease');

  dots
    .transition()
    .duration(ANIM_MS)
    .delay((_, i) => i * 12)
    .attr('r', 3);

  const nearestIndex = (mx: number): number => {
    let best = 0;
    let bestDist = Infinity;
    data.forEach((d, i) => {
      const dist = Math.abs((x(d.date) || 0) - mx);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  };

  const overlay = g
    .append('rect')
    .attr('class', 'chart-overlay')
    .attr('width', innerW)
    .attr('height', innerH)
    .attr('fill', 'transparent')
    .style('cursor', 'crosshair');

  const onMove = (event: MouseEvent) => {
    const [mx] = d3.pointer(event, overlay.node());
    const idx = nearestIndex(mx);
    const point = data[idx];
    const px = x(point.date) || 0;
    const py = y(point.count);

    guide.attr('x1', px).attr('x2', px).attr('y1', 0).attr('y2', innerH).attr('opacity', 1);
    focus.attr('cx', px).attr('cy', py).attr('opacity', 1);
    dots.attr('r', (_, i) => (i === idx ? 5 : 3)).attr('opacity', (_, i) => (i === idx ? 1 : 0.55));

    tooltip.show(
      tooltipRows([
        { label: 'Date', value: formatChartDate(point.date) },
        { label: 'Bookings', value: String(point.count) }
      ]),
      event.clientX,
      event.clientY
    );
  };

  const onLeave = () => {
    guide.attr('opacity', 0);
    focus.attr('opacity', 0);
    dots.attr('r', 3).attr('opacity', 0.85);
    tooltip.hide();
  };

  overlay.on('mousemove', onMove).on('mouseleave', onLeave);

  return () => {
    overlay.on('mousemove', null).on('mouseleave', null);
    tooltip.hide();
    d3.select(container).selectAll('*').remove();
  };
}

export function renderDonutChart(
  container: HTMLElement,
  data: { label: string; value: number }[]
): ChartCleanup {
  const theme = getChartTheme(container);
  const colors = theme.palette;
  const tooltip = ChartTooltip.getInstance();
  d3.select(container).selectAll('*').remove();

  if (!data.length) {
    d3.select(container)
      .append('p')
      .attr('class', 'chart-empty')
      .style('color', theme.axis)
      .text('No vehicle data');
    return () => d3.select(container).selectAll('*').remove();
  }

  const width = container.clientWidth || 320;
  const height = 260;
  const radius = Math.min(width, height) / 2 - 12;
  const total = d3.sum(data, (d) => d.value);

  const svgRoot = d3
    .select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`);

  const svg = svgRoot.append('g').attr('transform', `translate(${width / 2},${height / 2})`);

  const pie = d3.pie<{ label: string; value: number }>().value((d) => d.value).sort(null);
  const arc = d3
    .arc<d3.PieArcDatum<{ label: string; value: number }>>()
    .innerRadius(radius * 0.55)
    .outerRadius(radius);
  const arcHover = d3
    .arc<d3.PieArcDatum<{ label: string; value: number }>>()
    .innerRadius(radius * 0.55)
    .outerRadius(radius + 12);

  const centerLabel = svg
    .append('text')
    .attr('class', 'donut-center-label')
    .attr('text-anchor', 'middle')
    .attr('dy', '-0.15em')
    .attr('fill', theme.axis)
    .attr('font-size', 11)
    .text('Hover slice');

  const centerValue = svg
    .append('text')
    .attr('class', 'donut-center-value')
    .attr('text-anchor', 'middle')
    .attr('dy', '1.1em')
    .attr('fill', theme.primary)
    .attr('font-size', 18)
    .attr('font-weight', 700)
    .text('');

  const slices = svg
    .selectAll<SVGPathElement, d3.PieArcDatum<{ label: string; value: number }>>('path.slice')
    .data(pie(data))
    .join('path')
    .attr('class', 'slice')
    .attr('fill', (_, i) => colors[i % colors.length])
    .attr('stroke', theme.surface)
    .attr('stroke-width', 2)
    .style('cursor', 'pointer')
    .style('transition', 'opacity 0.25s ease')
    .each(function (d) {
      (this as SVGPathElement & { _current: d3.PieArcDatum<{ label: string; value: number }> })._current = {
        ...d,
        startAngle: 0,
        endAngle: 0,
        padAngle: 0
      };
    })
    .attr('d', function (d) {
      const current = (this as SVGPathElement & { _current: d3.PieArcDatum<{ label: string; value: number }> })._current;
      return arc(current) || '';
    });

  slices
    .transition()
    .duration(ANIM_MS)
    .ease(d3.easeCubicOut)
    .attrTween('d', function (d) {
      const el = this as SVGPathElement & { _current: d3.PieArcDatum<{ label: string; value: number }> };
      const interp = d3.interpolate(el._current, d);
      return (t) => {
        el._current = interp(t);
        return arc(el._current) || '';
      };
    });

  const resetSlices = () => {
    slices
      .transition()
      .duration(200)
      .attr('d', (d) => arc(d) || '')
      .attr('opacity', 1);
    centerLabel.text('Hover slice');
    centerValue.text('');
  };

  const onEnter = function (event: MouseEvent, d: d3.PieArcDatum<{ label: string; value: number }>) {
    const pct = total ? Math.round((d.data.value / total) * 100) : 0;
    slices
      .transition()
      .duration(200)
      .attr('opacity', 0.4);
    d3.select(this).transition().duration(200).attr('opacity', 1).attr('d', arcHover(d) || '');
    centerLabel.text(d.data.label);
    centerValue.text(`${pct}%`);
    tooltip.show(
      tooltipRows([
        { label: 'Vehicle', value: d.data.label },
        { label: 'Bookings', value: String(d.data.value) },
        { label: 'Share', value: `${pct}%` }
      ]),
      event.clientX,
      event.clientY
    );
  };

  const onMove = (event: MouseEvent) => {
    tooltip.move(event.clientX, event.clientY);
  };

  const onLeave = () => {
    resetSlices();
    tooltip.hide();
  };

  slices.on('mouseenter', onEnter).on('mousemove', onMove).on('mouseleave', onLeave);

  const legend = d3
    .select(container)
    .append('div')
    .attr('class', 'chart-legend')
    .style('color', theme.axis);
  data.forEach((d, i) => {
    legend
      .append('div')
      .attr('class', 'legend-item')
      .html(`<span class="dot" style="background:${colors[i % colors.length]}"></span>${d.label}: ${d.value}`);
  });

  return () => {
    slices.on('mouseenter', null).on('mousemove', null).on('mouseleave', null);
    tooltip.hide();
    d3.select(container).selectAll('*').remove();
  };
}

export function renderStatusBarChart(
  container: HTMLElement,
  data: { status: string; count: number }[]
): ChartCleanup {
  const theme = getChartTheme(container);
  const colors = theme.status;
  const tooltip = ChartTooltip.getInstance();
  d3.select(container).selectAll('*').remove();

  const width = container.clientWidth || 480;
  const height = 260;
  const margin = { top: 16, right: 16, bottom: 36, left: 40 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`);

  const defs = svg.append('defs');
  defs
    .append('filter')
    .attr('id', 'bar-hover-shadow')
    .append('feDropShadow')
    .attr('dx', 0)
    .attr('dy', 4)
    .attr('stdDeviation', 4)
    .attr('flood-opacity', 0.18);

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3
    .scaleBand()
    .domain(data.map((d) => d.status))
    .range([0, innerW])
    .padding(0.35);

  const y = d3
    .scaleLinear()
    .domain([0, Math.max(1, d3.max(data, (d) => d.count) || 0)])
    .nice()
    .range([innerH, 0]);

  g.append('g')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x))
    .selectAll('text')
    .attr('font-size', 11);

  g.append('g').call(d3.axisLeft(y).ticks(5)).selectAll('text').attr('font-size', 10);
  styleAxes(g, theme);

  const bars = g
    .selectAll<SVGRectElement, { status: string; count: number }>('rect.bar')
    .data(data)
    .join('rect')
    .attr('class', 'bar')
    .attr('x', (d) => x(d.status) || 0)
    .attr('y', innerH)
    .attr('width', x.bandwidth())
    .attr('height', 0)
    .attr('rx', 6)
    .attr('fill', (d) => colors[d.status] || theme.palette[3])
    .style('cursor', 'pointer')
    .style('transition', 'filter 0.2s ease');

  bars
    .transition()
    .duration(ANIM_MS)
    .delay((_, i) => i * 90)
    .ease(d3.easeCubicOut)
    .attr('y', (d) => y(d.count))
    .attr('height', (d) => innerH - y(d.count));

  const onEnter = function (event: MouseEvent, d: { status: string; count: number }) {
    const el = d3.select(this);
    const baseY = y(d.count);
    const baseH = innerH - baseY;
    el.interrupt()
      .transition()
      .duration(200)
      .attr('y', baseY - 4)
      .attr('height', baseH + 4)
      .attr('filter', 'url(#bar-hover-shadow)')
      .attr('fill-opacity', 1);
    bars.filter((b) => b.status !== d.status).transition().duration(200).attr('fill-opacity', 0.72);
    tooltip.show(
      tooltipRows([
        { label: 'Status', value: capitalizeStatus(d.status) },
        { label: 'Count', value: String(d.count) }
      ]),
      event.clientX,
      event.clientY
    );
  };

  const onMove = (event: MouseEvent) => {
    tooltip.move(event.clientX, event.clientY);
  };

  const onLeave = () => {
    bars
      .interrupt()
      .transition()
      .duration(200)
      .attr('y', (d) => y(d.count))
      .attr('height', (d) => innerH - y(d.count))
      .attr('filter', null)
      .attr('fill-opacity', 1);
    tooltip.hide();
  };

  bars.on('mouseenter', onEnter).on('mousemove', onMove).on('mouseleave', onLeave);

  return () => {
    bars.on('mouseenter', null).on('mousemove', null).on('mouseleave', null);
    tooltip.hide();
    d3.select(container).selectAll('*').remove();
  };
}

export function renderLabelBarChart(
  container: HTMLElement,
  data: { label: string; value: number }[],
  barColor?: string
): ChartCleanup {
  const theme = getChartTheme(container);
  const tooltip = ChartTooltip.getInstance();
  d3.select(container).selectAll('*').remove();

  if (!data.length) {
    d3.select(container)
      .append('p')
      .attr('class', 'chart-empty')
      .style('color', theme.axis)
      .style('font-size', '13px')
      .text('No data available');
    return () => d3.select(container).selectAll('*').remove();
  }

  const width = container.clientWidth || 480;
  const height = 260;
  const margin = { top: 16, right: 16, bottom: 48, left: 40 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`);

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3
    .scaleBand()
    .domain(data.map((d) => d.label))
    .range([0, innerW])
    .padding(0.35);

  const y = d3
    .scaleLinear()
    .domain([0, Math.max(1, d3.max(data, (d) => d.value) || 0)])
    .nice()
    .range([innerH, 0]);

  g.append('g')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x))
    .selectAll('text')
    .attr('font-size', 10)
    .attr('transform', 'rotate(-24)')
    .style('text-anchor', 'end');

  g.append('g').call(d3.axisLeft(y).ticks(5)).selectAll('text').attr('font-size', 10);
  styleAxes(g, theme);

  const fill = barColor || theme.primary;
  const bars = g
    .selectAll<SVGRectElement, { label: string; value: number }>('rect.bar')
    .data(data)
    .join('rect')
    .attr('class', 'bar')
    .attr('x', (d) => x(d.label) || 0)
    .attr('y', innerH)
    .attr('width', x.bandwidth())
    .attr('height', 0)
    .attr('rx', 6)
    .attr('fill', fill)
    .style('cursor', 'pointer');

  bars
    .transition()
    .duration(ANIM_MS)
    .attr('y', (d) => y(d.value))
    .attr('height', (d) => innerH - y(d.value));

  bars
    .on('mouseenter', (event: MouseEvent, d) => {
      tooltip.show(
        tooltipRows([
          { label: d.label, value: String(d.value) }
        ]),
        event.clientX,
        event.clientY
      );
    })
    .on('mousemove', (event: MouseEvent) => tooltip.move(event.clientX, event.clientY))
    .on('mouseleave', () => tooltip.hide());

  return () => {
    bars.on('mouseenter', null).on('mousemove', null).on('mouseleave', null);
    tooltip.hide();
    d3.select(container).selectAll('*').remove();
  };
}
