#!/bin/bash
cd /home/z/my-project
export DATABASE_URL='postgresql://postgres.tjnlxkyzopxnlunpeude:e1yexwk7UBPWPeCV@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=5'
export DIRECT_URL='postgresql://postgres.tjnlxkyzopxnlunpeude:e1yexwk7UBPWPeCV@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?connection_limit=5'

while true; do
  echo "=== Starting server at $(date) ===" >> /home/z/my-project/watchdog.log
  NODE_OPTIONS='--max-old-space-size=2048' npx next dev -p 3000 --turbopack >> /home/z/my-project/dev.log 2>&1
  echo "=== Server died at $(date), restarting in 3s ===" >> /home/z/my-project/watchdog.log
  sleep 3
done
