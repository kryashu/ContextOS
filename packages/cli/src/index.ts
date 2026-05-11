#!/usr/bin/env node

import { rootDir } from './bootstrap.js';
import { resolve } from 'node:path';

import { DemoCommand } from './commands/demo.js';
import { aiCheck } from './commands/ai-check.js';
import { runEval } from './commands/eval.js';
import { configPrint } from './commands/config-print.js';

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('ContextOS CLI');
  console.log('');
  console.log('Usage:');
  console.log('  contextos demo <workspace-path>       Run demo on a workspace');
  console.log('  contextos ai:check                    Check AI provider health');
  console.log('  contextos eval <test-name>            Run evaluation tests');
  console.log('  contextos config:print                Show resolved configuration');
  console.log('');
  console.log('Examples:');
  console.log('  contextos demo ./demo-workspaces/checkout-system');
  console.log('  contextos ai:check');
  console.log('  contextos eval vertical-slice-001');
  console.log('');
  process.exit(0);
}

const command = args[0];

async function main() {
  try {
    if (command === 'demo') {
      const workspacePath = args[1];
      if (!workspacePath) {
        console.error('Error: workspace path required');
        console.error('Usage: contextos demo <workspace-path>');
        process.exit(1);
      }

      const demoCommand = new DemoCommand();
      await demoCommand.execute(resolve(rootDir, workspacePath));
    } else if (command === 'ai:check') {
      await aiCheck();
    } else if (command === 'eval') {
      const testName = args[1];
      if (!testName) {
        console.error('Error: test name required');
        console.error('Usage: contextos eval <test-name>');
        console.error('Available tests: vertical-slice-001');
        process.exit(1);
      }
      await runEval(testName);
    } else if (command === 'config:print') {
      configPrint();
    } else {
      console.error(`Unknown command: ${command}`);
      console.error('Run "contextos" without arguments to see available commands.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
