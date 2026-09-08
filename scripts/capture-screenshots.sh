#!/bin/bash
set -euo pipefail
BASE="${WEB_URL:-http://localhost:3000}"
OUT="/Users/vikasyadav/platform/screenshots"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p "$OUT"

login_and_shot() {
  local role=$1 phone=$2 name=$3 path=$4 width=${5:-390} height=${6:-844}
  local resp auth_file tmp
  resp=$(curl -s -X POST http://localhost:3001/v1/auth/dev-login \
    -H 'Content-Type: application/json' \
    -d "{\"phone\":\"$phone\",\"role\":\"$role\"}")

  auth_file=$(mktemp)
  echo "$resp" | python3 -c "
import sys, json
data = json.load(sys.stdin)['data']
store = {'state': {'session': {'accessToken': data['accessToken'], 'user': data['user']}}, 'version': 0}
open('$auth_file', 'w').write(json.dumps(store))
"

  tmp=$(mktemp /tmp/auth-inject-XXXXXX.html)
  AUTH_JSON=$(cat "$auth_file")
  cat > "$tmp" <<HTML
<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<script>
localStorage.setItem('platform-auth', ${AUTH_JSON@Q});
window.location.replace('$BASE$path');
</script></body></html>
HTML

  "$CHROME" --headless --disable-gpu --window-size=${width},${height} \
    --virtual-time-budget=5000 \
    --screenshot="$OUT/$name.png" "file://$tmp" 2>/dev/null || true
  rm -f "$tmp" "$auth_file"
  sleep 1
}

login_and_shot user +919999990001 wallet-purchase /wallet/purchase
login_and_shot host +919999990002 host-dashboard /host/dashboard
login_and_shot host +919999990002 host-earnings /host/earnings
login_and_shot host +919999990002 host-withdraw /host/withdraw
login_and_shot admin +919999990003 admin-dashboard /admin 1280 800

echo "Screenshots: $OUT"
ls -la "$OUT"