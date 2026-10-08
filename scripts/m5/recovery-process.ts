import { spawn, ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { performance } from 'node:perf_hooks';
const { ROOT, runIdentity } = require('./recovery-support.cjs');

export type KillProof = { killedPid: number; backendPid: number; exitObserved: true };
export const PHASES = ['capture-before-commit', 'capture-after-commit', 'before-commit', 'after-commit', 'lease-claimed', 'external-created'] as const;
export type Phase = typeof PHASES[number];
export function assertHandshake(message: unknown, expected: { runId: string; nonce: string; phase: Phase; pid: number; resourceId: string }) {
  const row = message as Record<string, unknown>;
  if (!row || row['kind'] !== 'm5-recovery-barrier-v1' || row['runId'] !== expected.runId || row['nonce'] !== expected.nonce
    || row['phase'] !== expected.phase || row['pid'] !== expected.pid || row['resourceId'] !== expected.resourceId
    || !Number.isSafeInteger(row['backendPid']) || Number(row['backendPid']) < 1) throw new Error('M5_RECOVERY_HANDSHAKE');
  return Number(row['backendPid']);
}
export async function killAtBarrier(env: NodeJS.ProcessEnv, runId: string, phase: Phase, resourceId: string): Promise<KillProof> {
  runIdentity(runId);
  if (!PHASES.includes(phase) || !/^[A-Za-z0-9]{12}$/.test(resourceId)) throw new Error('M5_RECOVERY_CHILD_IDENTITY');
  const nonce = randomBytes(24).toString('hex');
  const child = spawn(process.execPath, ['--import', 'tsx', resolve(ROOT, 'scripts/m5/recovery-worker.ts'), runId, nonce, phase, resourceId],
    { cwd: ROOT, env, windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  return killAcknowledgedChild(child, { runId, nonce, phase, resourceId });
}
/** Accept only an actual ChildProcess handle, never a PID supplied by a caller. */
export async function killAcknowledgedChild(child: ChildProcess, expected: { runId: string; nonce: string; phase: Phase; resourceId: string }): Promise<KillProof> {
  const closed = once(child, 'close');
  // Attach rejection handler immediately if the executable itself fails.
  closed.catch(() => undefined);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const pid = child.pid;
    if (!Number.isSafeInteger(pid) || !pid) throw new Error('M5_RECOVERY_CHILD');
    const backendPid = await new Promise<number>((yes, no) => {
      timer = setTimeout(() => no(new Error('M5_RECOVERY_BARRIER_TIMEOUT')), 40_000);
      child.once('error', () => no(new Error('M5_RECOVERY_CHILD')));
      child.once('close', () => no(new Error('M5_RECOVERY_EARLY_EXIT')));
      child.once('message', message => {
        try { yes(assertHandshake(message, { ...expected, pid })); }
        catch (error) { no(error); }
      });
    });
    if (timer) clearTimeout(timer);
    if (!child.kill('SIGKILL')) throw new Error('M5_RECOVERY_KILL_FAILED');
    const [code, signal] = await Promise.race([closed, new Promise<never>((_yes, no) => {
      timer = setTimeout(() => no(new Error('M5_RECOVERY_EXIT_TIMEOUT')), 10_000);
    })]);
    if (code === 0 || (!signal && (code === null || code === undefined))) throw new Error('M5_RECOVERY_EXIT_NOT_OBSERVED');
    return { killedPid: pid, backendPid, exitObserved: true };
  } finally { if (timer) clearTimeout(timer); if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }
}
export async function eventually<T>(work: () => Promise<T>, predicate: (value: T) => boolean, timeoutMs = 15_000): Promise<T> {
  const started = performance.now();
  let last: T | undefined;
  do {
    try { last = await work(); if (predicate(last)) return last; } catch { /* Bounded recovery probe, never proof of success. */ }
    await new Promise(done => setTimeout(done, 200));
  } while (performance.now() - started < timeoutMs);
  throw new Error('M5_RECOVERY_CONDITION_TIMEOUT');
}
