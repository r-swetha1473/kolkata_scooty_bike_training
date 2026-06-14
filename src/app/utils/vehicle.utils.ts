export type VehicleCategory = 'ev_scooty' | 'petrol_scooty' | 'bike';

export interface VehicleCapacityRow {
  vehicle_id: string;
  vehicle_name: string;
  capacity: number;
  booked: number;
}

export interface VehicleCategoryOption {
  category: VehicleCategory;
  label: string;
  capacity: number;
  booked: number;
  available: number;
  /** First vehicle in this category with remaining capacity (for booking). */
  vehicle_id: string | null;
}

const CATEGORY_META: Record<VehicleCategory, { label: string; defaultCapacity: number }> = {
  ev_scooty: { label: 'EV Scooty', defaultCapacity: 3 },
  petrol_scooty: { label: 'Petrol Scooty', defaultCapacity: 1 },
  bike: { label: 'Bike', defaultCapacity: 1 }
};

const CATEGORY_ORDER: VehicleCategory[] = ['ev_scooty', 'petrol_scooty', 'bike'];

/** Map a vehicle name to one of the three booking categories. */
export function categorizeVehicleName(name: string): VehicleCategory | null {
  const n = (name || '').toLowerCase();
  if (n.includes('electric') || n.startsWith('ev ')) return 'ev_scooty';
  if (n.includes('petrol')) return 'petrol_scooty';
  if (n.includes('bike')) return 'bike';
  return null;
}

/** Group per-vehicle API rows into the three customer-facing categories. */
export function getVehicleCategoryOptions(
  rows: VehicleCapacityRow[] | undefined | null
): VehicleCategoryOption[] {
  const hasApiRows = (rows?.length ?? 0) > 0;
  const grouped = new Map<
    VehicleCategory,
    { capacity: number; booked: number; vehicles: VehicleCapacityRow[] }
  >();

  for (const cat of CATEGORY_ORDER) {
    grouped.set(cat, { capacity: 0, booked: 0, vehicles: [] });
  }

  for (const row of rows || []) {
    if (!row?.vehicle_id) continue;
    const cat = categorizeVehicleName(row.vehicle_name);
    if (!cat) continue;
    const g = grouped.get(cat)!;
    g.capacity += Number(row.capacity) || 0;
    g.booked += Number(row.booked) || 0;
    g.vehicles.push(row);
  }

  return CATEGORY_ORDER.map((category) => {
    const meta = CATEGORY_META[category];
    const g = grouped.get(category)!;
    const capacity =
      g.capacity > 0 ? g.capacity : hasApiRows ? 0 : meta.defaultCapacity;
    const booked = Math.min(g.booked, capacity);
    const available = Math.max(0, capacity - booked);
    const pick = g.vehicles.find(
      (v) => (Number(v.booked) || 0) < (Number(v.capacity) || 0)
    );
    return {
      category,
      label: meta.label,
      capacity,
      booked,
      available,
      vehicle_id: pick?.vehicle_id ?? null
    };
  });
}

/** True when at least one vehicle category still has open seats. */
export function slotHasVehicleAvailability(slot: {
  vehicle_capacities?: VehicleCapacityRow[];
  capacity?: number;
  booked_count?: number;
}): boolean {
  const options = getVehicleCategoryOptions(slot.vehicle_capacities);
  if (options.some((o) => o.available > 0)) {
    return true;
  }
  const cap = Number(slot.capacity) || 5;
  const booked = Number(slot.booked_count) || 0;
  return booked < cap;
}

/** Live total seats from active vehicle rows (matches booking validation). */
export function getLiveSlotCapacity(slot: {
  vehicle_capacities?: VehicleCapacityRow[];
  live_capacity?: number;
  capacity?: number;
}): number {
  if (slot.live_capacity != null && Number.isFinite(Number(slot.live_capacity))) {
    return Math.max(0, Number(slot.live_capacity));
  }
  const options = getVehicleCategoryOptions(slot.vehicle_capacities);
  const fromVehicles = options.reduce((sum, o) => sum + o.capacity, 0);
  if (fromVehicles > 0 || (slot.vehicle_capacities?.length ?? 0) > 0) {
    return fromVehicles;
  }
  return Math.max(0, Number(slot.capacity) || 0);
}

export function getTotalAvailableSeats(slot: {
  vehicle_capacities?: VehicleCapacityRow[];
  live_capacity?: number;
  capacity?: number;
  booked_count?: number;
}): number {
  const options = getVehicleCategoryOptions(slot.vehicle_capacities);
  const fromVehicles = options.reduce((sum, o) => sum + o.available, 0);
  if (fromVehicles > 0 || (slot.vehicle_capacities?.length ?? 0) > 0) {
    return fromVehicles;
  }
  const cap = getLiveSlotCapacity(slot) || Number(slot.capacity) || 5;
  const booked = Number(slot.booked_count) || 0;
  return Math.max(0, cap - booked);
}
