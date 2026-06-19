#!/usr/bin/env bash
# Free dev server ports if a stale process is holding them.
for port in 3001 3000; do
  pids=$(lsof -ti:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "Killing process on port $port: $pids"
    kill -9 $pids 2>/dev/null || true
  fi
done