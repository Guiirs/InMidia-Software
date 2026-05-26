import mongoose, { Model, Schema } from 'mongoose';

type ActivityDomain = 'commercial' | 'operations' | 'contracts' | 'alerts' | 'reports' | 'system';

type ActivityDoc = {
  _id: mongoose.Types.ObjectId;
  empresaId: string;
  domain: ActivityDomain;
  type: string;
  title: string;
  description?: string;
  entityId?: string;
  entityType?: string;
  actorId?: string;
  status?: string;
  payload: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
};

const activitySchema = new Schema<ActivityDoc>({
  empresaId:   { type: String, required: true, index: true },
  domain:      { type: String, required: true, index: true },
  type:        { type: String, required: true, index: true },
  title:       { type: String, required: true },
  description: { type: String },
  entityId:    { type: String },
  entityType:  { type: String },
  actorId:     { type: String },
  status:      { type: String, default: 'created' },
  payload:     { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true, collection: 'activity_v4_records' });

activitySchema.index({ empresaId: 1, domain: 1, createdAt: -1 });
activitySchema.index({ empresaId: 1, createdAt: -1 });

const ActivityRecord: Model<ActivityDoc> =
  (mongoose.models.ActivityV4Record as Model<ActivityDoc> | undefined)
  || mongoose.model<ActivityDoc>('ActivityV4Record', activitySchema);

function toActivityItem(doc: ActivityDoc, domainLabel?: string) {
  const id = String(doc._id);
  return {
    id,
    realId: id,
    domain: doc.domain,
    domainLabel: domainLabel ?? doc.domain,
    type: doc.type,
    title: doc.title,
    description: doc.description ?? null,
    entityId: doc.entityId ?? null,
    entityType: doc.entityType ?? null,
    actorId: doc.actorId ?? null,
    status: doc.status ?? 'created',
    payload: doc.payload ?? {},
    createdAt: doc.createdAt?.toISOString?.() ?? null,
    updatedAt: doc.updatedAt?.toISOString?.() ?? null,
  };
}

type RawDoc = {
  _id: mongoose.Types.ObjectId;
  empresaId: string;
  kind?: string;
  type?: string;
  domain?: string;
  title?: string;
  payload?: Record<string, unknown>;
  status?: string;
  createdAt?: Date;
};

function rawToFeedItem(doc: RawDoc, domain: ActivityDomain, fallbackType: string) {
  const id = String(doc._id);
  const payload = doc.payload ?? {};
  return {
    id,
    realId: id,
    domain,
    domainLabel: domain,
    type: doc.type ?? doc.kind ?? fallbackType,
    title: doc.title ?? (payload.title as string | undefined) ?? (payload.note as string | undefined) ?? fallbackType,
    description: (payload.description as string | undefined) ?? (payload.note as string | undefined) ?? null,
    entityId: id,
    entityType: doc.kind ?? fallbackType,
    actorId: null,
    status: doc.status ?? 'created',
    payload,
    createdAt: doc.createdAt?.toISOString?.() ?? null,
    updatedAt: null,
  };
}

export class ActivityV4Service {
  async getTimeline(empresaId: string) {
    const db = mongoose.connection;
    const limit = 100;

    const [nativeEvents, commercialActivities, operationsEvents] = await Promise.all([
      ActivityRecord
        .find({ empresaId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean<ActivityDoc[]>(),

      db.collection('commercial_v4_records')
        .find({ empresaId, kind: 'activity' })
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray() as Promise<RawDoc[]>,

      db.collection('operations_v4_records')
        .find({ empresaId, kind: 'event' })
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray() as Promise<RawDoc[]>,
    ]);

    const merged = [
      ...nativeEvents.map((d) => toActivityItem(d)),
      ...commercialActivities.map((d) => rawToFeedItem(d, 'commercial', 'commercial.activity')),
      ...operationsEvents.map((d) => rawToFeedItem(d, 'operations', 'operations.event')),
    ].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    }).slice(0, limit);

    return { events: merged, total: merged.length, cursor: null as string | null };
  }

  async getFeed(empresaId: string) {
    const events = await ActivityRecord
      .find({ empresaId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean<ActivityDoc[]>();

    return { items: events.map((d) => toActivityItem(d)), total: events.length };
  }

  async getAudit(empresaId: string) {
    const events = await ActivityRecord
      .find({ empresaId })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean<ActivityDoc[]>();

    return {
      entries: events.map((d) => toActivityItem(d)),
      total: events.length,
      generatedAt: new Date().toISOString(),
    };
  }

  async getByDomain(empresaId: string) {
    const db = mongoose.connection;

    const [nativeRecords, commercialActivities, operationsEvents] = await Promise.all([
      ActivityRecord.find({ empresaId }).lean<ActivityDoc[]>(),
      db.collection('commercial_v4_records').find({ empresaId, kind: 'activity' }).toArray() as Promise<RawDoc[]>,
      db.collection('operations_v4_records').find({ empresaId, kind: 'event' }).toArray() as Promise<RawDoc[]>,
    ]);

    const domainCounts: Record<string, { count: number; lastAt: string | null }> = {};

    function tally(domain: string, createdAt: Date | undefined) {
      domainCounts[domain] ??= { count: 0, lastAt: null };
      domainCounts[domain].count += 1;
      const iso = createdAt?.toISOString?.() ?? null;
      if (iso && (!domainCounts[domain].lastAt || iso > domainCounts[domain].lastAt!)) {
        domainCounts[domain].lastAt = iso;
      }
    }

    nativeRecords.forEach((d) => tally(d.domain, d.createdAt));
    commercialActivities.forEach((d) => tally('commercial', d.createdAt));
    operationsEvents.forEach((d) => tally('operations', d.createdAt));

    return { byDomain: domainCounts };
  }

  async createAuditEntry(
    empresaId: string,
    input: {
      domain: ActivityDomain;
      type: string;
      title: string;
      description?: string;
      entityId?: string;
      entityType?: string;
      actorId?: string;
      status?: string;
      payload?: Record<string, unknown>;
    },
  ) {
    const record = await ActivityRecord.create({
      empresaId,
      domain: input.domain ?? 'system',
      type: input.type ?? 'audit',
      title: input.title ?? 'Evento de auditoria',
      description: input.description,
      entityId: input.entityId,
      entityType: input.entityType,
      actorId: input.actorId,
      status: input.status ?? 'created',
      payload: input.payload ?? {},
    });
    return toActivityItem(record.toObject() as ActivityDoc);
  }
}
