-- ============================================================
-- ImpoundGuard database schema
--
-- Source: a teammate's design against roadworthy_certificates.csv
-- (32 vehicles). Extended here into the schema the running app
-- actually reads from.
--
-- Changes from the original draft, and why:
--   * daily_revenue / passenger_load are now populated. They were
--     DEFAULT 0 and unseeded, which zeroed the original risk engine.
--   * document_type is lower-case 'roadworthy' to match the value
--     api/scan.js returns from the vision model.
--   * updated_at now actually updates, via a trigger. As drafted it
--     was frozen at insert time.
--   * holder_name seeded from the driver, since it is the field the
--     POPIA position is about and null would have hidden it.
--   * routes + vehicles.route_id added for the maintenance scheduler
--     (see below) — this is the pivot away from a safety weighting
--     and toward operational substitutability.
--
-- Apply with:  psql "$DATABASE_URL" -f db/schema.sql
-- Safe to re-run: it drops and recreates.
-- ============================================================

DROP TRIGGER IF EXISTS trg_documents_updated_at ON documents;
DROP FUNCTION IF EXISTS set_updated_at();
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS routes CASCADE;

-- routes precedes vehicles because vehicles.route_id references it.
-- A route with no vehicle pointing at it just never gets scheduled
-- against, so there is nothing to keep in sync in the other direction.
CREATE TABLE routes (
    route_id       SERIAL PRIMARY KEY,
    route_code     VARCHAR(20)  UNIQUE NOT NULL,
    route_name     VARCHAR(150) NOT NULL,
    required_type  VARCHAR(50)  NOT NULL,  -- must match vehicles.vehicle_type
    min_capacity   INTEGER      NOT NULL DEFAULT 0,  -- seats a covering vehicle needs; 0 for freight
    daily_value    NUMERIC(10,2) NOT NULL DEFAULT 0, -- revenue this route earns per day
    active         BOOLEAN      NOT NULL DEFAULT TRUE,

    CONSTRAINT min_capacity_positive CHECK (min_capacity >= 0),
    CONSTRAINT daily_value_positive  CHECK (daily_value  >= 0)
);

CREATE TABLE vehicles (
    vehicle_id      SERIAL PRIMARY KEY,
    plate_number    VARCHAR(20)  UNIQUE NOT NULL,
    vehicle_name    VARCHAR(150) NOT NULL,       -- make & model
    vehicle_type    VARCHAR(50)  NOT NULL,       -- category
    vin             VARCHAR(30)  UNIQUE,
    driver_name     VARCHAR(100),
    daily_revenue   NUMERIC(10,2) NOT NULL DEFAULT 0,
    passenger_load  INTEGER       NOT NULL DEFAULT 0,
    -- NULL = this vehicle is a reserve/spare, not assigned to a route.
    -- That is the entire source of slack the scheduler can draw on — a
    -- fleet with no NULLs here has no genuine backfill capacity at all,
    -- whatever the marketing copy claims.
    route_id        INTEGER REFERENCES routes(route_id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT passenger_load_positive CHECK (passenger_load >= 0),
    CONSTRAINT daily_revenue_positive  CHECK (daily_revenue  >= 0)
);

CREATE TABLE documents (
    document_id     SERIAL PRIMARY KEY,
    vehicle_id      INTEGER      NOT NULL,
    document_type   VARCHAR(50)  NOT NULL,
    holder_name     VARCHAR(100),
    issue_date      DATE,
    expiry_date     DATE         NOT NULL,
    document_number VARCHAR(100) UNIQUE,
    verified        BOOLEAN      NOT NULL DEFAULT TRUE,
    image_url       TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT fk_vehicle
        FOREIGN KEY (vehicle_id)
        REFERENCES vehicles(vehicle_id)
        ON DELETE CASCADE
);

-- Indexes -----------------------------------------------------
-- Access patterns: plate lookup on scan, documents-by-vehicle on
-- fleet load, expiry ordering for the naive/expiry ranking mode, and
-- "find a spare of this type" for the scheduler (route_id IS NULL).

CREATE INDEX idx_vehicle_plate    ON vehicles(plate_number);
CREATE INDEX idx_vehicle_route    ON vehicles(route_id);
CREATE INDEX idx_document_vehicle ON documents(vehicle_id);
CREATE INDEX idx_document_expiry  ON documents(expiry_date);

-- updated_at maintenance --------------------------------------

CREATE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed: routes --------------------------------------------------
--
-- One route per vehicle that carries one, chosen so each type has a
-- deliberately different reserve ratio (see below). daily_value
-- matches what the assigned vehicle currently earns, so a route
-- going uncovered and that vehicle's own daily_revenue tell the same
-- story from two directions.

INSERT INTO routes (route_code, route_name, required_type, min_capacity, daily_value) VALUES
-- Trucks: 6 routes, 2 spares (JN 42 BK GP, CA 593-102) — comfortably covered.
('RT-001', 'Cape Town-George coastal freight',        'Heavy Goods Vehicle (Truck)', 0, 4200),
('RT-002', 'Durban-Johannesburg N3 freight',          'Heavy Goods Vehicle (Truck)', 0, 5100),
('RT-003', 'Johannesburg-Polokwane freight',          'Heavy Goods Vehicle (Truck)', 0, 4800),
('RT-004', 'Cape Town-Paarl freight',                 'Heavy Goods Vehicle (Truck)', 0, 3600),
('RT-005', 'Port Elizabeth-East London freight',      'Heavy Goods Vehicle (Truck)', 0, 4500),
('RT-006', 'Durban-Pietermaritzburg freight',         'Heavy Goods Vehicle (Truck)', 0, 5300),
-- Courier vans: 5 routes, 3 spares — comfortably covered.
('RT-007', 'Sandton CBD parcel run',                  'Courier Van (LCV)', 0, 2100),
('RT-008', 'Durban Central parcel run',                'Courier Van (LCV)', 0, 2400),
('RT-009', 'Cape Town Southern Suburbs parcel run',   'Courier Van (LCV)', 0, 2200),
('RT-010', 'Bellville parcel run',                    'Courier Van (LCV)', 0, 1900),
('RT-011', 'Pretoria East parcel run',                'Courier Van (LCV)', 0, 2500),
-- Midibus taxis: 7 routes, 1 spare (16-seat CA 702-811) — thin. Only the
-- two 16-seat routes below are coverable; the 21/22-seat routes are not.
('RT-012', 'Soweto-Johannesburg CBD commuter loop',   'Midibus Taxi', 16, 1800),
('RT-013', 'Umlazi-Durban CBD commuter loop',         'Midibus Taxi', 16, 1750),
('RT-014', 'Khayelitsha-Cape Town CBD commuter loop', 'Midibus Taxi', 22, 2000),
('RT-015', 'Mamelodi-Pretoria CBD commuter loop',     'Midibus Taxi', 22, 1950),
('RT-016', 'KwaMashu-Durban CBD commuter loop',       'Midibus Taxi', 21, 1900),
('RT-017', 'Alexandra-Sandton commuter loop',         'Midibus Taxi', 22, 2050),
('RT-018', 'Mitchells Plain-Cape Town CBD commuter loop', 'Midibus Taxi', 22, 1850),
-- Buses: 8 routes, ZERO spares — every bus route is uncoverable by
-- construction. RT-022 is the demo scan target (CA 449-102, 65 seats):
-- top of the risk ranking AND the one job the scheduler cannot cover.
('RT-019', 'Johannesburg inner-city commuter bus route',        'Heavy Passenger Vehicle (Bus)', 60, 3200),
('RT-020', 'Durban beachfront commuter bus route',               'Heavy Passenger Vehicle (Bus)', 55, 3400),
('RT-021', 'Cape Town CBD commuter bus route',                   'Heavy Passenger Vehicle (Bus)', 58, 3600),
('RT-022', 'N2 Cape Town-Somerset West commuter bus route',     'Heavy Passenger Vehicle (Bus)', 65, 3800),
('RT-023', 'Tshwane inner-city commuter bus route',              'Heavy Passenger Vehicle (Bus)', 35, 2400),
('RT-024', 'eThekwini metro commuter bus route',                 'Heavy Passenger Vehicle (Bus)', 62, 3100),
('RT-025', 'Ekurhuleni commuter bus route',                      'Heavy Passenger Vehicle (Bus)', 49, 4100),
('RT-026', 'Nelson Mandela Bay commuter bus route',              'Heavy Passenger Vehicle (Bus)', 51, 3500);

-- Seed: vehicles ----------------------------------------------
--
-- daily_revenue and passenger_load are estimates, not measured
-- figures, chosen to be plausible for a South African operator.
-- route_id is NULL for the 6 vehicles held as spares; the reserve
-- ratio is deliberately uneven by type (trucks/vans well covered,
-- taxis thin, buses at zero) so the scheduler has something real to
-- say about which categories are actually substitutable.

INSERT INTO vehicles
    (plate_number, vehicle_name, vehicle_type, vin, driver_name, daily_revenue, passenger_load, route_id)
VALUES
('DK 84 PT GP', 'Isuzu FX-Series 26-360 6x4 Freight Carrier',   'Heavy Goods Vehicle (Truck)',  'JALFX360M00184920', 'S. Ndlovu',    4200, 0, (SELECT route_id FROM routes WHERE route_code='RT-001')),
('CAA 812-394', 'Mercedes-Benz Actros 2645 LS 6x4',             'Heavy Goods Vehicle (Truck)',  'WDB9634031L839201', 'M. Petersen',  5100, 0, (SELECT route_id FROM routes WHERE route_code='RT-002')),
('FT 39 LW GP', 'Volvo FH 440 6x4 Tractor',                     'Heavy Goods Vehicle (Truck)',  'YV2AG30C7LB921048', 'T. Abrahams',  4800, 0, (SELECT route_id FROM routes WHERE route_code='RT-003')),
('CA 948-201',  'Hino 500 Series 1627 Freight',                 'Heavy Goods Vehicle (Truck)',  'AHF1627M009483019', 'L. Daniels',   3600, 0, (SELECT route_id FROM routes WHERE route_code='RT-004')),
('HG 19 TR GP', 'MAN TGS 27.480 6x4 BL SA',                     'Heavy Goods Vehicle (Truck)',  'WMA23XZZ5KW094812', 'R. Isaacs',    4500, 0, (SELECT route_id FROM routes WHERE route_code='RT-005')),
('CAA 401-928', 'Scania G460 Streamline 6x4',                   'Heavy Goods Vehicle (Truck)',  'YS2G6X40002938102', 'D. van Wyk',   5300, 0, (SELECT route_id FROM routes WHERE route_code='RT-006')),
('JN 42 BK GP', 'UD Trucks Croner PKE 250',                     'Heavy Goods Vehicle (Truck)',  'NCVPKE25000392810', 'N. Fortuin',   3400, 0, NULL), -- spare
('CA 593-102',  'Fuso FJ 16-230 Rigid',                         'Heavy Goods Vehicle (Truck)',  'ME8FJ16230K093821', 'P. Mokoena',   3900, 0, NULL), -- spare
('KC 61 PR GP', 'Toyota HiAce 2.5 D-4D Panel Van',              'Courier Van (LCV)',            'AHTK22P0009284019', 'B. Nel',       2100, 0, (SELECT route_id FROM routes WHERE route_code='RT-007')),
('CAA 672-109', 'Mercedes-Benz Sprinter 314 CDI Panel Van',     'Courier Van (LCV)',            'W1V9076331N849201', 'K. Adams',     2400, 0, (SELECT route_id FROM routes WHERE route_code='RT-008')),
('LV 88 XM GP', 'Ford Transit 2.2 TDCi L2H2 Panel Van',         'Courier Van (LCV)',            'WF0XXXTTFXKP83920', 'J. Sithole',   2200, 0, (SELECT route_id FROM routes WHERE route_code='RT-009')),
('CA 391-721',  'Volkswagen Transporter 2.0 TDI Panel Van',     'Courier Van (LCV)',            'WV1ZZZ7JZPH039281', 'A. Booysen',   1900, 0, (SELECT route_id FROM routes WHERE route_code='RT-010')),
('MX 29 BZ GP', 'Hyundai H100 2.6D Bakkie with Canopy',         'Courier Van (LCV)',            'KMJFD17HPMA839201', 'C. Maree',     1600, 1, NULL), -- spare
('CAA 204-819', 'Nissan NV350 2.5 Impendulo Panel Van',         'Courier Van (LCV)',            'ADNFAAE15U0092841', 'F. Jacobs',    2000, 0, NULL), -- spare
('NP 55 TR GP', 'Peugeot Boxer 2.2 HDi Panel Van',              'Courier Van (LCV)',            'VF3Y3MCMFC1092840', 'G. Khoza',     2300, 0, NULL), -- spare
('CA 910-482',  'Renault Master 2.3 dCi Panel Van',             'Courier Van (LCV)',            'VF1MA000062948102', 'H. Barends',   2500, 0, (SELECT route_id FROM routes WHERE route_code='RT-011')),
('PJ 77 DC GP', 'Toyota Quantum 2.7 Ses''fikile 16-Seater',     'Midibus Taxi',                 'AHTE12P3009281049', 'B. Khumalo',   1800, 16, (SELECT route_id FROM routes WHERE route_code='RT-012')),
('CAA 519-302', 'Toyota Quantum 2.5 D-4D 16-Seater',            'Midibus Taxi',                 'AHTK12P0008392019', 'S. Dlamini',   1750, 16, (SELECT route_id FROM routes WHERE route_code='RT-013')),
('RK 12 MK GP', 'Mercedes-Benz Sprinter 516 CDI 22-Seater',     'Midibus Taxi',                 'W1V9066551N039281', 'M. Radebe',    2000, 22, (SELECT route_id FROM routes WHERE route_code='RT-014')),
('CA 702-811',  'Nissan NV350 Impendulo 16-Seater',             'Midibus Taxi',                 'ADNFAAE15U0109284', 'T. Nkosi',     1700, 16, NULL), -- spare (16-seat: covers RT-012/013 only)
('ST 33 NW GP', 'Iveco Daily 50C15 22-Seater Midibus',          'Midibus Taxi',                 'ZCFC50A1005928102', 'W. Mahlangu',  1950, 22, (SELECT route_id FROM routes WHERE route_code='RT-015')),
('CAA 941-023', 'Toyota Coaster 2.8D 21-Seater',                'Midibus Taxi',                 'JTEDR73T000928104', 'E. Molefe',    1900, 21, (SELECT route_id FROM routes WHERE route_code='RT-016')),
('VB 90 HY GP', 'Volkswagen Crafter 50 22-Seater',              'Midibus Taxi',                 'WV1ZZZ2EZH7039281', 'Z. Ngcobo',    2050, 22, (SELECT route_id FROM routes WHERE route_code='RT-017')),
('CA 831-502',  'Isipho Hino 300 614 22-Seater',                'Midibus Taxi',                 'AHF300M0009382019', 'V. Cele',      1850, 22, (SELECT route_id FROM routes WHERE route_code='RT-018')),
('WY 41 KL GP', 'Mercedes-Benz OF 1723 60-Seater Commuter Bus', 'Heavy Passenger Vehicle (Bus)','9BM384039L0928410', 'O. Mabaso',    3200, 60, (SELECT route_id FROM routes WHERE route_code='RT-019')),
('CAA 102-948', 'MAN RR2 19.360 Marcopolo Torino',              'Heavy Passenger Vehicle (Bus)','WMA19XZZ3MW039281', 'I. Pietersen', 3400, 55, (SELECT route_id FROM routes WHERE route_code='RT-020')),
('XZ 10 MM GP', 'Scania K360IB 4x2 Marcopolo G7',               'Heavy Passenger Vehicle (Bus)','YS2K4X20003928102', 'Q. Zwane',     3600, 58, (SELECT route_id FROM routes WHERE route_code='RT-021')),
('CA 449-102',  'Volvo B8R 4x2 Busmark 65-Seater',              'Heavy Passenger Vehicle (Bus)','YV3R8R201KB092841', 'L. Mthembu',   3800, 65, (SELECT route_id FROM routes WHERE route_code='RT-022')),
('YB 82 PT GP', 'Isuzu NQR 500 Busmark 35-Seater',              'Heavy Passenger Vehicle (Bus)','JALNQR500M0039281', 'U. Baloyi',    2400, 35, (SELECT route_id FROM routes WHERE route_code='RT-023')),
('CAA 339-182', 'Mercedes-Benz O 500 M 1830 City Bus',          'Heavy Passenger Vehicle (Bus)','9BM384102N0938201', 'Y. Nkomo',     3100, 62, (SELECT route_id FROM routes WHERE route_code='RT-024')),
('ZC 99 BR GP', 'Scania K410EB 6x2*4 Irizar i6',                'Heavy Passenger Vehicle (Bus)','YS2K6X20008392018', 'X. Mnguni',    4100, 49, (SELECT route_id FROM routes WHERE route_code='RT-025')),
('CA 192-803',  'MAN Lion''s Explorer 18.280',                  'Heavy Passenger Vehicle (Bus)','WMA18XZZ2KW092841', 'R. Sibiya',    3500, 51, (SELECT route_id FROM routes WHERE route_code='RT-026'));

-- Seed: documents ---------------------------------------------
-- Certificate numbers and dates are the teammate's originals.
-- holder_name mirrors the vehicle's driver.

INSERT INTO documents
    (vehicle_id, document_type, holder_name, issue_date, expiry_date, document_number, verified)
SELECT v.vehicle_id, 'roadworthy', v.driver_name, s.issue_date, s.expiry_date, s.document_number, s.verified
FROM (VALUES
    ('DK 84 PT GP', DATE '2025-08-28', DATE '2026-08-28', 'CRW-2026-GAU-009148', TRUE),
    ('CAA 812-394', DATE '2025-08-27', DATE '2026-08-27', 'CRW-2026-CPT-004129', TRUE),
    ('FT 39 LW GP', DATE '2025-08-26', DATE '2026-08-26', 'CRW-2026-GAU-008291', TRUE),
    ('CA 948-201',  DATE '2025-08-27', DATE '2026-08-27', 'CRW-2026-CPT-003810', TRUE),
    ('HG 19 TR GP', DATE '2025-09-02', DATE '2026-09-02', 'CRW-2026-GAU-001293', TRUE),
    ('CAA 401-928', DATE '2025-09-10', DATE '2026-09-10', 'CRW-2026-CPT-007412', TRUE),
    ('JN 42 BK GP', DATE '2025-11-15', DATE '2026-11-15', 'CRW-2026-GAU-005102', TRUE),
    ('CA 593-102',  DATE '2026-01-20', DATE '2027-01-20', 'CRW-2026-CPT-009281', TRUE),
    ('KC 61 PR GP', DATE '2025-08-30', DATE '2026-08-30', 'CRW-2026-GAU-003391', TRUE),
    ('CAA 672-109', DATE '2025-09-04', DATE '2026-09-04', 'CRW-2026-CPT-002194', TRUE),
    ('LV 88 XM GP', DATE '2025-09-08', DATE '2026-09-08', 'CRW-2026-GAU-006830', TRUE),
    ('CA 391-721',  DATE '2025-10-12', DATE '2026-10-12', 'CRW-2026-CPT-005012', TRUE),
    ('MX 29 BZ GP', DATE '2025-11-28', DATE '2026-11-28', 'CRW-2026-GAU-007719', TRUE),
    ('CAA 204-819', DATE '2025-12-05', DATE '2026-12-05', 'CRW-2026-CPT-008104', TRUE),
    ('NP 55 TR GP', DATE '2026-02-14', DATE '2027-02-14', 'CRW-2026-GAU-009920', TRUE),
    ('CA 910-482',  DATE '2026-03-01', DATE '2027-03-01', 'CRW-2026-CPT-001092', TRUE),
    ('PJ 77 DC GP', DATE '2025-11-03', DATE '2026-11-03', 'CRW-2026-GAU-004410', TRUE),
    ('CAA 519-302', DATE '2025-11-04', DATE '2026-11-04', 'CRW-2026-CPT-003319', TRUE),
    ('RK 12 MK GP', DATE '2025-11-05', DATE '2026-11-05', 'CRW-2026-GAU-002810', TRUE),
    ('CA 702-811',  DATE '2025-12-18', DATE '2026-12-18', 'CRW-2026-CPT-006620', TRUE),
    ('ST 33 NW GP', DATE '2026-01-10', DATE '2027-01-10', 'CRW-2026-GAU-009102', TRUE),
    ('CAA 941-023', DATE '2026-02-01', DATE '2027-02-01', 'CRW-2026-CPT-004491', TRUE),
    ('VB 90 HY GP', DATE '2026-02-22', DATE '2027-02-22', 'CRW-2026-GAU-001048', TRUE),
    ('CA 831-502',  DATE '2026-03-15', DATE '2027-03-15', 'CRW-2026-CPT-007812', TRUE),
    ('WY 41 KL GP', DATE '2025-08-15', DATE '2026-08-15', 'CRW-2026-GAU-007201', TRUE),
    ('CAA 102-948', DATE '2025-09-20', DATE '2026-09-20', 'CRW-2026-CPT-008920', TRUE),
    ('XZ 10 MM GP', DATE '2025-10-05', DATE '2026-10-05', 'CRW-2026-GAU-003829', TRUE),
    -- Last verified a year ago and not re-checked this cycle. This is the
    -- "shoebox in the cab" case the pitch names: the operator's record says
    -- November, nobody has confirmed it, and the vehicle carries 65 people.
    ('CA 449-102',  DATE '2025-11-18', DATE '2026-11-18', 'CRW-2026-CPT-004821', FALSE),
    ('YB 82 PT GP', DATE '2025-12-30', DATE '2026-12-30', 'CRW-2026-GAU-005918', TRUE),
    ('CAA 339-182', DATE '2026-01-25', DATE '2027-01-25', 'CRW-2026-CPT-009012', TRUE),
    ('ZC 99 BR GP', DATE '2026-02-18', DATE '2027-02-18', 'CRW-2026-GAU-002109', TRUE),
    ('CA 192-803',  DATE '2026-03-22', DATE '2027-03-22', 'CRW-2026-CPT-006192', TRUE)
) AS s(plate_number, issue_date, expiry_date, document_number, verified)
JOIN vehicles v ON v.plate_number = s.plate_number;

-- Seed snapshot -----------------------------------------------
--
-- "Reset demo data" in the UI restores the document set to exactly this.
-- Without a snapshot there is nothing to reset TO: once scans are persisted,
-- the old "clear session" (which just dropped in-memory state) has no
-- meaning. Vehicles are not snapshotted because nothing in the app mutates
-- them — only documents are ever written.

DROP TABLE IF EXISTS documents_seed;
CREATE TABLE documents_seed AS SELECT * FROM documents;
