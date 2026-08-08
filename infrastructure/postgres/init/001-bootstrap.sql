\set ON_ERROR_STOP on

-- Roles y credenciales exclusivamente sintéticos para desarrollo local.
CREATE ROLE admission_migrator
  LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOREPLICATION
  NOBYPASSRLS
  PASSWORD 'admission_migrator_local_only';

CREATE ROLE admission_app
  LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOREPLICATION
  NOBYPASSRLS
  PASSWORD 'admission_app_local_only';

CREATE DATABASE admission_dev OWNER admission_migrator;

REVOKE CONNECT ON DATABASE admission_dev FROM PUBLIC;
GRANT CONNECT ON DATABASE admission_dev TO admission_migrator, admission_app;

\connect admission_dev

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO admission_migrator;
GRANT USAGE ON SCHEMA public TO admission_app;
