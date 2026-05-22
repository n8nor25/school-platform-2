#!/bin/bash
# ===== SUPABASE POSTGRESQL FIX SCRIPT =====
# This script ensures the project uses Supabase PostgreSQL instead of SQLite.
# It runs before the dev server to fix any configuration that may have been
# overwritten by the container startup process.
#
# ROOT CAUSE: The system environment variable DATABASE_URL points to SQLite,
# which overrides the .env file. This script fixes:
# 1. The prisma/schema.prisma provider (must be "postgresql")
# 2. The .env file (must have Supabase URLs with connection limits)
# 3. Removes any SQLite database files
# 4. Regenerates the Prisma client for PostgreSQL

PROJECT_DIR="/home/z/my-project"
SCHEMA_FILE="$PROJECT_DIR/prisma/schema.prisma"
ENV_FILE="$PROJECT_DIR/.env"
DB_DIR="$PROJECT_DIR/db"

# Supabase PostgreSQL URLs with connection pool limits
# Using pooler for both since direct port 5432 is blocked
# pgbouncer=true for session mode, connection_limit=5 to avoid max client errors
SUPABASE_DATABASE_URL="postgresql://postgres.tjnlxkyzopxnlunpeude:e1yexwk7UBPWPeCV@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=5"
SUPABASE_DIRECT_URL="postgresql://postgres.tjnlxkyzopxnlunpeude:e1yexwk7UBPWPeCV@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?connection_limit=5"

echo "[fix-supabase] 🔧 Ensuring Supabase PostgreSQL configuration..."

# 1. Fix schema.prisma - ensure provider is "postgresql" with directUrl
if grep -q 'provider = "sqlite"' "$SCHEMA_FILE" 2>/dev/null; then
  echo "[fix-supabase] ⚠️ schema.prisma has sqlite provider, fixing to postgresql..."
  sed -i '/^datasource db {/,/^}/c\datasource db {\n  provider  = "postgresql"\n  url       = env("DATABASE_URL")\n  directUrl = env("DIRECT_URL")\n}' "$SCHEMA_FILE"
  echo "[fix-supabase] ✅ schema.prisma fixed to postgresql"
elif ! grep -q 'directUrl' "$SCHEMA_FILE" 2>/dev/null; then
  echo "[fix-supabase] ⚠️ schema.prisma missing directUrl, adding..."
  sed -i '/^datasource db {/,/^}/c\datasource db {\n  provider  = "postgresql"\n  url       = env("DATABASE_URL")\n  directUrl = env("DIRECT_URL")\n}' "$SCHEMA_FILE"
  echo "[fix-supabase] ✅ schema.prisma fixed with directUrl"
else
  echo "[fix-supabase] ✅ schema.prisma already has postgresql provider with directUrl"
fi

# 2. Fix .env file - ensure it has Supabase URLs with connection limits
echo "[fix-supabase] ✏️ Writing correct .env file..."
cat > "$ENV_FILE" << EOF
DATABASE_URL=$SUPABASE_DATABASE_URL
DIRECT_URL=$SUPABASE_DIRECT_URL
EOF
echo "[fix-supabase] ✅ .env file updated with Supabase PostgreSQL URLs"

# 3. Remove any SQLite database files
if [ -d "$DB_DIR" ]; then
  rm -f "$DB_DIR"/*.db "$DB_DIR"/*.db-journal 2>/dev/null
  echo "[fix-supabase] 🗑️ Removed SQLite database files"
fi

# 4. Export correct environment variables for this process and children
export DATABASE_URL="$SUPABASE_DATABASE_URL"
export DIRECT_URL="$SUPABASE_DIRECT_URL"
echo "[fix-supabase] ✅ Environment variables set for current process"

# 5. Regenerate Prisma client for PostgreSQL
echo "[fix-supabase] 🔄 Regenerating Prisma client for PostgreSQL..."
cd "$PROJECT_DIR"
DATABASE_URL="$SUPABASE_DATABASE_URL" DIRECT_URL="$SUPABASE_DIRECT_URL" npx prisma generate 2>&1

echo "[fix-supabase] ✅ Supabase PostgreSQL configuration complete!"
