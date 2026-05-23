#!/bin/bash
cd /home/z/my-project

# Fix schema.prisma - force postgresql
sed -i '/^datasource db {/,/^}/c\datasource db {\n  provider  = "postgresql"\n  url       = env("DATABASE_URL")\n  directUrl = env("DIRECT_URL")\n}' prisma/schema.prisma

# Fix .env file
cat > .env << 'EOF'
DATABASE_URL=postgresql://postgres.tjnlxkyzopxnlunpeude:e1yexwk7UBPWPeCV@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=5
DIRECT_URL=postgresql://postgres.tjnlxkyzopxnlunpeude:e1yexwk7UBPWPeCV@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?connection_limit=5
EOF

# Remove any SQLite files
rm -f db/*.db db/*.db-journal 2>/dev/null

# Export env vars (critical - system DATABASE_URL points to SQLite)
export DATABASE_URL='postgresql://postgres.tjnlxkyzopxnlunpeude:e1yexwk7UBPWPeCV@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=5'
export DIRECT_URL='postgresql://postgres.tjnlxkyzopxnlunpeude:e1yexwk7UBPWPeCV@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?connection_limit=5'

# Regenerate Prisma client for PostgreSQL
npx prisma generate 2>/dev/null

# Start dev server with Turbopack (less memory than webpack)
NODE_OPTIONS='--max-old-space-size=4096' npx next dev -p 3000 --turbopack 2>&1 | tee dev.log
