#!/usr/bin/env ts-node
import 'dotenv/config';
import mongoose, { Types } from 'mongoose';
import Placa from '@modules/placas/Placa';
import {
  normalizePlateName,
  PLATE_NORMALIZED_NAME_INDEX,
} from '@modules/placas/utils/plate-name.utils';

export interface PlateNormalizedNameDivergence {
  _id: string;
  empresaId: string;
  numeroPlaca: string;
  before: string | null;
  after: string;
}

export interface PlateNormalizedNameConflict {
  empresaId: string;
  numeroPlacaNormalizado: string;
  plates: Array<{ _id: string; numeroPlaca: string; archivedAt: string | null }>;
}

export interface ReconcilePlateNormalizedNamesReport {
  totalAnalyzed: number;
  divergent: number;
  fixed: number;
  conflicts: PlateNormalizedNameConflict[];
  errors: number;
  indexCreated: boolean;
  divergences: PlateNormalizedNameDivergence[];
}

export interface RunOptions {
  fix?: boolean;
  createIndex?: boolean;
  empresaId?: string;
  limit?: number;
}

export function diffPlateNormalizedName(doc: Record<string, unknown>): PlateNormalizedNameDivergence | null {
  const after = normalizePlateName(doc.numero_placa);
  const before = typeof doc.numeroPlacaNormalizado === 'string' ? doc.numeroPlacaNormalizado : null;
  if (before === after) return null;

  return {
    _id: String(doc._id),
    empresaId: String(doc.empresaId),
    numeroPlaca: String(doc.numero_placa ?? ''),
    before,
    after,
  };
}

export async function reconcilePlateNormalizedNames(
  options: RunOptions = {},
): Promise<ReconcilePlateNormalizedNamesReport> {
  if (options.createIndex && (options.empresaId || options.limit)) {
    throw new Error('A criacao do indice exige auditoria global, sem --empresa ou --limit.');
  }

  const filter: Record<string, unknown> = {};
  if (options.empresaId) filter.empresaId = new Types.ObjectId(options.empresaId);

  let query = Placa.find(filter)
    .select('_id empresaId numero_placa numeroPlacaNormalizado archivedAt')
    .lean();
  if (options.limit) query = query.limit(options.limit);

  const docs = await query.exec();
  const divergences = docs
    .map((doc) => diffPlateNormalizedName(doc as Record<string, unknown>))
    .filter((item): item is PlateNormalizedNameDivergence => Boolean(item));

  const groups = new Map<string, PlateNormalizedNameConflict>();
  for (const doc of docs as any[]) {
    const normalized = normalizePlateName(doc.numero_placa);
    const key = `${String(doc.empresaId)}\u0000${normalized}`;
    const group = groups.get(key) ?? {
      empresaId: String(doc.empresaId),
      numeroPlacaNormalizado: normalized,
      plates: [],
    };
    group.plates.push({
      _id: String(doc._id),
      numeroPlaca: String(doc.numero_placa ?? ''),
      archivedAt: doc.archivedAt ? new Date(doc.archivedAt).toISOString() : null,
    });
    groups.set(key, group);
  }

  const conflicts = [...groups.values()].filter((group) => group.plates.length > 1);
  const report: ReconcilePlateNormalizedNamesReport = {
    totalAnalyzed: docs.length,
    divergent: divergences.length,
    fixed: 0,
    conflicts,
    errors: 0,
    indexCreated: false,
    divergences,
  };

  if ((options.fix || options.createIndex) && conflicts.length > 0) {
    report.errors = conflicts.length;
    return report;
  }

  if (options.fix) {
    for (const divergence of divergences) {
      try {
        await Placa.collection.updateOne(
          { _id: new Types.ObjectId(divergence._id), empresaId: new Types.ObjectId(divergence.empresaId) },
          { $set: { numeroPlacaNormalizado: divergence.after } },
        );
        report.fixed++;
      } catch {
        report.errors++;
      }
    }
  }

  if (options.createIndex && report.errors === 0) {
    const remaining = await Placa.countDocuments({
      ...filter,
      $or: [
        { numeroPlacaNormalizado: { $exists: false } },
        { numeroPlacaNormalizado: null },
        { numeroPlacaNormalizado: '' },
      ],
    });
    if (remaining > 0) {
      report.errors += remaining;
      return report;
    }

    await Placa.collection.createIndex(
      { empresaId: 1, numeroPlacaNormalizado: 1 },
      { unique: true, name: PLATE_NORMALIZED_NAME_INDEX },
    );
    report.indexCreated = true;
  }

  return report;
}

function printReport(report: ReconcilePlateNormalizedNamesReport, options: RunOptions) {
  console.log('');
  console.log('-- reconcile:placa-normalized-names --');
  console.log(`Total analisado: ${report.totalAnalyzed}`);
  console.log(`Divergentes:     ${report.divergent}`);
  console.log(`Corrigidos:      ${report.fixed}${options.fix ? '' : ' (dry-run)'}`);
  console.log(`Conflitos:       ${report.conflicts.length}`);
  console.log(`Erros:           ${report.errors}`);
  console.log(`Indice criado:   ${report.indexCreated ? 'sim' : 'nao'}`);

  for (const conflict of report.conflicts) {
    console.log(`  conflito empresa=${conflict.empresaId} normalizado=${JSON.stringify(conflict.numeroPlacaNormalizado)}`);
    for (const plate of conflict.plates) {
      console.log(`    - ${plate._id}: ${JSON.stringify(plate.numeroPlaca)} archivedAt=${plate.archivedAt ?? 'nao'}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const empresaArg = args.find((arg) => arg.startsWith('--empresa='));
  const limitArg = args.find((arg) => arg.startsWith('--limit='));
  const options: RunOptions = {
    fix: args.includes('--fix'),
    createIndex: args.includes('--create-index'),
    empresaId: empresaArg?.split('=')[1],
    limit: limitArg ? Math.max(1, Number.parseInt(limitArg.split('=')[1]!, 10)) : undefined,
  };

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/inmidia';
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10_000, autoIndex: false });
  try {
    const report = await reconcilePlateNormalizedNames(options);
    printReport(report, options);
    if (report.errors > 0) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[reconcile-placa-normalized-names] erro fatal:', error);
    process.exit(1);
  });
}
