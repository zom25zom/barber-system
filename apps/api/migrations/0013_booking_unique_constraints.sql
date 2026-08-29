-- 0013: DB-level booking race guards
--
-- The app-level checks (checkConflict / existingActive) run as separate SELECTs
-- before INSERT — two concurrent requests could both pass and both succeed.
-- These partial unique indexes make the guarantees hold at the DATABASE level:
--
-- 1. A barber can have only ONE confirmed booking per (date, start_time).
-- 2. A customer can have only ONE confirmed (active) booking at a time
--    (PRD single-active-booking policy — queue logic depends on it).
--
-- Cancelled / completed / no_show rows are excluded via the WHERE clause.
-- Code paths that INSERT or UPDATE confirmed bookings map the resulting
-- UNIQUE constraint errors to friendly Arabic messages (see mapBookingUniqueError).
CREATE UNIQUE INDEX IF NOT EXISTS ux_bookings_barber_slot
  ON bookings (barber_id, booking_date, start_time) WHERE status = 'confirmed';

CREATE UNIQUE INDEX IF NOT EXISTS ux_bookings_customer_active
  ON bookings (customer_id) WHERE status = 'confirmed';
