#!/bin/bash
cd /home/z/my-project
while true; do
  # Kill any existing server
  pkill -f "next dev" 2>/dev/null
  sleep 2
  
  # Start the server
  NODE_OPTIONS='--max-old-space-size=1536' node ./node_modules/.bin/next dev -p 3000 --webpack >> /home/z/my-project/dev.log 2>&1 &
  SERVER_PID=$!
  
  # Wait for the server to be ready
  for i in $(seq 1 30); do
    if curl -s -o /dev/null http://localhost:3000 2>/dev/null; then
      echo "Server ready on port 3000 (PID: $SERVER_PID)" >> /home/z/my-project/dev.log
      break
    fi
    sleep 1
  done
  
  # Wait for server process to exit
  wait $SERVER_PID 2>/dev/null
  echo "Server died, restarting..." >> /home/z/my-project/dev.log
  sleep 3
done
