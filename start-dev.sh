#!/bin/bash
cd /home/z/my-project

# Ensure SQLite .env exists (Supabase projects were deleted, fall back to local SQLite)
if ! grep -q '^DATABASE_URL=' .env 2>/dev/null; then
  echo 'DATABASE_URL="file:/home/z/my-project/db/custom.db"' > .env
fi

# Make sure db folder exists
mkdir -p db

# Export env var from .env
export DATABASE_URL=$(grep '^DATABASE_URL=' .env | cut -d'=' -f2- | tr -d '"')

# Regenerate Prisma client
npx prisma generate 2>/dev/null

# Check if server is already running
if pgrep -f "next-server" > /dev/null 2>&1; then
  echo "✅ Server is already running"
  exit 0
fi

# Start dev server using double-fork technique for persistence
bash -c "
  cd /home/z/my-project
  export DATABASE_URL='$DATABASE_URL'
  export NODE_OPTIONS='--max-old-space-size=2048'
  nohup npx next dev -p 3000 --turbopack > /home/z/my-project/dev.log 2>&1 &
  echo \$! > /tmp/next-server-pid
"

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
