/**
 * Validates production/staging environment files.
 * Run: npx tsx scripts/production/verify-env.ts --file .env.production.example
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import {
  parseEnvFile,
  PRODUCTION_REQUIRED,
  STAGING_REQUIRED,
  validateEnvMap,
} from './lib/env-rules';

const ROOT = resolve(__dirname, '../..');

function main() {
  const fileArg = process.argv.find((a) => a.startsWith('--file='))?.split('=')[1]
    ?? process.argv[process.argv.indexOf('--file') + 1]
    ?? '.env.production.example';

  const filePath = resolve(ROOT, fileArg);
  if (!existsSync(filePath)) {
    throw new Error(`Env file not found: ${filePath}`);
  }

  const content = readFileSync(filePath, 'utf8');
  const env = parseEnvFile(content);
  const isStaging = fileArg.includes('staging');
  const rules = isStaging ? STAGING_REQUIRED : PRODUCTION_REQUIRED;
  const label = isStaging ? 'staging' : 'production';

  const isExample = fileArg.endsWith('.example');

  // Example templates: ensure every required key is declared
  if (isExample) {
    const missingKeys = rules.filter((r) => r.required && !(r.key in env)).map((r) => r.key);
    if (missingKeys.length > 0) {
      console.error('Example env missing keys:', missingKeys);
      process.exit(1);
    }
  } else {
    const errors = validateEnvMap(env, rules, label);
    if (errors.length > 0) {
      console.error('Environment validation failed:');
      for (const err of errors) console.error(`  ✗ ${err}`);
      process.exit(1);
    }
  }

  const result = {
    passed: true,
    file: fileArg,
    keysChecked: rules.length,
    mode: isExample ? 'example-structure' : 'strict',
  };

  console.log(JSON.stringify(result, null, 2));
}

main();