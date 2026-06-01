import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const BACKUP_DIR = process.env.BACKUP_DIR ?? '/app/backups';
const BACKUP_RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS ?? '7', 10);
const BACKUP_OFFSITE_ENABLED = process.env.BACKUP_OFFSITE_ENABLED === 'true';
const BACKUP_PROVIDER = process.env.BACKUP_PROVIDER ?? 'local';

function getTimestamp(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('-');
}

function enforceRetention(justCreated: string): void {
  const cutoffMs = BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let removed = 0;

  const entries = fs.readdirSync(BACKUP_DIR);
  for (const entry of entries) {
    if (!entry.startsWith('inmidia-mongodb-backup-') || !entry.endsWith('.tar.gz')) continue;
    const filePath = path.join(BACKUP_DIR, entry);
    if (filePath === justCreated) continue;
    const stat = fs.statSync(filePath);
    if (now - stat.mtimeMs > cutoffMs) {
      fs.rmSync(filePath);
      console.log(`[backup] Removed old backup: ${entry}`);
      removed++;
    }
  }

  console.log(`[backup] Retention cleanup: ${removed} file(s) removed (older than ${BACKUP_RETENTION_DAYS} days).`);
}

function uploadOffsite(archivePath: string): void {
  // Future: implement S3/R2 upload using BACKUP_PROVIDER ('s3' | 'r2')
  // @aws-sdk/client-s3 is already available as a dependency
  console.log(`[backup] Offsite upload not yet implemented — provider="${BACKUP_PROVIDER}", archive="${archivePath}".`);
}

function runBackup(): void {
  if (!MONGODB_URI) {
    console.error('[backup] ERROR: MONGODB_URI environment variable is not set. Aborting.');
    process.exit(1);
  }

  const timestamp = getTimestamp();
  const backupName = `inmidia-mongodb-backup-${timestamp}`;
  const backupTmpDir = path.join(BACKUP_DIR, backupName);
  const backupArchive = path.join(BACKUP_DIR, `${backupName}.tar.gz`);
  const safeUri = MONGODB_URI.replace(/:[^:@]+@/, ':****@');

  console.log(`[backup] Starting MongoDB backup — ${timestamp}`);
  console.log(`[backup] Source:      ${safeUri}`);
  console.log(`[backup] Destination: ${BACKUP_DIR}`);
  console.log(`[backup] Retention:   ${BACKUP_RETENTION_DAYS} days`);

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.mkdirSync(backupTmpDir, { recursive: true });

  try {
    console.log('[backup] Running mongodump...');
    execSync(`mongodump --uri="${MONGODB_URI}" --out="${backupTmpDir}"`, { stdio: 'inherit' });

    console.log('[backup] Compressing archive...');
    execSync(`tar -czf "${backupArchive}" -C "${BACKUP_DIR}" "${backupName}"`, { stdio: 'inherit' });

    fs.rmSync(backupTmpDir, { recursive: true, force: true });

    console.log(`[backup] Backup created: ${backupArchive}`);

    enforceRetention(backupArchive);

    if (BACKUP_OFFSITE_ENABLED) {
      uploadOffsite(backupArchive);
    }

    console.log('[backup] Backup completed successfully.');
    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[backup] FAILED: ${message}`);
    if (fs.existsSync(backupTmpDir)) {
      fs.rmSync(backupTmpDir, { recursive: true, force: true });
    }
    process.exit(1);
  }
}

runBackup();
