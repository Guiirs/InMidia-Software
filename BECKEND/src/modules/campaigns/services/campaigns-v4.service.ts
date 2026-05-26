import mongoose, { Model, Schema } from 'mongoose';
import AppError from '@shared/container/AppError';

type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';

type CampaignDoc = {
  _id: mongoose.Types.ObjectId;
  empresaId: string;
  name: string;
  status: CampaignStatus;
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  target?: string;
  description?: string;
  boards?: string[];
  regions?: string[];
  payload: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
};

const campaignSchema = new Schema<CampaignDoc>({
  empresaId:   { type: String, required: true, index: true },
  name:        { type: String, required: true },
  status:      { type: String, enum: ['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled'], default: 'draft', index: true },
  startDate:   { type: Date },
  endDate:     { type: Date },
  budget:      { type: Number },
  target:      { type: String },
  description: { type: String },
  boards:      { type: [String], default: [] },
  regions:     { type: [String], default: [] },
  payload:     { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true, collection: 'campaigns_v4_records' });

campaignSchema.index({ empresaId: 1, status: 1, createdAt: -1 });
campaignSchema.index({ empresaId: 1, startDate: 1 });

const CampaignRecord: Model<CampaignDoc> = (mongoose.models.CampaignV4Record as Model<CampaignDoc> | undefined)
  || mongoose.model<CampaignDoc>('CampaignV4Record', campaignSchema);

function toCampaign(doc: CampaignDoc) {
  const id = String(doc._id);
  return {
    id,
    realId: id,
    name:        doc.name,
    status:      doc.status,
    startDate:   doc.startDate?.toISOString?.() ?? null,
    endDate:     doc.endDate?.toISOString?.() ?? null,
    budget:      doc.budget ?? null,
    target:      doc.target ?? null,
    description: doc.description ?? null,
    boards:      doc.boards ?? [],
    regions:     doc.regions ?? [],
    payload:     doc.payload ?? {},
    createdAt:   doc.createdAt?.toISOString?.() ?? null,
    updatedAt:   doc.updatedAt?.toISOString?.() ?? null,
  };
}

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

async function findCampaign(empresaId: string, id: string): Promise<CampaignDoc> {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Campanha inválida.', 400);
  const campaign = await CampaignRecord.findOne({ _id: id, empresaId }).lean<CampaignDoc>();
  if (!campaign) throw new AppError('Campanha não encontrada.', 404);
  return campaign;
}

export class CampaignsV4Service {
  async getSummary(empresaId: string) {
    const [total, active, scheduled, paused, draft] = await Promise.all([
      CampaignRecord.countDocuments({ empresaId }),
      CampaignRecord.countDocuments({ empresaId, status: 'active' }),
      CampaignRecord.countDocuments({ empresaId, status: 'scheduled' }),
      CampaignRecord.countDocuments({ empresaId, status: 'paused' }),
      CampaignRecord.countDocuments({ empresaId, status: 'draft' }),
    ]);
    return {
      total,
      active,
      scheduled,
      paused,
      draft,
      completed: await CampaignRecord.countDocuments({ empresaId, status: 'completed' }),
      generatedAt: new Date().toISOString(),
    };
  }

  async listCampaigns(empresaId: string) {
    const campaigns = await CampaignRecord.find({ empresaId }).sort({ createdAt: -1 }).lean<CampaignDoc[]>();
    return { campaigns: campaigns.map(toCampaign), total: campaigns.length };
  }

  async getActive(empresaId: string) {
    const campaigns = await CampaignRecord.find({ empresaId, status: 'active' }).sort({ startDate: 1 }).lean<CampaignDoc[]>();
    return { campaigns: campaigns.map(toCampaign), count: campaigns.length };
  }

  async getScheduled(empresaId: string) {
    const now = new Date();
    const campaigns = await CampaignRecord
      .find({ empresaId, status: 'scheduled', startDate: { $gte: now } })
      .sort({ startDate: 1 })
      .lean<CampaignDoc[]>();
    return { campaigns: campaigns.map(toCampaign), count: campaigns.length };
  }

  async getPerformance(empresaId: string) {
    const all = await CampaignRecord.find({ empresaId, status: { $in: ['active', 'completed'] } }).lean<CampaignDoc[]>();
    const byStatus = all.reduce<Record<string, number>>((acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    }, {});
    return {
      totalTracked: all.length,
      byStatus,
      activeBudget: all
        .filter((c) => c.status === 'active')
        .reduce((sum, c) => sum + (c.budget ?? 0), 0),
      generatedAt: new Date().toISOString(),
    };
  }

  async createCampaign(empresaId: string, input: Record<string, unknown>) {
    if (!input.name) throw new AppError('Nome da campanha é obrigatório.', 400);
    const record = await CampaignRecord.create({
      empresaId,
      name:        String(input.name),
      status:      (input.status as CampaignStatus) ?? 'draft',
      startDate:   toDate(input.startDate),
      endDate:     toDate(input.endDate),
      budget:      input.budget !== undefined ? Number(input.budget) : undefined,
      target:      input.target ? String(input.target) : undefined,
      description: input.description ? String(input.description) : undefined,
      boards:      Array.isArray(input.boards) ? input.boards.map(String) : [],
      regions:     Array.isArray(input.regions) ? input.regions.map(String) : [],
      payload:     input,
    });
    return toCampaign(record.toObject() as CampaignDoc);
  }

  async updateCampaign(empresaId: string, id: string, input: Record<string, unknown>) {
    const current = await findCampaign(empresaId, id);
    const updated = await CampaignRecord.findOneAndUpdate(
      { _id: id, empresaId },
      {
        $set: {
          name:        input.name !== undefined ? String(input.name) : current.name,
          status:      input.status !== undefined ? (input.status as CampaignStatus) : current.status,
          startDate:   input.startDate !== undefined ? toDate(input.startDate) : current.startDate,
          endDate:     input.endDate !== undefined ? toDate(input.endDate) : current.endDate,
          budget:      input.budget !== undefined ? Number(input.budget) : current.budget,
          target:      input.target !== undefined ? String(input.target) : current.target,
          description: input.description !== undefined ? String(input.description) : current.description,
          boards:      Array.isArray(input.boards) ? input.boards.map(String) : current.boards,
          regions:     Array.isArray(input.regions) ? input.regions.map(String) : current.regions,
          payload:     { ...current.payload, ...input },
        },
      },
      { new: true },
    ).lean<CampaignDoc>();
    if (!updated) throw new AppError('Campanha não encontrada.', 404);
    return toCampaign(updated);
  }

  async pauseCampaign(empresaId: string, id: string) {
    await findCampaign(empresaId, id);
    const updated = await CampaignRecord.findOneAndUpdate(
      { _id: id, empresaId },
      { $set: { status: 'paused' } },
      { new: true },
    ).lean<CampaignDoc>();
    if (!updated) throw new AppError('Campanha não encontrada.', 404);
    return toCampaign(updated);
  }

  async activateCampaign(empresaId: string, id: string) {
    await findCampaign(empresaId, id);
    const updated = await CampaignRecord.findOneAndUpdate(
      { _id: id, empresaId },
      { $set: { status: 'active' } },
      { new: true },
    ).lean<CampaignDoc>();
    if (!updated) throw new AppError('Campanha não encontrada.', 404);
    return toCampaign(updated);
  }

  async deleteCampaign(empresaId: string, id: string) {
    await findCampaign(empresaId, id);
    await CampaignRecord.deleteOne({ _id: id, empresaId });
    return { deleted: true, id };
  }
}
