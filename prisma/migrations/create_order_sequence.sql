-- Creates the PostgreSQL sequence used to generate order numbers in the format MLH-{YEAR}-{NNNNN}.
-- Run this once after the initial migration.
CREATE SEQUENCE IF NOT EXISTS order_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;
