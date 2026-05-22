#!/bin/bash
export DATABASE_URL='postgresql://postgres.tjnlxkyzopxnlunpeude:e1yexwk7UBPWPeCV@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=5'
export DIRECT_URL='postgresql://postgres.tjnlxkyzopxnlunpeude:e1yexwk7UBPWPeCV@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?connection_limit=5'
NODE_OPTIONS='--max-old-space-size=4096' npx next dev -p 3000 --webpack 2>&1 | tee dev.log
