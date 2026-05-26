import mongoose, { Model, Schema } from 'mongoose';
import AppError from '@shared/container/AppError';

type CommercialKind = 'opportunity' | 'proposal' | 'activity' | 'conversion';

type CommercialDoc = {
  _id: mongoose.Types.ObjectId;
  empresaId: string;
  kind: CommercialKind;
  payload: Record<string, unknown>;
  stage?: string;
  status?: string;
  value?: number;
  createdAt?: Date;
  updatedAt?: Date;
};

const commercialSchema = new Schema<CommercialDoc>({
  empresaId: { type: String, required: true, index: true },
  kind: { type: String, required: true, enum: ['opportunity', 'proposal', 'activity', 'conversion'], index: true },
  payload: { type: Schema.Types.Mixed, default: {} },
  stage: { type: String },
  status: { type: String },
  value: { type: Number, default: 0 },
}, { timestamps: true, collection: 'commercial_v4_records' });

commercialSchema.index({ empresaId: 1, kind: 1, createdAt: -1 });

const CommercialRecord: Model<CommercialDoc> = (mongoose.models.CommercialV4Record as Model<CommercialDoc> | undefined)
  || mongoose.model<CommercialDoc>('CommercialV4Record', commercialSchema);

function numberValue(input: unknown): number {
  const value = Number(input ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function docId(doc: CommercialDoc): string {
  return String(doc._id);
}

function toEntity(doc: CommercialDoc) {
  const payload = doc.payload ?? {};
  return {
    id: docId(doc),
    realId: docId(doc),
    ...payload,
    stage: doc.stage ?? (payload.stage as string | undefined),
    status: doc.status ?? (payload.status as string | undefined),
    value: doc.value ?? numberValue(payload.value),
    createdAt: doc.createdAt?.toISOString?.() ?? null,
    updatedAt: doc.updatedAt?.toISOString?.() ?? null,
  };
}

async function findTenantRecord(empresaId: string, id: string, kind?: CommercialKind): Promise<CommercialDoc> {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Registro comercial invalido.', 400);
  const query: Record<string, unknown> = { _id: id, empresaId };
  if (kind) query.kind = kind;
  const record = await CommercialRecord.findOne(query).lean<CommercialDoc>();
  if (!record) throw new AppError('Registro comercial nao encontrado.', 404);
  return record;
}

export class CommercialV4Service {
  async getPipeline(empresaId: string) {
    const opportunities = await CommercialRecord.find({ empresaId, kind: 'opportunity' }).lean<CommercialDoc[]>();
    const stages = new Map<string, { name: string; count: number; value: number }>();

    opportunities.forEach((item) => {
      const name = item.stage ?? 'lead';
      const current = stages.get(name) ?? { name, count: 0, value: 0 };
      current.count += 1;
      current.value += numberValue(item.value);
      stages.set(name, current);
    });

    const totalValue = opportunities.reduce((sum, item) => sum + numberValue(item.value), 0);
    const converted = await CommercialRecord.countDocuments({ empresaId, kind: 'conversion' });

    return {
      stages: Array.from(stages.values()),
      totalValue,
      count: opportunities.length,
      conversionRate: opportunities.length ? converted / opportunities.length : 0,
    };
  }

  async listOpportunities(empresaId: string) {
    const records = await CommercialRecord.find({ empresaId, kind: 'opportunity' }).sort({ createdAt: -1 }).lean<CommercialDoc[]>();
    return { opportunities: records.map(toEntity), total: records.length };
  }

  async listProposals(empresaId: string) {
    const records = await CommercialRecord.find({ empresaId, kind: 'proposal' }).sort({ createdAt: -1 }).lean<CommercialDoc[]>();
    return { proposals: records.map(toEntity), total: records.length };
  }

  async getConversions(empresaId: string) {
    const records = await CommercialRecord.find({ empresaId, kind: 'conversion' }).sort({ createdAt: -1 }).lean<CommercialDoc[]>();
    const opportunityCount = await CommercialRecord.countDocuments({ empresaId, kind: 'opportunity' });
    return {
      conversions: records.map(toEntity),
      total: records.length,
      rate: opportunityCount ? records.length / opportunityCount : 0,
    };
  }

  async listActivities(empresaId: string) {
    const records = await CommercialRecord.find({ empresaId, kind: 'activity' }).sort({ createdAt: -1 }).lean<CommercialDoc[]>();
    return { activities: records.map(toEntity), total: records.length };
  }

  async createOpportunity(empresaId: string, input: Record<string, unknown>) {
    const record = await CommercialRecord.create({
      empresaId,
      kind: 'opportunity',
      payload: input,
      stage: String(input.stage ?? input.status ?? 'lead'),
      status: String(input.status ?? input.stage ?? 'lead'),
      value: numberValue(input.value),
    });
    return toEntity(record.toObject() as CommercialDoc);
  }

  async updateOpportunity(empresaId: string, id: string, input: Record<string, unknown>) {
    const current = await findTenantRecord(empresaId, id, 'opportunity');
    const nextPayload = { ...current.payload, ...input };
    const updated = await CommercialRecord.findOneAndUpdate(
      { _id: id, empresaId, kind: 'opportunity' },
      {
        $set: {
          payload: nextPayload,
          stage: String(input.stage ?? input.status ?? current.stage ?? 'lead'),
          status: String(input.status ?? input.stage ?? current.status ?? 'lead'),
          value: input.value !== undefined ? numberValue(input.value) : numberValue(current.value),
        },
      },
      { new: true },
    ).lean<CommercialDoc>();
    if (!updated) throw new AppError('Oportunidade nao encontrada.', 404);
    return toEntity(updated);
  }

  async changeOpportunityStage(empresaId: string, id: string, stage: string) {
    const current = await findTenantRecord(empresaId, id, 'opportunity');
    const updated = await CommercialRecord.findOneAndUpdate(
      { _id: id, empresaId, kind: 'opportunity' },
      { $set: { stage, status: stage, payload: { ...current.payload, stage, status: stage } } },
      { new: true },
    ).lean<CommercialDoc>();
    if (!updated) throw new AppError('Oportunidade nao encontrada.', 404);
    return toEntity(updated);
  }

  async createProposal(empresaId: string, input: Record<string, unknown>) {
    const record = await CommercialRecord.create({
      empresaId,
      kind: 'proposal',
      payload: input,
      status: String(input.status ?? 'draft'),
      value: numberValue(input.value),
    });
    return toEntity(record.toObject() as CommercialDoc);
  }

  async updateProposal(empresaId: string, id: string, input: Record<string, unknown>) {
    const current = await findTenantRecord(empresaId, id, 'proposal');
    const updated = await CommercialRecord.findOneAndUpdate(
      { _id: id, empresaId, kind: 'proposal' },
      {
        $set: {
          payload: { ...current.payload, ...input },
          status: String(input.status ?? current.status ?? 'draft'),
          value: input.value !== undefined ? numberValue(input.value) : numberValue(current.value),
        },
      },
      { new: true },
    ).lean<CommercialDoc>();
    if (!updated) throw new AppError('Proposta nao encontrada.', 404);
    return toEntity(updated);
  }

  async convertProposal(empresaId: string, id: string, input: Record<string, unknown>) {
    const proposal = await findTenantRecord(empresaId, id, 'proposal');
    const updated = await CommercialRecord.findOneAndUpdate(
      { _id: id, empresaId, kind: 'proposal' },
      { $set: { status: 'converted', payload: { ...proposal.payload, ...input, status: 'converted' } } },
      { new: true },
    ).lean<CommercialDoc>();
    const conversion = await CommercialRecord.create({
      empresaId,
      kind: 'conversion',
      payload: { proposalId: id, proposal: updated ? toEntity(updated) : toEntity(proposal), ...input },
      status: 'converted',
      value: numberValue(proposal.value),
    });
    return {
      proposal: updated ? toEntity(updated) : toEntity(proposal),
      conversion: toEntity(conversion.toObject() as CommercialDoc),
    };
  }

  async createActivity(empresaId: string, input: Record<string, unknown>) {
    const record = await CommercialRecord.create({
      empresaId,
      kind: 'activity',
      payload: input,
      status: String(input.status ?? 'created'),
    });
    return toEntity(record.toObject() as CommercialDoc);
  }
}
