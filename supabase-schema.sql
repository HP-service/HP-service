-- ============================================================================
-- GESTIONALE HOTEL — Schema Supabase consolidato
-- ----------------------------------------------------------------------------
-- File unico, idempotente, eseguibile su un Supabase nuovo da zero in un
-- singolo paste nel SQL Editor.
--
-- Fonti consolidate (nell'ordine di applicazione, fix integrati al posto giusto):
--   migrations/00000000000000_init.sql
--   migrations/00000000000001_rls.sql
--   migrations/00000000000002_triggers.sql
--   migrations/00000000000004_checkin.sql
--   migrations/00000000000005_istat.sql
--   migrations/00000000000006_guest_portal.sql
--   migrations/00000000000007_ical_sync.sql
--   fix_auto_checkout_and_loyalty.sql       (sostituisce update_guest_stats)
--   fix_guest_stats.sql                     (solo trigger booking → guest stats)
--   fix_rooms_status.sql                    (one-shot di realignment in coda)
--
-- Migration 00000000000003_seed.sql NON contiene dati: solo commenti.
-- ============================================================================


-- ============================================================================
-- EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================================
-- ENUMS
-- ============================================================================

DO $$ BEGIN CREATE TYPE user_role        AS ENUM ('Manager', 'Reception', 'Housekeeping', 'Maintenance');                                                  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE room_status      AS ENUM ('Available', 'Occupied', 'Maintenance', 'OutOfOrder');                                                   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE cleaning_status  AS ENUM ('Clean', 'Dirty', 'Inspection', 'InProgress');                                                           EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE booking_status   AS ENUM ('Inquiry', 'Confirmed', 'CheckedIn', 'CheckedOut', 'Cancelled', 'NoShow');                               EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payment_method   AS ENUM ('Cash', 'CreditCard', 'BankTransfer', 'OTAVirtualCard', 'Satispay', 'Other');                            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payment_type     AS ENUM ('Deposit', 'Settlement', 'Refund', 'Adjustment');                                                        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE task_type        AS ENUM ('CleaningCheckout', 'CleaningStayover', 'CleaningDeep', 'Maintenance', 'Inspection');                   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE task_status      AS ENUM ('Pending', 'InProgress', 'Completed', 'Cancelled');                                                      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE task_priority    AS ENUM ('Low', 'Normal', 'High', 'Urgent');                                                                      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE folio_status     AS ENUM ('Open', 'Closed', 'Settled', 'Disputed');                                                                EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE expense_status   AS ENUM ('Pending', 'Approved', 'Paid', 'Rejected');                                                              EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE block_reason     AS ENUM ('Maintenance', 'Renovation', 'VIPHold', 'OutOfService', 'Other');                                        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE activity_action  AS ENUM ('create', 'update', 'delete', 'status_change', 'check_in', 'check_out', 'payment', 'cancellation');     EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE guest_type       AS ENUM ('16', '17', '18', '19', '20');                                                                            EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================================
-- SEQUENCES
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS booking_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS folio_number_seq   START 1;


-- ============================================================================
-- TABLES
-- ============================================================================

-- 1. PROPERTIES
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    country TEXT DEFAULT 'IT',
    phone TEXT,
    email TEXT,
    vat_number TEXT,
    fiscal_code TEXT,
    check_in_time TIME DEFAULT '15:00',
    check_out_time TIME DEFAULT '11:00',
    currency TEXT DEFAULT 'EUR',
    timezone TEXT DEFAULT 'Europe/Rome',
    logo_url TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PROFILES
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    role user_role NOT NULL DEFAULT 'Reception',
    property_id UUID REFERENCES properties(id),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ROOM TYPES
CREATE TABLE IF NOT EXISTS room_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    short_code TEXT,
    default_capacity INTEGER NOT NULL DEFAULT 2,
    max_capacity INTEGER NOT NULL DEFAULT 3,
    base_price DECIMAL(10,2) NOT NULL DEFAULT 100.00,
    amenities JSONB DEFAULT '[]',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(property_id, name)
);

-- 4. ROOMS
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    floor INTEGER,
    status room_status NOT NULL DEFAULT 'Available',
    cleaning_status cleaning_status NOT NULL DEFAULT 'Clean',
    notes TEXT,
    features JSONB DEFAULT '[]',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(property_id, name)
);

-- 5. ROOM TYPE ASSIGNMENTS (M:N)
CREATE TABLE IF NOT EXISTS room_type_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(room_id, room_type_id)
);

-- 6. BOOKING CHANNELS
CREATE TABLE IF NOT EXISTS booking_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    commission_rate DECIMAL(5,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(property_id, name)
);

-- 7. GUESTS (con campi Alloggiati Web integrati)
CREATE TABLE IF NOT EXISTS guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    nationality TEXT,
    document_type TEXT,
    document_number TEXT,
    document_expiry DATE,
    document_issued_by TEXT,        -- codice luogo rilascio (9 cifre)
    date_of_birth DATE,
    tax_code TEXT,
    address TEXT,
    city TEXT,
    country TEXT,
    gender TEXT,                    -- '1'=M, '2'=F (codice Alloggiati)
    place_of_birth TEXT,            -- codice ISTAT comune 9 cifre
    province_of_birth TEXT,         -- sigla provincia 2 chars
    country_of_birth TEXT,          -- codice stato nascita 9 cifre
    citizenship TEXT,               -- codice stato cittadinanza 9 cifre
    loyalty_level TEXT DEFAULT 'Standard',
    total_stays INTEGER DEFAULT 0,
    total_revenue DECIMAL(10,2) DEFAULT 0.00,
    tags JSONB DEFAULT '[]',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. BOOKINGS (con guest portal + iCal integrati)
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    booking_number TEXT NOT NULL,
    guest_id UUID NOT NULL REFERENCES guests(id),
    room_type_id UUID NOT NULL REFERENCES room_types(id),
    room_id UUID REFERENCES rooms(id),
    channel_id UUID REFERENCES booking_channels(id),
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    nights INTEGER GENERATED ALWAYS AS (check_out - check_in) STORED,
    status booking_status NOT NULL DEFAULT 'Confirmed',
    adults INTEGER NOT NULL DEFAULT 1,
    children INTEGER NOT NULL DEFAULT 0,
    total_amount DECIMAL(10,2),
    commission_amount DECIMAL(10,2) DEFAULT 0.00,
    has_early_check_in BOOLEAN DEFAULT FALSE,
    has_late_check_out BOOLEAN DEFAULT FALSE,
    special_requests TEXT,
    internal_notes TEXT,
    external_ref TEXT,
    external_ical_uid TEXT,
    external_source TEXT,
    guest_access_code VARCHAR(8),
    guest_code_generated_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    checked_in_at TIMESTAMPTZ,
    checked_out_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_dates  CHECK (check_out > check_in),
    CONSTRAINT valid_guests CHECK (adults >= 1)
);

-- 9. DAILY RATES
CREATE TABLE IF NOT EXISTS daily_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    min_stay INTEGER DEFAULT 1,
    max_stay INTEGER,
    is_closed BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(property_id, room_type_id, date)
);

-- 10. ROOM BLOCKS
CREATE TABLE IF NOT EXISTS room_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason block_reason NOT NULL DEFAULT 'Maintenance',
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_block_dates CHECK (end_date >= start_date)
);

-- 11. FOLIOS
CREATE TABLE IF NOT EXISTS folios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    folio_number TEXT NOT NULL,
    status folio_status NOT NULL DEFAULT 'Open',
    notes TEXT,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. INVOICE ITEMS
CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folio_id UUID NOT NULL REFERENCES folios(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Room',
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    tax_rate DECIMAL(5,4) DEFAULT 0.10,
    total_gross DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    total_net   DECIMAL(10,2) GENERATED ALWAYS AS ((quantity * unit_price) / (1 + tax_rate)) STORED,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. TRANSACTIONS
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folio_id UUID NOT NULL REFERENCES folios(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    method payment_method NOT NULL DEFAULT 'Cash',
    type   payment_type   NOT NULL DEFAULT 'Settlement',
    reference TEXT,
    notes TEXT,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recorded_by UUID REFERENCES profiles(id),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 14. EXPENSE CATEGORIES
CREATE TABLE IF NOT EXISTS expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    parent_id UUID REFERENCES expense_categories(id),
    color TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(property_id, name)
);

-- 15. EXPENSES
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES expense_categories(id),
    description TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0.00,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    vendor TEXT,
    receipt_url TEXT,
    room_id UUID REFERENCES rooms(id),
    status expense_status NOT NULL DEFAULT 'Approved',
    notes TEXT,
    recorded_by UUID REFERENCES profiles(id),
    approved_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. TASKS
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    room_id UUID REFERENCES rooms(id),
    booking_id UUID REFERENCES bookings(id),
    assigned_to UUID REFERENCES profiles(id),
    type task_type NOT NULL,
    status task_status NOT NULL DEFAULT 'Pending',
    priority task_priority NOT NULL DEFAULT 'Normal',
    title TEXT NOT NULL,
    description TEXT,
    estimated_minutes INTEGER DEFAULT 30,
    due_date TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES profiles(id),
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. COMPETITOR STRUCTURES
CREATE TABLE IF NOT EXISTS competitor_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT,
    platform TEXT,
    location TEXT,
    stars INTEGER,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. COMPETITOR PRICES
CREATE TABLE IF NOT EXISTS competitor_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competitor_id UUID NOT NULL REFERENCES competitor_structures(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    price DECIMAL(10,2),
    room_type_scraped TEXT,
    availability_status TEXT,
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(competitor_id, date, room_type_scraped)
);

-- 19. ACTIVITY LOG
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id),
    action activity_action NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    changes JSONB,
    metadata JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 20. BOOKING_GUESTS (accompagnatori)
CREATE TABLE IF NOT EXISTS booking_guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES guests(id),
    guest_type guest_type NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_booking_guest UNIQUE(booking_id, guest_id)
);

-- 21. ALLOGGIATI_SUBMISSIONS
CREATE TABLE IF NOT EXISTS alloggiati_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    booking_id  UUID NOT NULL REFERENCES bookings(id)  ON DELETE CASCADE,
    method TEXT NOT NULL DEFAULT 'Send',
    schedine_count INTEGER NOT NULL DEFAULT 0,
    schedine_valide INTEGER,
    request_data TEXT,
    response_esito BOOLEAN,
    response_error_code TEXT,
    response_error_desc TEXT,
    response_detail JSONB,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_by UUID REFERENCES profiles(id),
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 22. ISTAT_SUBMISSIONS
CREATE TABLE IF NOT EXISTS istat_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    data_rilevazione DATE NOT NULL,
    camere_occupate INTEGER NOT NULL DEFAULT 0,
    giornate JSONB NOT NULL,
    response_status INTEGER,
    response_body JSONB,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_by UUID REFERENCES profiles(id),
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_istat_property_date UNIQUE(property_id, data_rilevazione)
);

-- 23. PORTAL_SERVICES
CREATE TABLE IF NOT EXISTS portal_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    category TEXT NOT NULL DEFAULT 'general',
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2),
    image_url TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 24. PORTAL_ATTRACTIONS
CREATE TABLE IF NOT EXISTS portal_attractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    category TEXT NOT NULL DEFAULT 'attraction',
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    external_url TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 25. ICAL_SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS ical_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    room_id     UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    channel_id  UUID REFERENCES booking_channels(id) ON DELETE SET NULL,
    ical_url TEXT NOT NULL,
    last_synced_at TIMESTAMPTZ,
    sync_status TEXT DEFAULT 'pending',
    last_error TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 26. ICAL_SYNC_LOG
CREATE TABLE IF NOT EXISTS ical_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES ical_subscriptions(id) ON DELETE CASCADE,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    bookings_created   INTEGER DEFAULT 0,
    bookings_updated   INTEGER DEFAULT 0,
    bookings_cancelled INTEGER DEFAULT 0,
    errors JSONB
);


-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_rta_room_type_active ON room_type_assignments(room_type_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_rta_room_active      ON room_type_assignments(room_id)      WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_guests_name  ON guests(property_id, full_name);
CREATE INDEX IF NOT EXISTS idx_guests_email ON guests(property_id, email);

CREATE INDEX IF NOT EXISTS idx_bookings_dates  ON bookings(property_id, check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(property_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_room   ON bookings(room_id) WHERE room_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_guest  ON bookings(guest_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_number   ON bookings(property_id, booking_number);
CREATE INDEX IF NOT EXISTS idx_bookings_ical_uid ON bookings(external_ical_uid) WHERE external_ical_uid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_daily_rates_lookup ON daily_rates(room_type_id, date);

CREATE INDEX IF NOT EXISTS idx_room_blocks_dates ON room_blocks(room_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_expenses_date     ON expenses(property_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned        ON tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_tasks_room            ON tasks(room_id);
CREATE INDEX IF NOT EXISTS idx_tasks_property_status ON tasks(property_id, status);

CREATE INDEX IF NOT EXISTS idx_competitor_prices_date ON competitor_prices(competitor_id, date);

CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user   ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_date   ON activity_log(property_id, created_at);

CREATE INDEX IF NOT EXISTS idx_booking_guests_booking ON booking_guests(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_guests_guest   ON booking_guests(guest_id);

CREATE INDEX IF NOT EXISTS idx_alloggiati_sub_booking  ON alloggiati_submissions(booking_id);
CREATE INDEX IF NOT EXISTS idx_alloggiati_sub_property ON alloggiati_submissions(property_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_istat_sub_property ON istat_submissions(property_id, data_rilevazione DESC);

CREATE INDEX IF NOT EXISTS idx_portal_services_property    ON portal_services(property_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_portal_attractions_property ON portal_attractions(property_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_ical_subs_property ON ical_subscriptions(property_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_ical_log_sub       ON ical_sync_log(subscription_id, synced_at DESC);


-- ============================================================================
-- FUNCTIONS
-- ----------------------------------------------------------------------------
-- Le funzioni qui sotto sono le versioni FINALI:
--   * update_guest_stats      → versione corretta (SQL puro, soglie Bronze/Silver/Gold/Platinum)
--                               da fix_auto_checkout_and_loyalty.sql, sostituisce la prima
--                               definizione di fix_guest_stats.sql.
--   * sweep_stale_checkins    → da fix_auto_checkout_and_loyalty.sql.
--   * trg_booking_update_guest_stats → da fix_guest_stats.sql.
-- ============================================================================

-- Helper: ruolo utente corrente
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: property_id utente corrente
CREATE OR REPLACE FUNCTION get_user_property_id()
RETURNS UUID AS $$
    SELECT property_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Auto-create profile su Supabase Auth signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, 'user'), '@', 1)),
        NEW.email,
        COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'Reception'::public.user_role)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Auto-generate booking number
CREATE OR REPLACE FUNCTION generate_booking_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.booking_number IS NULL OR NEW.booking_number = '' THEN
        NEW.booking_number := 'BK-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' ||
                              LPAD(nextval('booking_number_seq')::TEXT, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-create folio su booking creation
CREATE OR REPLACE FUNCTION auto_create_folio()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.folios (booking_id, folio_number)
    VALUES (
        NEW.id,
        'F-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(nextval('public.folio_number_seq')::TEXT, 5, '0')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Prevent double booking
CREATE OR REPLACE FUNCTION prevent_double_booking()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.room_id IS NOT NULL AND NEW.status IN ('Confirmed', 'CheckedIn') THEN
        IF EXISTS (
            SELECT 1 FROM bookings
            WHERE room_id = NEW.room_id
              AND id != NEW.id
              AND status IN ('Confirmed', 'CheckedIn')
              AND check_in < NEW.check_out
              AND check_out > NEW.check_in
        ) THEN
            RAISE EXCEPTION 'La camera e gia prenotata per le date selezionate'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-create housekeeping task su checkout
CREATE OR REPLACE FUNCTION on_checkout_create_task()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'CheckedOut' AND OLD.status = 'CheckedIn' AND NEW.room_id IS NOT NULL THEN
        UPDATE public.rooms SET cleaning_status = 'Dirty' WHERE id = NEW.room_id;

        INSERT INTO public.tasks (property_id, room_id, booking_id, type, priority, title)
        VALUES (
            NEW.property_id,
            NEW.room_id,
            NEW.id,
            'CleaningCheckout',
            'High',
            'Pulizia checkout - Camera ' || (SELECT name FROM public.rooms WHERE id = NEW.room_id)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Auto-update room status su check-in/check-out
CREATE OR REPLACE FUNCTION update_room_on_booking_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.room_id IS NOT NULL THEN
        IF NEW.status = 'CheckedIn' AND (OLD.status IS NULL OR OLD.status != 'CheckedIn') THEN
            UPDATE public.rooms SET status = 'Occupied' WHERE id = NEW.room_id;
        END IF;

        IF NEW.status = 'CheckedOut' AND OLD.status = 'CheckedIn' THEN
            UPDATE public.rooms SET status = 'Available' WHERE id = NEW.room_id;
        END IF;

        IF NEW.status = 'Cancelled' AND OLD.status = 'CheckedIn' THEN
            UPDATE public.rooms SET status = 'Available' WHERE id = NEW.room_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Auto-update booking timestamps
CREATE OR REPLACE FUNCTION update_booking_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'Confirmed'  AND (OLD.status IS NULL OR OLD.status != 'Confirmed')  THEN NEW.confirmed_at  = NOW(); END IF;
    IF NEW.status = 'CheckedIn'  AND OLD.status != 'CheckedIn'                          THEN NEW.checked_in_at = NOW(); END IF;
    IF NEW.status = 'CheckedOut' AND OLD.status != 'CheckedOut'                         THEN NEW.checked_out_at= NOW(); END IF;
    IF NEW.status = 'Cancelled'  AND OLD.status != 'Cancelled'                          THEN NEW.cancelled_at  = NOW(); END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Reusable updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Disponibilità camere per tipo + range date
CREATE OR REPLACE FUNCTION get_availability(
    p_property_id UUID,
    p_room_type_id UUID,
    p_check_in DATE,
    p_check_out DATE
) RETURNS INTEGER AS $$
DECLARE
    total_eligible INTEGER;
    unavailable_count INTEGER;
BEGIN
    SELECT COUNT(DISTINCT rta.room_id) INTO total_eligible
    FROM room_type_assignments rta
    JOIN rooms r ON r.id = rta.room_id
    WHERE rta.room_type_id = p_room_type_id
      AND rta.is_active = TRUE
      AND r.property_id = p_property_id
      AND r.status NOT IN ('Maintenance', 'OutOfOrder');

    SELECT COUNT(DISTINCT rta.room_id) INTO unavailable_count
    FROM room_type_assignments rta
    JOIN rooms r ON r.id = rta.room_id
    WHERE rta.room_type_id = p_room_type_id
      AND rta.is_active = TRUE
      AND r.property_id = p_property_id
      AND r.status NOT IN ('Maintenance', 'OutOfOrder')
      AND (
          EXISTS (
              SELECT 1 FROM bookings b
              WHERE b.room_id = rta.room_id
                AND b.status IN ('Confirmed', 'CheckedIn')
                AND b.check_in < p_check_out
                AND b.check_out > p_check_in
          )
          OR
          EXISTS (
              SELECT 1 FROM room_blocks rb
              WHERE rb.room_id = rta.room_id
                AND rb.start_date < p_check_out
                AND rb.end_date >= p_check_in
          )
      );

    RETURN GREATEST(total_eligible - unavailable_count, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Best room per tipo + range date
CREATE OR REPLACE FUNCTION find_best_room(
    p_property_id UUID,
    p_room_type_id UUID,
    p_check_in DATE,
    p_check_out DATE
) RETURNS UUID AS $$
DECLARE
    result_room_id UUID;
BEGIN
    SELECT rta.room_id INTO result_room_id
    FROM room_type_assignments rta
    JOIN rooms r ON r.id = rta.room_id
    WHERE rta.room_type_id = p_room_type_id
      AND rta.is_active = TRUE
      AND r.property_id = p_property_id
      AND r.status NOT IN ('Maintenance', 'OutOfOrder')
      AND NOT EXISTS (
          SELECT 1 FROM bookings b
          WHERE b.room_id = rta.room_id
            AND b.status IN ('Confirmed', 'CheckedIn')
            AND b.check_in < p_check_out
            AND b.check_out > p_check_in
      )
      AND NOT EXISTS (
          SELECT 1 FROM room_blocks rb
          WHERE rb.room_id = rta.room_id
            AND rb.start_date < p_check_out
            AND rb.end_date >= p_check_in
      )
    ORDER BY rta.priority ASC, r.sort_order ASC
    LIMIT 1;

    RETURN result_room_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Task completion → cleaning_status = Clean
CREATE OR REPLACE FUNCTION on_task_completed()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'Completed' AND OLD.status != 'Completed'
       AND NEW.room_id IS NOT NULL
       AND NEW.type IN ('CleaningCheckout', 'CleaningStayover', 'CleaningDeep') THEN
        UPDATE public.rooms SET cleaning_status = 'Clean' WHERE id = NEW.room_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Generazione codice accesso ospite al check-in (Guest Portal)
CREATE OR REPLACE FUNCTION generate_guest_access_code()
RETURNS TRIGGER AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- esclusi O/0/I/1/L
    code  TEXT := '';
    i INT;
BEGIN
    IF NEW.status = 'CheckedIn' AND (OLD.status IS DISTINCT FROM 'CheckedIn') THEN
        IF NEW.guest_access_code IS NULL THEN
            FOR i IN 1..6 LOOP
                code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
            END LOOP;
            NEW.guest_access_code := code;
            NEW.guest_code_generated_at := NOW();
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────────────────────────────────────
-- update_guest_stats — VERSIONE FINALE da fix_auto_checkout_and_loyalty.sql
-- (sostituisce la versione plpgsql con soglie 4/10/20 di fix_guest_stats.sql)
-- Soglie loyalty: Bronze ≥1, Silver ≥3, Gold ≥5, Platinum ≥10
-- ────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS update_guest_stats(UUID) CASCADE;
CREATE OR REPLACE FUNCTION update_guest_stats(p_guest_id UUID)
RETURNS VOID
LANGUAGE sql AS $FN$
    UPDATE guests
    SET
        total_stays   = stats.stays,
        total_revenue = stats.revenue,
        loyalty_level = CASE
            WHEN stats.stays >= 10 THEN 'Platinum'
            WHEN stats.stays >= 5  THEN 'Gold'
            WHEN stats.stays >= 3  THEN 'Silver'
            WHEN stats.stays >= 1  THEN 'Bronze'
            ELSE 'Standard'
        END,
        updated_at = NOW()
    FROM (
        SELECT
            COUNT(*)::INTEGER                        AS stays,
            COALESCE(SUM(total_amount), 0)::DECIMAL  AS revenue
        FROM bookings
        WHERE guest_id = p_guest_id
          AND status = 'CheckedOut'
    ) AS stats
    WHERE guests.id = p_guest_id;
$FN$;

-- Trigger function: aggiorna stats ospite a ogni cambio booking
CREATE OR REPLACE FUNCTION trg_booking_update_guest_stats()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM update_guest_stats(NEW.guest_id);
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.guest_id IS DISTINCT FROM NEW.guest_id THEN
            PERFORM update_guest_stats(OLD.guest_id);
        END IF;
        PERFORM update_guest_stats(NEW.guest_id);
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM update_guest_stats(OLD.guest_id);
    END IF;
    RETURN NEW;
END;
$$;

-- Auto-checkout di prenotazioni stale (da fix_auto_checkout_and_loyalty.sql)
DROP FUNCTION IF EXISTS sweep_stale_checkins() CASCADE;
CREATE OR REPLACE FUNCTION sweep_stale_checkins()
RETURNS INTEGER
LANGUAGE plpgsql AS $FN$
DECLARE
    affected INTEGER := 0;
BEGIN
    UPDATE rooms
    SET
        status          = CASE WHEN rooms.status = 'Occupied' THEN 'Available' ELSE rooms.status END,
        cleaning_status = 'Dirty',
        updated_at      = NOW()
    WHERE rooms.id IN (
        SELECT b.room_id FROM bookings b
        WHERE b.status = 'CheckedIn'
          AND b.check_out < CURRENT_DATE
          AND b.room_id IS NOT NULL
    );

    UPDATE bookings
    SET
        status         = 'CheckedOut',
        checked_out_at = COALESCE(bookings.checked_out_at, bookings.check_out::timestamp + INTERVAL '11 hours'),
        updated_at     = NOW()
    WHERE bookings.status = 'CheckedIn'
      AND bookings.check_out < CURRENT_DATE;

    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN affected;
END;
$FN$;

GRANT EXECUTE ON FUNCTION sweep_stale_checkins() TO authenticated;


-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auth signup → profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Bookings
DROP TRIGGER IF EXISTS set_booking_number ON bookings;
CREATE TRIGGER set_booking_number
    BEFORE INSERT ON bookings
    FOR EACH ROW EXECUTE FUNCTION generate_booking_number();

DROP TRIGGER IF EXISTS on_booking_created_create_folio ON bookings;
CREATE TRIGGER on_booking_created_create_folio
    AFTER INSERT ON bookings
    FOR EACH ROW EXECUTE FUNCTION auto_create_folio();

DROP TRIGGER IF EXISTS check_double_booking ON bookings;
CREATE TRIGGER check_double_booking
    BEFORE INSERT OR UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION prevent_double_booking();

DROP TRIGGER IF EXISTS on_booking_checkout ON bookings;
CREATE TRIGGER on_booking_checkout
    AFTER UPDATE OF status ON bookings
    FOR EACH ROW EXECUTE FUNCTION on_checkout_create_task();

DROP TRIGGER IF EXISTS on_booking_status_change_update_room ON bookings;
CREATE TRIGGER on_booking_status_change_update_room
    AFTER UPDATE OF status ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_room_on_booking_status();

DROP TRIGGER IF EXISTS set_booking_timestamps ON bookings;
CREATE TRIGGER set_booking_timestamps
    BEFORE UPDATE OF status ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_booking_timestamps();

DROP TRIGGER IF EXISTS trg_guest_access_code ON bookings;
CREATE TRIGGER trg_guest_access_code
    BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION generate_guest_access_code();

DROP TRIGGER IF EXISTS trg_bookings_guest_stats ON bookings;
CREATE TRIGGER trg_bookings_guest_stats
    AFTER INSERT OR UPDATE OF status, guest_id, total_amount OR DELETE
    ON bookings
    FOR EACH ROW EXECUTE FUNCTION trg_booking_update_guest_stats();

-- Tasks
DROP TRIGGER IF EXISTS on_task_status_change ON tasks;
CREATE TRIGGER on_task_status_change
    AFTER UPDATE OF status ON tasks
    FOR EACH ROW EXECUTE FUNCTION on_task_completed();

-- updated_at triggers (idempotenti)
DROP TRIGGER IF EXISTS set_updated_at ON profiles;          CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON properties;        CREATE TRIGGER set_updated_at BEFORE UPDATE ON properties        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON room_types;        CREATE TRIGGER set_updated_at BEFORE UPDATE ON room_types        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON rooms;             CREATE TRIGGER set_updated_at BEFORE UPDATE ON rooms             FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON bookings;          CREATE TRIGGER set_updated_at BEFORE UPDATE ON bookings          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON folios;            CREATE TRIGGER set_updated_at BEFORE UPDATE ON folios            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON guests;            CREATE TRIGGER set_updated_at BEFORE UPDATE ON guests            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON expenses;          CREATE TRIGGER set_updated_at BEFORE UPDATE ON expenses          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON tasks;             CREATE TRIGGER set_updated_at BEFORE UPDATE ON tasks             FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON daily_rates;       CREATE TRIGGER set_updated_at BEFORE UPDATE ON daily_rates       FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_booking_guests ON booking_guests;
CREATE TRIGGER set_updated_at_booking_guests BEFORE UPDATE ON booking_guests FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- PROFILES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_read_own_property" ON profiles;
CREATE POLICY "users_read_own_property" ON profiles
    FOR SELECT USING (property_id = get_user_property_id() OR id = auth.uid());
DROP POLICY IF EXISTS "managers_manage" ON profiles;
CREATE POLICY "managers_manage" ON profiles
    FOR ALL USING (property_id = get_user_property_id() AND get_user_role() = 'Manager');
DROP POLICY IF EXISTS "users_update_own" ON profiles;
CREATE POLICY "users_update_own" ON profiles
    FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- PROPERTIES
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_read_own_property" ON properties;
CREATE POLICY "users_read_own_property" ON properties
    FOR SELECT USING (id = get_user_property_id());
DROP POLICY IF EXISTS "managers_manage" ON properties;
CREATE POLICY "managers_manage" ON properties
    FOR ALL USING (id = get_user_property_id() AND get_user_role() = 'Manager');

-- ROOM TYPES
ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read" ON room_types;
CREATE POLICY "authenticated_read" ON room_types
    FOR SELECT USING (property_id = get_user_property_id());
DROP POLICY IF EXISTS "managers_manage" ON room_types;
CREATE POLICY "managers_manage" ON room_types
    FOR ALL USING (property_id = get_user_property_id() AND get_user_role() = 'Manager');

-- ROOMS
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read" ON rooms;
CREATE POLICY "authenticated_read" ON rooms
    FOR SELECT USING (property_id = get_user_property_id());
DROP POLICY IF EXISTS "managers_manage" ON rooms;
CREATE POLICY "managers_manage" ON rooms
    FOR ALL USING (property_id = get_user_property_id() AND get_user_role() = 'Manager');
DROP POLICY IF EXISTS "staff_update_cleaning" ON rooms;
CREATE POLICY "staff_update_cleaning" ON rooms
    FOR UPDATE USING (property_id = get_user_property_id() AND get_user_role() IN ('Reception', 'Housekeeping'));

-- ROOM TYPE ASSIGNMENTS
ALTER TABLE room_type_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read" ON room_type_assignments;
CREATE POLICY "authenticated_read" ON room_type_assignments
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM rooms r WHERE r.id = room_type_assignments.room_id AND r.property_id = get_user_property_id())
    );
DROP POLICY IF EXISTS "managers_manage" ON room_type_assignments;
CREATE POLICY "managers_manage" ON room_type_assignments
    FOR ALL USING (
        EXISTS (SELECT 1 FROM rooms r WHERE r.id = room_type_assignments.room_id AND r.property_id = get_user_property_id())
        AND get_user_role() = 'Manager'
    );

-- BOOKING CHANNELS
ALTER TABLE booking_channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read" ON booking_channels;
CREATE POLICY "authenticated_read" ON booking_channels
    FOR SELECT USING (property_id = get_user_property_id());
DROP POLICY IF EXISTS "managers_manage" ON booking_channels;
CREATE POLICY "managers_manage" ON booking_channels
    FOR ALL USING (property_id = get_user_property_id() AND get_user_role() = 'Manager');

-- GUESTS
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "main_staff_read" ON guests;
CREATE POLICY "main_staff_read" ON guests
    FOR SELECT USING (property_id = get_user_property_id() AND get_user_role() IN ('Manager', 'Reception'));
DROP POLICY IF EXISTS "main_staff_insert" ON guests;
CREATE POLICY "main_staff_insert" ON guests
    FOR INSERT WITH CHECK (property_id = get_user_property_id() AND get_user_role() IN ('Manager', 'Reception'));
DROP POLICY IF EXISTS "main_staff_update" ON guests;
CREATE POLICY "main_staff_update" ON guests
    FOR UPDATE USING (property_id = get_user_property_id() AND get_user_role() IN ('Manager', 'Reception'));
DROP POLICY IF EXISTS "managers_delete" ON guests;
CREATE POLICY "managers_delete" ON guests
    FOR DELETE USING (property_id = get_user_property_id() AND get_user_role() = 'Manager');

-- BOOKINGS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "main_staff_read" ON bookings;
CREATE POLICY "main_staff_read" ON bookings
    FOR SELECT USING (property_id = get_user_property_id() AND get_user_role() IN ('Manager', 'Reception'));
DROP POLICY IF EXISTS "housekeeping_read" ON bookings;
CREATE POLICY "housekeeping_read" ON bookings
    FOR SELECT USING (property_id = get_user_property_id() AND get_user_role() = 'Housekeeping');
DROP POLICY IF EXISTS "main_staff_insert" ON bookings;
CREATE POLICY "main_staff_insert" ON bookings
    FOR INSERT WITH CHECK (property_id = get_user_property_id() AND get_user_role() IN ('Manager', 'Reception'));
DROP POLICY IF EXISTS "main_staff_update" ON bookings;
CREATE POLICY "main_staff_update" ON bookings
    FOR UPDATE USING (property_id = get_user_property_id() AND get_user_role() IN ('Manager', 'Reception'));
DROP POLICY IF EXISTS "managers_delete" ON bookings;
CREATE POLICY "managers_delete" ON bookings
    FOR DELETE USING (property_id = get_user_property_id() AND get_user_role() = 'Manager');

-- DAILY RATES
ALTER TABLE daily_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read" ON daily_rates;
CREATE POLICY "authenticated_read" ON daily_rates
    FOR SELECT USING (property_id = get_user_property_id());
DROP POLICY IF EXISTS "managers_manage" ON daily_rates;
CREATE POLICY "managers_manage" ON daily_rates
    FOR ALL USING (property_id = get_user_property_id() AND get_user_role() = 'Manager');

-- ROOM BLOCKS
ALTER TABLE room_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read" ON room_blocks;
CREATE POLICY "authenticated_read" ON room_blocks
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM rooms r WHERE r.id = room_blocks.room_id AND r.property_id = get_user_property_id())
    );
DROP POLICY IF EXISTS "main_staff_manage" ON room_blocks;
CREATE POLICY "main_staff_manage" ON room_blocks
    FOR ALL USING (
        EXISTS (SELECT 1 FROM rooms r WHERE r.id = room_blocks.room_id AND r.property_id = get_user_property_id())
        AND get_user_role() IN ('Manager', 'Reception')
    );

-- FOLIOS
ALTER TABLE folios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "main_staff_read" ON folios;
CREATE POLICY "main_staff_read" ON folios
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM bookings b WHERE b.id = folios.booking_id AND b.property_id = get_user_property_id())
        AND get_user_role() IN ('Manager', 'Reception')
    );
DROP POLICY IF EXISTS "main_staff_manage" ON folios;
CREATE POLICY "main_staff_manage" ON folios
    FOR ALL USING (
        EXISTS (SELECT 1 FROM bookings b WHERE b.id = folios.booking_id AND b.property_id = get_user_property_id())
        AND get_user_role() IN ('Manager', 'Reception')
    );

-- INVOICE ITEMS
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "main_staff_read" ON invoice_items;
CREATE POLICY "main_staff_read" ON invoice_items
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM folios f JOIN bookings b ON b.id = f.booking_id
                WHERE f.id = invoice_items.folio_id AND b.property_id = get_user_property_id())
        AND get_user_role() IN ('Manager', 'Reception')
    );
DROP POLICY IF EXISTS "main_staff_manage" ON invoice_items;
CREATE POLICY "main_staff_manage" ON invoice_items
    FOR ALL USING (
        EXISTS (SELECT 1 FROM folios f JOIN bookings b ON b.id = f.booking_id
                WHERE f.id = invoice_items.folio_id AND b.property_id = get_user_property_id())
        AND get_user_role() IN ('Manager', 'Reception')
    );

-- TRANSACTIONS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "main_staff_read" ON transactions;
CREATE POLICY "main_staff_read" ON transactions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM folios f JOIN bookings b ON b.id = f.booking_id
                WHERE f.id = transactions.folio_id AND b.property_id = get_user_property_id())
        AND get_user_role() IN ('Manager', 'Reception')
    );
DROP POLICY IF EXISTS "main_staff_insert" ON transactions;
CREATE POLICY "main_staff_insert" ON transactions
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM folios f JOIN bookings b ON b.id = f.booking_id
                WHERE f.id = transactions.folio_id AND b.property_id = get_user_property_id())
        AND get_user_role() IN ('Manager', 'Reception')
    );
DROP POLICY IF EXISTS "managers_manage" ON transactions;
CREATE POLICY "managers_manage" ON transactions
    FOR ALL USING (
        EXISTS (SELECT 1 FROM folios f JOIN bookings b ON b.id = f.booking_id
                WHERE f.id = transactions.folio_id AND b.property_id = get_user_property_id())
        AND get_user_role() = 'Manager'
    );

-- EXPENSE CATEGORIES
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read" ON expense_categories;
CREATE POLICY "authenticated_read" ON expense_categories
    FOR SELECT USING (property_id = get_user_property_id());
DROP POLICY IF EXISTS "managers_manage" ON expense_categories;
CREATE POLICY "managers_manage" ON expense_categories
    FOR ALL USING (property_id = get_user_property_id() AND get_user_role() = 'Manager');

-- EXPENSES
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "main_staff_read" ON expenses;
CREATE POLICY "main_staff_read" ON expenses
    FOR SELECT USING (property_id = get_user_property_id() AND get_user_role() IN ('Manager', 'Reception'));
DROP POLICY IF EXISTS "main_staff_insert" ON expenses;
CREATE POLICY "main_staff_insert" ON expenses
    FOR INSERT WITH CHECK (property_id = get_user_property_id() AND get_user_role() IN ('Manager', 'Reception'));
DROP POLICY IF EXISTS "managers_manage" ON expenses;
CREATE POLICY "managers_manage" ON expenses
    FOR ALL USING (property_id = get_user_property_id() AND get_user_role() = 'Manager');

-- TASKS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "managers_manage" ON tasks;
CREATE POLICY "managers_manage" ON tasks
    FOR ALL USING (property_id = get_user_property_id() AND get_user_role() = 'Manager');
DROP POLICY IF EXISTS "reception_read" ON tasks;
CREATE POLICY "reception_read" ON tasks
    FOR SELECT USING (property_id = get_user_property_id() AND get_user_role() = 'Reception');
DROP POLICY IF EXISTS "reception_insert" ON tasks;
CREATE POLICY "reception_insert" ON tasks
    FOR INSERT WITH CHECK (property_id = get_user_property_id() AND get_user_role() = 'Reception');
DROP POLICY IF EXISTS "reception_update" ON tasks;
CREATE POLICY "reception_update" ON tasks
    FOR UPDATE USING (property_id = get_user_property_id() AND get_user_role() = 'Reception');
DROP POLICY IF EXISTS "portal_staff_read_own" ON tasks;
CREATE POLICY "portal_staff_read_own" ON tasks
    FOR SELECT USING (
        property_id = get_user_property_id()
        AND get_user_role() IN ('Housekeeping', 'Maintenance')
        AND (assigned_to = auth.uid() OR assigned_to IS NULL)
    );
DROP POLICY IF EXISTS "portal_staff_update_own" ON tasks;
CREATE POLICY "portal_staff_update_own" ON tasks
    FOR UPDATE USING (
        property_id = get_user_property_id()
        AND get_user_role() IN ('Housekeeping', 'Maintenance')
        AND assigned_to = auth.uid()
    );

-- COMPETITOR STRUCTURES
ALTER TABLE competitor_structures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "main_staff_read" ON competitor_structures;
CREATE POLICY "main_staff_read" ON competitor_structures
    FOR SELECT USING (property_id = get_user_property_id() AND get_user_role() IN ('Manager', 'Reception'));
DROP POLICY IF EXISTS "managers_manage" ON competitor_structures;
CREATE POLICY "managers_manage" ON competitor_structures
    FOR ALL USING (property_id = get_user_property_id() AND get_user_role() = 'Manager');

-- COMPETITOR PRICES
ALTER TABLE competitor_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "main_staff_read" ON competitor_prices;
CREATE POLICY "main_staff_read" ON competitor_prices
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM competitor_structures cs WHERE cs.id = competitor_prices.competitor_id AND cs.property_id = get_user_property_id())
        AND get_user_role() IN ('Manager', 'Reception')
    );
DROP POLICY IF EXISTS "managers_manage" ON competitor_prices;
CREATE POLICY "managers_manage" ON competitor_prices
    FOR ALL USING (
        EXISTS (SELECT 1 FROM competitor_structures cs WHERE cs.id = competitor_prices.competitor_id AND cs.property_id = get_user_property_id())
        AND get_user_role() = 'Manager'
    );

-- ACTIVITY LOG
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "main_staff_read" ON activity_log;
CREATE POLICY "main_staff_read" ON activity_log
    FOR SELECT USING (property_id = get_user_property_id() AND get_user_role() IN ('Manager', 'Reception'));
DROP POLICY IF EXISTS "system_insert" ON activity_log;
CREATE POLICY "system_insert" ON activity_log
    FOR INSERT WITH CHECK (property_id = get_user_property_id());

-- BOOKING_GUESTS
ALTER TABLE booking_guests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_booking_guests" ON booking_guests;
CREATE POLICY "authenticated_read_booking_guests" ON booking_guests
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_guests.booking_id AND b.property_id = get_user_property_id())
    );
DROP POLICY IF EXISTS "manager_reception_manage_booking_guests" ON booking_guests;
CREATE POLICY "manager_reception_manage_booking_guests" ON booking_guests
    FOR ALL USING (
        EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_guests.booking_id AND b.property_id = get_user_property_id())
        AND get_user_role() IN ('Manager', 'Reception')
    );

-- ALLOGGIATI_SUBMISSIONS
ALTER TABLE alloggiati_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_alloggiati_submissions" ON alloggiati_submissions;
CREATE POLICY "authenticated_read_alloggiati_submissions" ON alloggiati_submissions
    FOR SELECT USING (property_id = get_user_property_id());
DROP POLICY IF EXISTS "manager_reception_manage_alloggiati_submissions" ON alloggiati_submissions;
CREATE POLICY "manager_reception_manage_alloggiati_submissions" ON alloggiati_submissions
    FOR ALL USING (property_id = get_user_property_id() AND get_user_role() IN ('Manager', 'Reception'));

-- ISTAT_SUBMISSIONS
ALTER TABLE istat_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_istat_submissions" ON istat_submissions;
CREATE POLICY "authenticated_read_istat_submissions" ON istat_submissions
    FOR SELECT USING (property_id = get_user_property_id());
DROP POLICY IF EXISTS "manager_reception_manage_istat_submissions" ON istat_submissions;
CREATE POLICY "manager_reception_manage_istat_submissions" ON istat_submissions
    FOR ALL USING (property_id = get_user_property_id() AND get_user_role() IN ('Manager', 'Reception'));

-- PORTAL_SERVICES
ALTER TABLE portal_services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS portal_services_staff ON portal_services;
CREATE POLICY portal_services_staff ON portal_services
    FOR ALL TO authenticated
    USING (property_id IN (SELECT property_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (property_id IN (SELECT property_id FROM profiles WHERE id = auth.uid()));
DROP POLICY IF EXISTS portal_services_anon ON portal_services;
CREATE POLICY portal_services_anon ON portal_services
    FOR SELECT TO anon USING (is_active = true);

-- PORTAL_ATTRACTIONS
ALTER TABLE portal_attractions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS portal_attractions_staff ON portal_attractions;
CREATE POLICY portal_attractions_staff ON portal_attractions
    FOR ALL TO authenticated
    USING (property_id IN (SELECT property_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (property_id IN (SELECT property_id FROM profiles WHERE id = auth.uid()));
DROP POLICY IF EXISTS portal_attractions_anon ON portal_attractions;
CREATE POLICY portal_attractions_anon ON portal_attractions
    FOR SELECT TO anon USING (is_active = true);

-- ICAL_SUBSCRIPTIONS
ALTER TABLE ical_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ical_subscriptions_staff ON ical_subscriptions;
CREATE POLICY ical_subscriptions_staff ON ical_subscriptions
    FOR ALL TO authenticated
    USING (property_id IN (SELECT property_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (property_id IN (SELECT property_id FROM profiles WHERE id = auth.uid()));

-- ICAL_SYNC_LOG
ALTER TABLE ical_sync_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ical_sync_log_staff ON ical_sync_log;
CREATE POLICY ical_sync_log_staff ON ical_sync_log
    FOR ALL TO authenticated
    USING (subscription_id IN (
        SELECT id FROM ical_subscriptions
        WHERE property_id IN (SELECT property_id FROM profiles WHERE id = auth.uid())
    ));


-- ============================================================================
-- ONE-SHOT REALIGNMENT (da fix_rooms_status.sql + fix_auto_checkout/loyalty)
-- ----------------------------------------------------------------------------
-- Riesecuzione idempotente: si limita a riallineare lo stato attuale di
-- camere e ospiti rispetto ai dati booking. Su un DB vuoto è no-op.
-- ============================================================================

DO $$
DECLARE
    today DATE := CURRENT_DATE;
    r RECORD;
    v_is_occupied   BOOLEAN;
    v_last_checkout DATE;
    v_last_clean_ts TIMESTAMPTZ;
    v_new_status    room_status;
    v_new_cleaning  cleaning_status;
BEGIN
    FOR r IN SELECT id, name, status FROM rooms LOOP
        SELECT EXISTS (
            SELECT 1 FROM bookings
            WHERE room_id = r.id AND status = 'CheckedIn'
        ) INTO v_is_occupied;

        IF r.status IN ('Maintenance', 'OutOfOrder') THEN
            v_new_status := r.status::room_status;
        ELSIF v_is_occupied THEN
            v_new_status := 'Occupied'::room_status;
        ELSE
            v_new_status := 'Available'::room_status;
        END IF;

        IF v_is_occupied THEN
            v_new_cleaning := 'Clean'::cleaning_status;
        ELSE
            SELECT MAX(check_out)   INTO v_last_checkout
                FROM bookings
                WHERE room_id = r.id AND status = 'CheckedOut' AND check_out <= today;

            SELECT MAX(completed_at) INTO v_last_clean_ts
                FROM tasks
                WHERE room_id = r.id
                  AND type IN ('CleaningCheckout', 'CleaningDeep')
                  AND status = 'Completed';

            IF v_last_checkout IS NULL THEN
                v_new_cleaning := 'Clean'::cleaning_status;
            ELSIF v_last_clean_ts IS NULL THEN
                v_new_cleaning := 'Dirty'::cleaning_status;
            ELSIF v_last_checkout > v_last_clean_ts::DATE THEN
                v_new_cleaning := 'Dirty'::cleaning_status;
            ELSE
                v_new_cleaning := 'Clean'::cleaning_status;
            END IF;
        END IF;

        UPDATE rooms
            SET status = v_new_status,
                cleaning_status = v_new_cleaning,
                updated_at = NOW()
            WHERE id = r.id;
    END LOOP;
END $$;

-- Refresh stats per tutti gli ospiti esistenti (no-op su DB vuoto)
DO $$
DECLARE g RECORD;
BEGIN
    FOR g IN SELECT id FROM guests LOOP
        PERFORM update_guest_stats(g.id);
    END LOOP;
END $$;


-- ============================================================================
-- SEED DATA (opzionale)
-- ----------------------------------------------------------------------------
-- La migration 00000000000003_seed.sql dell'app NON contiene dati: solo un
-- commento che spiega che properties, channels e categories vengono creati
-- via server action `setup-property` alla creazione della prima property
-- tramite Supabase Auth. Niente da inserire qui.
-- ============================================================================
-- (vuoto intenzionalmente)
