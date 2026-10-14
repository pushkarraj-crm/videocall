/**
 * AI Local Video Asset Integration — verification.
 * Run: npx tsx scripts/verify-local-assets.ts
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ASSET_COOLDOWN_MS,
  emotionToAssetType,
  listMissingAssets,
  pickClip,
  resolveSceneClips,
  selectAsset,
  shouldLoop,
  slugifyHost,
  VIDEO_CROSSFADE_MS,
  VIDEO_RETURN_TO_IDLE_MS,
} from '../src/lib/video-assets/asset-manager';
import {
  EXPECTED_ASSET_TYPES,
  parseFilenameAssetType,
  type AssetClip,
  type HostAssetCatalog,
} from '../src/lib/video-assets/asset-types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, '..');
const PUBLIC_HOSTS = path.join(WEB_ROOT, 'public', 'ai-hosts');
const API_ROOT = path.resolve(WEB_ROOT, '../api');

const results: { name: string; ok: boolean; detail?: string }[] = [];

function pass(name: string, detail?: string) {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name: string, detail?: string) {
  results.push({ name, ok: false, detail });
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

function assert(cond: boolean, name: string, detail?: string) {
  if (cond) pass(name, detail);
  else fail(name, detail);
}

function scanDisk(): HostAssetCatalog {
  const hosts: HostAssetCatalog['hosts'] = {};
  let totalClips = 0;

  if (!fs.existsSync(PUBLIC_HOSTS)) {
    return { hosts, scannedAt: new Date().toISOString(), totalClips: 0 };
  }

  for (const host of fs.readdirSync(PUBLIC_HOSTS)) {
    if (host.startsWith('.') || host === 'manifest.json') continue;
    const hostPath = path.join(PUBLIC_HOSTS, host);
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
        const clips: AssetClip[] = [];

        for (const file of fs.readdirSync(scenePath)) {
          if (!/\.(mp4|webm)$/i.test(file)) continue;
          const type = parseFilenameAssetType(file);
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

  return { hosts, scannedAt: new Date().toISOString(), totalClips };
}

function runRegression(script: string): boolean {
  const full = path.join(API_ROOT, 'scripts', script);
  if (!fs.existsSync(full)) {
    fail(`Regression ${script}`, 'script missing');
    return false;
  }
  const r = spawnSync('npx', ['tsx', full], {
    cwd: API_ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  const ok = r.status === 0;
  if (ok) pass(`Regression ${script}`);
  else fail(`Regression ${script}`, (r.stderr || r.stdout || '').slice(0, 240));
  return ok;
}

function main() {
  console.log('\n=== AI Local Video Asset Integration Verification ===\n');

  console.log('1. Folder detection');
  assert(fs.existsSync(PUBLIC_HOSTS), 'public/ai-hosts exists');
  const manifestPath = path.join(PUBLIC_HOSTS, 'manifest.json');
  assert(fs.existsSync(manifestPath), 'manifest.json present');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as HostAssetCatalog;
  const disk = scanDisk();
  const hostSlugs = Object.keys(disk.hosts);
  assert(hostSlugs.length > 0, 'At least one host folder detected', hostSlugs.join(', '));

  const anchalClips = resolveSceneClips(disk, 'anchal', 'casual', 'bedroom');
  assert(anchalClips.length >= 2, 'anchal casual bedroom has clips', String(anchalClips.length));

  console.log('\n2. Asset loading & filename parsing');
  assert(parseFilenameAssetType('idle_01.mp4') === 'idle', 'idle filename parse');
  assert(parseFilenameAssetType('gift_big_01.mp4') === 'gift_vip', 'gift_big → gift_vip');
  assert(parseFilenameAssetType('unknown.mp4') === null, 'unknown filename rejected');
  assert(EXPECTED_ASSET_TYPES.includes('talking'), 'expected types include talking');

  console.log('\n3. Emotion / call flow → asset type');
  assert(
    emotionToAssetType({ host: 'anchal', speaking: true }) === 'talking',
    'speaking → talking',
  );
  assert(
    emotionToAssetType({ host: 'anchal', thinking: true }) === 'thinking',
    'thinking → thinking',
  );
  assert(
    emotionToAssetType({ host: 'anchal', callEvent: 'user_joined' }) === 'welcome',
    'user_joined → welcome',
  );
  assert(
    emotionToAssetType({ host: 'anchal', callEvent: 'call_ending' }) === 'bye',
    'call_ending → bye',
  );
  assert(
    emotionToAssetType({ host: 'anchal', giftCategory: 'luxury' }) === 'gift_vip',
    'luxury gift → gift_vip',
  );
  assert(
    emotionToAssetType({ host: 'anchal', emotion: 'surprised' }) === 'surprised',
    'surprised emotion',
  );
  assert(shouldLoop('idle'), 'idle loops');
  assert(!shouldLoop('talking'), 'talking plays once');

  console.log('\n4. Clip selection, randomization & fallback');
  const history = { lastClip: null as string | null, playedAt: {} as Record<string, number> };
  const idle1 = pickClip(anchalClips, 'idle', history);
  assert(idle1 !== null, 'pick idle clip', idle1?.url);
  const idle2 = pickClip(anchalClips, 'idle', { lastClip: idle1!.url, playedAt: { [idle1!.url]: Date.now() } });
  assert(idle2 !== null && idle2.url !== idle1!.url, 'no immediate repeat');

  const talkingPick = pickClip(anchalClips, 'talking', history);
  assert(talkingPick !== null && talkingPick.type === 'idle', 'missing talking falls back to idle');

  const { clip, type, fallback } = selectAsset(
    disk,
    { host: 'anchal', outfit: 'casual', scene: 'bedroom', speaking: true },
    history,
  );
  assert(clip !== null && type === 'talking' && fallback, 'selectAsset marks fallback when talking missing');

  const missing = listMissingAssets(disk, 'anchal', 'casual', 'bedroom');
  assert(missing.includes('talking'), 'missing list includes talking');
  assert(missing.includes('bye'), 'missing list includes bye');
  assert(!missing.includes('idle'), 'idle not in missing');

  console.log('\n5. Cooldown replay');
  const allUrls = anchalClips.map((c) => c.url);
  const playedAt = Object.fromEntries(allUrls.map((u) => [u, Date.now() - ASSET_COOLDOWN_MS - 1]));
  const afterCooldown = pickClip(anchalClips, 'idle', { lastClip: allUrls[0], playedAt });
  assert(afterCooldown !== null, 'cooldown expired allows replay');

  console.log('\n6. Player timing constants');
  assert(VIDEO_CROSSFADE_MS >= 200 && VIDEO_CROSSFADE_MS <= 800, 'crossfade in sane range', String(VIDEO_CROSSFADE_MS));
  assert(VIDEO_RETURN_TO_IDLE_MS >= 500, 'return-to-idle delay', String(VIDEO_RETURN_TO_IDLE_MS));

  console.log('\n7. Host slug resolution');
  assert(slugifyHost('Aanya Sharma') === 'aanyasharma', 'slugifyHost strips non-alphanumeric');
  assert(slugifyHost('anchal') === 'anchal', 'slugifyHost preserves simple slug');

  console.log('\n8. Performance');
  const t0 = performance.now();
  for (let i = 0; i < 500; i++) {
    pickClip(anchalClips, 'idle', { lastClip: null, playedAt: {} });
  }
  const elapsed = performance.now() - t0;
  assert(elapsed < 200, '500 picks under 200ms', `${elapsed.toFixed(1)}ms`);

  const scanT0 = performance.now();
  scanDisk();
  const scanElapsed = performance.now() - scanT0;
  assert(scanElapsed < 500, 'disk scan under 500ms', `${scanElapsed.toFixed(1)}ms`);

  console.log('\n9. Manifest sync');
  assert(
    JSON.stringify(Object.keys(manifest.hosts).sort()) === JSON.stringify(hostSlugs.sort()),
    'manifest host keys match disk',
  );
  assert(manifest.totalClips === disk.totalClips, 'manifest clip count matches disk', String(manifest.totalClips));

  console.log('\n10. Regression (no production module changes)');
  runRegression('verify-video-avatar.ts');
  runRegression('verify-avatar-animation.ts');
  runRegression('verify-ai-voice.ts');
  runRegression('verify-ai-conversation.ts');
  runRegression('verify-virtual-hosts.ts');

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===\n`);
  if (failed.length) {
    console.error('Failed:', failed.map((f) => f.name).join(', '));
    process.exit(1);
  }
}

main();