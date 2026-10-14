import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const PREFIX_MAP: Record<string, string> = {
  idle: 'idle',
  talking: 'talking',
  listening: 'listening',
  thinking: 'thinking',
  smile: 'smile',
  laugh: 'laugh',
  gift_small: 'gift_small',
  gift_big: 'gift_vip',
  gift_vip: 'gift_vip',
  wave: 'wave',
  bye: 'bye',
  surprised: 'surprised',
  welcome: 'welcome',
};

function parseType(filename: string) {
  const base = filename.replace(/\.(mp4|webm)$/i, '');
  for (const prefix of Object.keys(PREFIX_MAP).sort((a, b) => b.length - a.length)) {
    if (base.startsWith(prefix + '_') || base === prefix) return PREFIX_MAP[prefix];
  }
  return null;
}

function scanAssets() {
  const root = path.join(process.cwd(), 'public', 'ai-hosts');
  const hosts: Record<string, { outfits: Record<string, { scenes: Record<string, unknown[]> }> }> = {};
  let totalClips = 0;

  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });

  for (const host of fs.readdirSync(root)) {
    if (host.startsWith('.') || host === 'manifest.json') continue;
    const hostPath = path.join(root, host);
    if (!fs.statSync(hostPath).isDirectory()) continue;
    hosts[host] = { outfits: {} };

    for (const outfit of fs.readdirSync(hostPath)) {
      if (outfit.startsWith('.')) continue;
      const outfitPath = path.join(hostPath, outfit);
      if (!fs.statSync(outfitPath).isDirectory()) continue;
      hosts[host].outfits[outfit] = { scenes: {} };

      for (const scene of fs.readdirSync(outfitPath)) {
        if (scene.startsWith('.')) continue;
        const scenePath = path.join(outfitPath, scene);
        if (!fs.statSync(scenePath).isDirectory()) continue;
        const clips = [];

        for (const file of fs.readdirSync(scenePath)) {
          if (!/\.(mp4|webm)$/i.test(file)) continue;
          const type = parseType(file);
          if (!type) continue;
          const rel = `/ai-hosts/${host}/${outfit}/${scene}/${file}`;
          clips.push({ path: rel, url: rel, host, outfit, scene, type, file, weight: 1 });
          totalClips++;
        }
        if (clips.length) hosts[host].outfits[outfit].scenes[scene] = clips;
      }
    }
  }

  const manifest = { hosts, scannedAt: new Date().toISOString(), totalClips };
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

export async function GET() {
  const manifest = scanAssets();
  return NextResponse.json(manifest);
}

export async function POST() {
  const manifest = scanAssets();
  return NextResponse.json({ refreshed: true, ...manifest });
}