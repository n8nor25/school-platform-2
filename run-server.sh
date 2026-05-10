#!/bin/bash
cd /home/z/my-project

export DATABASE_URL="postgresql://postgres.tjnlxkyzopxnlunpeude:e1yexwk7UBPWPeCV@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
export DIRECT_URL="postgresql://postgres:e1yexwk7UBPWPeCV@db.tjnlxkyzopxnlunpeude.supabase.co:5432/postgres"

while true; do
  echo "Starting Next.js server..."
  NODE_OPTIONS='--max-old-space-size=2048' npx next dev -p 3000 --webpack
  EXIT_CODE=$?
  echo "Server exited with code $EXIT_CODE, restarting in 3s..."
  sleep 3
done
