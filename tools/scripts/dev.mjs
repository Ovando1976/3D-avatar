#!/usr/bin/env node
import { spawn } from 'node:child_process';

const services = [
  {
    name: 'studio',
    command: 'npm',
    args: ['run', 'dev', '--workspace', '@3d-avatar/studio'],
  },
  {
    name: 'api-gateway',
    command: 'npm',
    args: ['run', 'dev', '--workspace', '@3d-avatar/api-gateway'],
    env: {
      SESSION_STORE_PATH: 'data/dev-sessions.json',
    },
  },
  {
    name: 'automation-worker',
    command: 'npm',
    args: ['run', 'dev', '--workspace', '@3d-avatar/automation-worker'],
  },
];

const children = new Set();
let shuttingDown = false;

function log(message) {
  console.log(`[dev] ${message}`);
}

function terminate(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('Shutting down...');
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }
  // give processes a moment to exit before terminating the parent
  setTimeout(() => process.exit(code), 500);
}

process.on('SIGINT', () => terminate(0));
process.on('SIGTERM', () => terminate(0));

for (const service of services) {
  log(`Starting ${service.name} (${service.args.join(' ')})`);
  const child = spawn(service.command, service.args, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, FORCE_COLOR: '1', ...(service.env ?? {}) },
  });

  children.add(child);

  child.on('exit', (code, signal) => {
    children.delete(child);
    if (shuttingDown) return;
    if (code === 0) {
      log(`${service.name} exited normally.`);
      terminate(0);
    } else {
      const reason = signal ? `signal ${signal}` : `code ${code}`;
      log(`${service.name} exited with ${reason}. Stopping all services.`);
      terminate(code ?? 1);
    }
  });

  child.on('error', (error) => {
    log(`${service.name} failed to start: ${error.message}`);
    terminate(1);
  });
}
