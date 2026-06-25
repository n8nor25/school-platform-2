#!/bin/bash
cd /home/z/my-project

# Fix schema.prisma - force postgresql
sed -i '/^datasource db {/,/^}/c\datasource db {\n  provider  = "postgresql"\n  url       = env("DATABASE_URL")\n  directUrl = env("DIRECT_URL")\n}' prisma/schema.prisma

# Fix .env file - Updated for new Supabase project
cat > .env << 'EOF'
DATABASE_URL=postgresql://postgres.ivclktmhpkyxzlywewpl:qEk9OmC8XKRyTUQS@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=4
DIRECT_URL=postgresql://postgres.ivclktmhpkyxzlywewpl:qEk9OmC8XKRyTUQS@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
EOF

# Remove any SQLite files
rm -f db/*.db db/*.db-journal 2>/dev/null

# Export env vars
export DATABASE_URL='postgresql://postgres.ivclktmhpkyxzlywewpl:qEk9OmC8XKRyTUQS@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=4'
export DIRECT_URL='postgresql://postgres.ivclktmhpkyxzlywewpl:qEk9OmC8XKRyTUQS@aws-0-eu-west-1.pooler.supabase.com:5432/postgres'

# Regenerate Prisma client for PostgreSQL
npx prisma generate 2>/dev/null

# Check if server is already running
if pgrep -f "next-server" > /dev/null 2>&1; then
  echo "✅ Server is already running"
  exit 0
fi

# Start dev server using double-fork technique for persistence
bash -c '
  cd /home/z/my-project
  export DATABASE_URL="postgresql://postgres.ivclktmhpkyxzlywewpl:qEk9OmC8XKRyTUQS@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=4"
  export DIRECT_URL="postgresql://postgres.ivclktmhpkyxzlywewpl:qEk9OmC8XKRyTUQS@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
  export NODE_OPTIONS="--max-old-space-size=2048"
  nohup npx next dev -p 3000 --turbopack > /home/z/my-project/dev.log 2>&1 &
  echo $! > /tmp/next-server-pid
'

# Wait for server to be ready
echo "⏳ Waiting for server to start..."
for i in $(seq 1 30); do
  sleep 1
  if curl -s -o /dev/null http://localhost:3000/ 2>/dev/null; then
    echo "✅ Server is ready at http://localhost:3000"
    exit 0
  fi
done
echo "⚠️ Server may still be starting, check dev.log"
