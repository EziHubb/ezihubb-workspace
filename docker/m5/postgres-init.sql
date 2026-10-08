-- Executed ONLY on a new owned Docker volume. Application role is not superuser.
\getenv app_password M5_APP_PASSWORD
\getenv environment_token M5_DATABASE_TOKEN
CREATE ROLE ezihubb_m5 LOGIN PASSWORD :'app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE DATABASE ezihubb_m5_fresh OWNER ezihubb_m5;
CREATE DATABASE ezihubb_m5_upgrade OWNER ezihubb_m5;
CREATE DATABASE ezihubb_m5_scenarios OWNER ezihubb_m5;
REVOKE CONNECT ON DATABASE postgres FROM PUBLIC;
\connect ezihubb_m5_fresh
CREATE SCHEMA m5_guard AUTHORIZATION m5_bootstrap;
CREATE TABLE m5_guard.environment (singleton boolean PRIMARY KEY CHECK (singleton), token text NOT NULL);
INSERT INTO m5_guard.environment VALUES (true, :'environment_token');
CREATE TABLE m5_guard.fixture_receipt (name text PRIMARY KEY, payload jsonb NOT NULL);
GRANT USAGE ON SCHEMA m5_guard TO ezihubb_m5;
GRANT SELECT ON m5_guard.environment TO ezihubb_m5;
GRANT SELECT, INSERT ON m5_guard.fixture_receipt TO ezihubb_m5;
\connect ezihubb_m5_scenarios
CREATE SCHEMA m5_guard AUTHORIZATION m5_bootstrap;
CREATE TABLE m5_guard.environment (singleton boolean PRIMARY KEY CHECK (singleton), token text NOT NULL);
INSERT INTO m5_guard.environment VALUES (true, :'environment_token');
CREATE TABLE m5_guard.fixture_receipt (name text PRIMARY KEY, payload jsonb NOT NULL);
GRANT USAGE ON SCHEMA m5_guard TO ezihubb_m5;
GRANT SELECT ON m5_guard.environment TO ezihubb_m5;
GRANT SELECT, INSERT ON m5_guard.fixture_receipt TO ezihubb_m5;
\connect ezihubb_m5_upgrade
CREATE SCHEMA m5_guard AUTHORIZATION m5_bootstrap;
CREATE TABLE m5_guard.environment (singleton boolean PRIMARY KEY CHECK (singleton), token text NOT NULL);
INSERT INTO m5_guard.environment VALUES (true, :'environment_token');
CREATE TABLE m5_guard.fixture_receipt (name text PRIMARY KEY, payload jsonb NOT NULL);
GRANT USAGE ON SCHEMA m5_guard TO ezihubb_m5;
GRANT SELECT ON m5_guard.environment TO ezihubb_m5;
GRANT SELECT, INSERT ON m5_guard.fixture_receipt TO ezihubb_m5;
