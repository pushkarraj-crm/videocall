#!/usr/bin/env node
/**
 * Scans apps/web/public/ai-hosts and writes manifest.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../public/ai-hosts');
const MANIFEST = path.join(ROOT, 'manifest.json');

const PREFIX_MAP = {
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

function parseType(filename) {
  const base = filename.replace(/\.(mp4|webm)$/i, '');
  for (const prefix of Object.keys(PREFIX_MAP).sort((a, b) => b.length - a.length)) {
    if (base.startsWith(prefix + '_') || base === prefix) return PREFIX_MAP[prefix];
  }
  return null;
}

function scan() {
  const hosts = {};
  let totalClips = 0;

  if (!fs.existsSync(ROOT)) {
    fs.mkdirSync(ROOT, { recursive: true });
  }

  for (const host of fs.readdirSync(ROOT)) {
    if (host.startsWith('.') || host === 'manifest.json') continue;
    const hostPath = path.join(ROOT, host);
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
          clips.push({
            path: rel,
            url: rel,
            host,
            outfit,
            scene,
            type,
            file,
            weight: 1,
          });
          totalClips++;
        }

        if (clips.length) hosts[host].outfits[outfit].scenes[scene] = clips;
      }
    }
  }

  const manifest = { hosts, scannedAt: new Date().toISOString(), totalClips };
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(`✓ manifest.json — ${totalClips} clips, ${Object.keys(hosts).length} hosts`);
  return manifest;
}

scan();