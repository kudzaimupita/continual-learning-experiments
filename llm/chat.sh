#!/bin/sh
# Starts the Qwen model server (port 8080) and the chat page (port 8090), then open http://localhost:8090
cd "$(dirname "$0")"
if lsof -ti tcp:8090 >/dev/null 2>&1 || lsof -ti tcp:8080 >/dev/null 2>&1; then
  echo "Qwen chat is already running: http://localhost:8090"
  echo "To stop it: pkill -f chat.sh; pkill -f 'mlx_lm server'; pkill -f 'http.server 8090'"
  open http://localhost:8090 2>/dev/null
  exit 0
fi
uv run python -m mlx_lm server --model Qwen/Qwen3-1.7B --port 8080 --allowed-origins "http://localhost:8090,http://127.0.0.1:8090" &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT INT TERM
echo "Chat page: http://localhost:8090"
uv run python -m http.server 8090 --bind 127.0.0.1 --directory ui
