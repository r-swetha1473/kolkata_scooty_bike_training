import * as d3 from 'd3';
import { categorizeVehicleName } from '../../utils/vehicle.utils';

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

export interface BookingChartRow {
  created_at?: string;
  status?: string;
  vehicle_name?: string;
  start_time?: string;
  slot_date?: string;
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
): void {
  const theme = getChartTheme(container);
  const color = theme.primary;
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

  g.append('path')
    .datum(data)
    .attr('fill', color)
    .attr('fill-opacity', 0.08)
    .attr('d', area);

  g.append('path')
    .datum(data)
    .attr('fill', 'none')
    .attr('stroke', color)
    .attr('stroke-width', 2.5)
    .attr('d', line);

  g.selectAll('circle')
    .data(data)
    .join('circle')
    .attr('cx', (d) => x(d.date) || 0)
    .attr('cy', (d) => y(d.count))
    .attr('r', 3)
    .attr('fill', color);
}

export function renderDonutChart(
  container: HTMLElement,
  data: { label: string; value: number }[]
): void {
  const theme = getChartTheme(container);
  const colors = theme.palette;
  d3.select(container).selectAll('*').remove();
  if (!data.length) {
    d3.select(container)
      .append('p')
      .attr('class', 'chart-empty')
      .style('color', theme.axis)
      .text('No vehicle data');
    return;
  }
  const width = container.clientWidth || 320;
  const height = 260;
  const radius = Math.min(width, height) / 2 - 12;

  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .append('g')
    .attr('transform', `translate(${width / 2},${height / 2})`);

  const pie = d3.pie<{ label: string; value: number }>().value((d) => d.value);
  const arc = d3.arc<d3.PieArcDatum<{ label: string; value: number }>>().innerRadius(radius * 0.55).outerRadius(radius);

  svg
    .selectAll('path')
    .data(pie(data))
    .join('path')
    .attr('d', arc)
    .attr('fill', (_, i) => colors[i % colors.length])
    .attr('stroke', theme.surface)
    .attr('stroke-width', 2);

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
}

export function renderStatusBarChart(
  container: HTMLElement,
  data: { status: string; count: number }[]
): void {
  const theme = getChartTheme(container);
  const colors = theme.status;
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

  g.selectAll('rect')
    .data(data)
    .join('rect')
    .attr('x', (d) => x(d.status) || 0)
    .attr('y', (d) => y(d.count))
    .attr('width', x.bandwidth())
    .attr('height', (d) => innerH - y(d.count))
    .attr('rx', 6)
    .attr('fill', (d) => colors[d.status] || theme.palette[3]);
}
