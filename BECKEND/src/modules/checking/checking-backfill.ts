import mongoose, { Types } from 'mongoose';
import Checking from './Checking';
import Aluguel from '../alugueis/Aluguel';

export type CheckingBackfillOptions = {
  fix?: boolean;
  dryRun?: boolean;
  limit?: number;
};

export type CheckingBackfillRecord = {
  checkingId: string;
  aluguelId: string | null;
  empresaId: string | null;
  reason?: string;
};

export type CheckingBackfillReport = {
  mode: 'DRY_RUN' | 'FIX';
  scanned: number;
  wouldUpdate: number;
  updated: number;
  unresolved: CheckingBackfillRecord[];
  resolved: CheckingBackfillRecord[];
};

export async function runCheckingBackfill(options: CheckingBackfillOptions = {}): Promise<CheckingBackfillReport> {
  const fix = options.fix === true;
  const explicitDryRun = options.dryRun === true;
  if (fix && explicitDryRun) {
    throw new Error('Use either --fix or --dry-run, never both.');
  }

  const dryRun = !fix;
  const query = {
    $or: [
      { empresaId: { $exists: false } },
      { empresaId: null },
    ],
  };

  const cursor = Checking.find(query)
    .select('_id aluguelId empresaId')
    .limit(options.limit && options.limit > 0 ? options.limit : 0)
    .lean<any[]>()
    .cursor();

  const report: CheckingBackfillReport = {
    mode: dryRun ? 'DRY_RUN' : 'FIX',
    scanned: 0,
    wouldUpdate: 0,
    updated: 0,
    unresolved: [],
    resolved: [],
  };

  for await (const checking of cursor) {
    report.scanned += 1;
    const checkingId = String(checking._id);
    const aluguelId = checking.aluguelId ? String(checking.aluguelId) : null;

    if (!aluguelId || !Types.ObjectId.isValid(aluguelId)) {
      report.unresolved.push({ checkingId, aluguelId, empresaId: null, reason: 'INVALID_OR_MISSING_ALUGUEL_ID' });
      continue;
    }

    const aluguel = await Aluguel.findById(aluguelId).select('_id empresaId').lean<any>().exec();
    const empresaId = aluguel?.empresaId ? String(aluguel.empresaId) : null;

    if (!empresaId || !Types.ObjectId.isValid(empresaId)) {
      report.unresolved.push({ checkingId, aluguelId, empresaId, reason: 'ALUGUEL_WITHOUT_EMPRESA_ID' });
      continue;
    }

    report.wouldUpdate += 1;
    report.resolved.push({ checkingId, aluguelId, empresaId });

    if (!dryRun) {
      const result = await Checking.updateOne(
        { _id: checking._id, $or: [{ empresaId: { $exists: false } }, { empresaId: null }] },
        { $set: { empresaId: new Types.ObjectId(empresaId) } },
      ).exec();
      report.updated += result.modifiedCount;
    }
  }

  return report;
}

export async function connectForCheckingBackfill(mongoUri: string): Promise<void> {
  if (mongoose.connection.readyState !== 0) return;
  await mongoose.connect(mongoUri);
}
