INSERT INTO settings (key, value, description)
VALUES (
  'auto_slot_capacity_from_vehicles',
  'true',
  'Auto calculate slot capacity from active vehicles'
)
ON CONFLICT (key) DO NOTHING;
