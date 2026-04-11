-- SkillSwap PostgreSQL initialization script
-- Runs once when the container is first created

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- for fuzzy text search
CREATE EXTENSION IF NOT EXISTS "unaccent";      -- for accent-insensitive search

-- Set default timezone
SET timezone = 'UTC';

-- Create test database for CI
CREATE DATABASE skillswap_test OWNER skillswap;

\echo 'SkillSwap database initialized successfully.'
