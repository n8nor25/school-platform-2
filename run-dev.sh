#!/bin/bash
# Persistent dev server launcher with watchdog
cd /home/z/my-project
export DATABASE_URL="postgresql://postgres.ivclktmhpkyxzlywewpl:qEk9OmC8XKRyTUQS@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=4"
export DIRECT_URL="postgresql://postgres.ivclktmhpkyxzlywewpl:qEk9OmC8XKRyTUQS@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
export NODE_OPTIONS="--max-old-space-size=2048"
export PORT=3000

# Kill any stale next dev
pkill -f "next dev" 2>/dev/null
sleep 1

# Write a marker so we know the watchdog is alive
echo "watchdog-started at $(date)" > /tmp/dev-watchdog.marker

# Watchdog loop: restart if dies
while true; do
  echo "[$(date +%T)] starting next dev..." >> /tmp/dev-watchdog.marker
  npx next dev -p 3000 --turbopack >> /home/z/my-project/dev.log 2>&1
  EXITCODE=$?
  echo "[$(date +%T)] next dev exited with $EXITCODE, restarting in 3s..." >> /tmp/dev-watchdog.marker
  sleep 3
  # Safety: prevent infinite rapid loop
  touch /tmp/dev-watchdog.marker
done
