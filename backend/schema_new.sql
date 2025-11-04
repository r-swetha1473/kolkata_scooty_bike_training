-- Kolkata Scotty Bike Training - PostgreSQL Schema
DROP TABLE IF EXISTS tbl_bookings CASCADE;
DROP TABLE IF EXISTS tbl_slots CASCADE;
DROP TABLE IF EXISTS tbl_trainers CASCADE;
DROP TABLE IF EXISTS tbl_users CASCADE;
DROP TABLE IF EXISTS tbl_audit_logs CASCADE;
DROP TABLE IF EXISTS tbl_settings CASCADE;

CREATE TABLE tbl_users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    profile_image VARCHAR(500),
    role VARCHAR(20) NOT NULL DEFAULT 'customer',
    google_id VARCHAR(255) UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tbl_trainers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES tbl_users(id) ON DELETE CASCADE,
    bio TEXT,
    experience_years INTEGER DEFAULT 0,
    specialization TEXT[],
    rating DECIMAL(3,2) DEFAULT 5.0,
    total_sessions INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tbl_vehicles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    registration_number VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tbl_slots (
    id SERIAL PRIMARY KEY,
    trainer_id INTEGER REFERENCES tbl_trainers(id) ON DELETE SET NULL,
    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(20) DEFAULT 'available',
    capacity INTEGER DEFAULT 1,
    booked_count INTEGER DEFAULT 0,
    is_auto_generated BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(slot_date, start_time)
);

CREATE TABLE tbl_bookings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES tbl_users(id) ON DELETE CASCADE,
    trainer_id INTEGER NOT NULL REFERENCES tbl_trainers(id) ON DELETE CASCADE,
    slot_id INTEGER NOT NULL REFERENCES tbl_slots(id) ON DELETE CASCADE,
    vehicle_id INTEGER REFERENCES tbl_vehicles(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'confirmed',
    notes TEXT,
    cancelled_at TIMESTAMP,
    cancelled_by INTEGER REFERENCES tbl_users(id) ON DELETE SET NULL,
    cancellation_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tbl_audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES tbl_users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tbl_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by INTEGER REFERENCES tbl_users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON tbl_users(email);
CREATE INDEX idx_users_google_id ON tbl_users(google_id);
CREATE INDEX idx_users_role ON tbl_users(role);
CREATE INDEX idx_trainers_user_id ON tbl_trainers(user_id);
CREATE INDEX idx_trainers_active ON tbl_trainers(is_active);
CREATE INDEX idx_slots_trainer_date ON tbl_slots(trainer_id, slot_date);
CREATE INDEX idx_slots_date_time ON tbl_slots(slot_date, start_time);
CREATE INDEX idx_slots_status ON tbl_slots(status);
CREATE INDEX idx_bookings_user ON tbl_bookings(user_id);
CREATE INDEX idx_bookings_trainer ON tbl_bookings(trainer_id);
CREATE INDEX idx_bookings_slot ON tbl_bookings(slot_id);
CREATE INDEX idx_bookings_status ON tbl_bookings(status);
CREATE INDEX idx_vehicles_active ON tbl_vehicles(is_active);
CREATE INDEX idx_slots_date ON tbl_slots(slot_date);
CREATE INDEX idx_slots_auto_gen ON tbl_slots(is_auto_generated);

INSERT INTO tbl_settings (key, value, description) VALUES
('business_hours', '{"start": "09:00", "end": "21:00", "slot_duration": 30}'::jsonb, 'Business operating hours'),
('booking_rules', '{"advance_booking_days": 30, "cancellation_hours": 24}'::jsonb, 'Booking rules'),
('pricing', '{"per_session": 500}'::jsonb, 'Pricing');

INSERT INTO tbl_vehicles (name, type, registration_number, is_active) VALUES
('Honda Activa', 'Scooter', 'WB-01-1234', true),
('Hero Splendor', 'Bike', 'WB-01-5678', true),
('TVS Jupiter', 'Scooter', 'WB-01-9012', true),
('Bajaj Pulsar', 'Bike', 'WB-01-3456', true);
