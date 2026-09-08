/**
 * Verifies age gate storage key and component exports.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../..');
const WEB = path.join(ROOT, 'apps/web');
const AGE_GATE_LIB = path.join(WEB, 'src/lib/legal/age-gate.ts');
const AGE_GATE_COMPONENT = path.join(WEB, 'src/components/legal/age-gate.tsx');
const AGE_GATE_SHELL = path.join(WEB, 'src/components/layout/age-gate-shell.tsx');
const APP_LAYOUT = path.join(WEB, 'src/app/(app)/layout.tsx');

const REQUIRED_KEY = 'lovinexa_age_confirmed';
const REQUIRED_COPY = 'I confirm that I am at least 18 years old';

function assertContains(file: string, needle: string) {
  const content = fs.readFileSync(file, 'utf8');
  if (!content.includes(needle)) {
    throw new Error(`${path.basename(file)} missing: ${needle}`);
  }
}

async function main() {
  for (const file of [AGE_GATE_LIB, AGE_GATE_COMPONENT, AGE_GATE_SHELL, APP_LAYOUT]) {
    if (!fs.existsSync(file)) throw new Error(`Missing file: ${file}`);
  }

  assertContains(AGE_GATE_LIB, REQUIRED_KEY);
  assertContains(AGE_GATE_COMPONENT, REQUIRED_COPY);
  assertContains(AGE_GATE_COMPONENT, 'I am under 18');
  assertContains(AGE_GATE_SHELL, 'AgeGate');
  assertContains(APP_LAYOUT, 'AgeGateShell');

  console.log(
    JSON.stringify(
      {
        passed: true,
        storageKey: REQUIRED_KEY,
        filesChecked: 4,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});