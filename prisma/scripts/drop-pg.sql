-- Drop and recreate the public schema (wipes all tables, enums, sequences, etc.)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO PUBLIC;
