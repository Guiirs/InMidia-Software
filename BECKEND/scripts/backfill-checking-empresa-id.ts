#!/usr/bin/env ts-node
import path from 'path';
import { config } from 'dotenv';
import mongoose from 'mongoose';
import { connectForCheckingBackfill, runCheckingBackfill } from '../src/modules/checking/checking-backfill';

config({ path: path.resolve(__dirname, '../.env') });

const args = process.argv.slice(2);
const fix = args.includes('--fix');
const dryRun = args.includes('--dry-run') || args.includes('--dry');
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined;

async function main(): Promise<void> {
  if (fix && dryRun) {
    throw new Error('Abortado: use --fix ou --dry-run, nunca ambos.');
  }

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;
  if (!mongoUri) {
    throw new Error('MONGODB_URI / MONGO_URI / DATABASE_URL nao configurado.');
  }

  await connectForCheckingBackfill(mongoUri);

  const report = await runCheckingBackfill({ fix, dryRun, limit });
  console.log(JSON.stringify(report, null, 2));

  await mongoose.disconnect();

  if (report.unresolved.length > 0) {
    process.exitCode = 2;
  }
}

main().catch(async (error) => {
  console.error(`[checking-backfill] ${error instanceof Error ? error.message : String(error)}`);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
