import { printConfig } from '@contextos/ai';

export function configPrint(): void {
  console.log('\n📋 ContextOS Runtime Configuration\n');
  const config = printConfig();
  const maxKeyLen = Math.max(...Object.keys(config).map(k => k.length));

  for (const [key, value] of Object.entries(config)) {
    console.log(`  ${key.padEnd(maxKeyLen)}  ${value}`);
  }

  console.log('');
}
