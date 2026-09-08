#!/usr/bin/env python3
import json
import subprocess
import time
import urllib.request
from pathlib import Path

BASE = "http://localhost:3000"
API = "http://localhost:3001/v1"
OUT = Path("/Users/vikasyadav/platform/screenshots")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT.mkdir(parents=True, exist_ok=True)


def dev_login(phone: str, role: str) -> dict:
    req = urllib.request.Request(
        f"{API}/auth/dev-login",
        data=json.dumps({"phone": phone, "role": role}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as res:
        return json.load(res)["data"]


def shot(name: str, path: str, phone: str, role: str, w=390, h=844):
    data = dev_login(phone, role)
    store = {"state": {"session": {"accessToken": data["accessToken"], "user": data["user"]}}, "version": 0}
    html = f"""<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<script>
localStorage.setItem('platform-auth', {json.dumps(json.dumps(store))});
window.location.replace('{BASE}{path}');
</script></body></html>"""
    tmp = OUT / f"_inject_{name}.html"
    tmp.write_text(html)
    subprocess.run(
        [
            CHROME,
            "--headless",
            "--disable-gpu",
            f"--window-size={w},{h}",
            "--virtual-time-budget=15000",
            f"--screenshot={OUT / f'{name}.png'}",
            f"file://{tmp}",
        ],
        stderr=subprocess.DEVNULL,
    )
    tmp.unlink(missing_ok=True)
    time.sleep(0.5)


shot("wallet-purchase", "/wallet/purchase", "+919999990001", "user")
shot("host-dashboard", "/host/dashboard", "+919999990002", "host")
shot("host-earnings", "/host/earnings", "+919999990002", "host")
shot("host-withdraw", "/host/withdraw", "+919999990002", "host")
shot("admin-dashboard", "/admin", "+919999990003", "admin", 1280, 800)
shot("admin-revenue", "/admin/revenue", "+919999990003", "admin", 1280, 800)

for p in sorted(OUT.glob("*.png")):
    print(p, p.stat().st_size)