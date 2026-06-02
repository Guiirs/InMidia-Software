import 'dotenv/config';
import mongoose from 'mongoose';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import Placa from '@modules/placas/Placa';
import {
  getPlacaImageCandidates,
  normalizePlacaStorageKey,
  resolvePlacaGalleryReferences,
  resolvePlacaImageReference,
} from '@modules/media/placa-image-reference.resolver';
import { getR2BucketName, getR2Client } from '@shared/infra/storage/r2-client';

type AuditResult = {
  placaId: string;
  codigo: string | null;
  empresaId: string | null;
  fields: Record<string, unknown>;
  resolved: ReturnType<typeof resolvePlacaImageReference>;
  storage: {
    bucket: string;
    exists: boolean;
    statusCode: number | null;
    contentType: string | null;
    contentLength: number | null;
    errorName: string | null;
  };
};

type AuditIssueType =
  | 'ORPHAN_IMAGE'
  | 'INVALID_STORAGE_KEY'
  | 'DUPLICATE_REFERENCE'
  | 'MAIN_IMAGE_CONFLICT';

type AuditIssue = {
  type: AuditIssueType;
  placaId: string;
  codigo: string | null;
  empresaId: string | null;
  details: Record<string, unknown>;
};

function pickImageFields(doc: any): Record<string, unknown> {
  return {
    mainImageUrl: doc.mainImageUrl ?? null,
    imagemPrincipal: doc.imagemPrincipal ?? null,
    imagem: doc.imagem ?? null,
    foto: doc.foto ?? null,
    imageUrl: doc.imageUrl ?? null,
    fotoUrl: doc.fotoUrl ?? null,
    storageKey: doc.storageKey ?? null,
    imagemKey: doc.imagemKey ?? null,
    r2Key: doc.r2Key ?? null,
    imagens: Array.isArray(doc.imagens)
      ? doc.imagens.map((image: any) => ({
          id: image.id ?? image._id?.toString?.() ?? null,
          isMain: image.isMain ?? null,
          category: image.category ?? null,
          url: image.url ?? null,
          publicUrl: image.publicUrl ?? null,
          key: image.key ?? null,
          storageKey: image.storageKey ?? null,
          imagemKey: image.imagemKey ?? null,
          r2Key: image.r2Key ?? null,
        }))
      : null,
  };
}

async function headStorage(storageKey: string | null) {
  const bucket = getR2BucketName();
  const client = getR2Client();
  if (!storageKey || !bucket || !client) {
    return {
      bucket,
      exists: false,
      statusCode: null,
      contentType: null,
      contentLength: null,
      errorName: !storageKey ? 'NO_STORAGE_KEY' : 'R2_UNAVAILABLE',
    };
  }

  try {
    const result = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: storageKey }));
    return {
      bucket,
      exists: true,
      statusCode: result.$metadata.httpStatusCode ?? 200,
      contentType: result.ContentType ?? null,
      contentLength: result.ContentLength ?? null,
      errorName: null,
    };
  } catch (error: any) {
    return {
      bucket,
      exists: false,
      statusCode: error?.$metadata?.httpStatusCode ?? null,
      contentType: null,
      contentLength: null,
      errorName: error?.name ?? 'UnknownError',
    };
  }
}

async function auditDoc(doc: any): Promise<AuditResult> {
  const resolved = resolvePlacaImageReference(doc);
  const storage = await headStorage(resolved.storageKey);
  return {
    placaId: String(doc._id),
    codigo: doc.numero_placa ?? doc.codigo ?? null,
    empresaId: doc.empresaId ? String(doc.empresaId) : null,
    fields: pickImageFields(doc),
    resolved,
    storage,
  };
}

function docIdentity(doc: any) {
  return {
    placaId: String(doc._id),
    codigo: doc.numero_placa ?? doc.codigo ?? null,
    empresaId: doc.empresaId ? String(doc.empresaId) : null,
  };
}

function directFieldKeys(doc: any): Record<string, string | null> {
  return {
    mainImageUrl: normalizePlacaStorageKey(doc.mainImageUrl),
    imagemPrincipal: normalizePlacaStorageKey(doc.imagemPrincipal),
    imagem: normalizePlacaStorageKey(doc.imagem),
    foto: normalizePlacaStorageKey(doc.foto),
    imageUrl: normalizePlacaStorageKey(doc.imageUrl),
    fotoUrl: normalizePlacaStorageKey(doc.fotoUrl),
    storageKey: normalizePlacaStorageKey(doc.storageKey),
    imagemKey: normalizePlacaStorageKey(doc.imagemKey),
    r2Key: normalizePlacaStorageKey(doc.r2Key),
  };
}

function buildStaticIssues(doc: any): AuditIssue[] {
  const identity = docIdentity(doc);
  const issues: AuditIssue[] = [];
  const candidates = getPlacaImageCandidates(doc as any);
  const validByField = new Map<string, string>();

  for (const candidate of candidates) {
    const raw = typeof candidate.value === 'string' ? candidate.value.trim() : '';
    if (!raw) continue;
    const key = normalizePlacaStorageKey(raw);
    if (!key) {
      issues.push({
        type: 'INVALID_STORAGE_KEY',
        ...identity,
        details: { sourceField: candidate.field, value: raw },
      });
      continue;
    }
    validByField.set(candidate.field, key);
  }

  const fieldsByKey = new Map<string, string[]>();
  validByField.forEach((key, field) => {
    fieldsByKey.set(key, [...(fieldsByKey.get(key) ?? []), field]);
  });
  fieldsByKey.forEach((fields, storageKey) => {
    if (fields.length > 1) {
      issues.push({
        type: 'DUPLICATE_REFERENCE',
        ...identity,
        details: { storageKey, fields },
      });
    }
  });

  const direct = directFieldKeys(doc);
  if (direct.imagem && direct.imagemPrincipal && direct.imagem !== direct.imagemPrincipal) {
    issues.push({
      type: 'MAIN_IMAGE_CONFLICT',
      ...identity,
      details: {
        imagem: direct.imagem,
        imagemPrincipal: direct.imagemPrincipal,
      },
    });
  }

  const galleryMainKeys = resolvePlacaGalleryReferences(doc)
    .filter((image) => image.isMain && image.storageKey)
    .map((image) => image.storageKey);
  const uniqueGalleryMainKeys = [...new Set(galleryMainKeys)];
  if (direct.imagemPrincipal && uniqueGalleryMainKeys.length > 0 && !uniqueGalleryMainKeys.includes(direct.imagemPrincipal)) {
    issues.push({
      type: 'MAIN_IMAGE_CONFLICT',
      ...identity,
      details: {
        imagemPrincipal: direct.imagemPrincipal,
        galleryMainKeys: uniqueGalleryMainKeys,
      },
    });
  }

  return issues;
}

async function auditBrokenReferences(limit: number): Promise<AuditIssue[]> {
  const issues: AuditIssue[] = [];
  const cursor = Placa.find({
    statusOperacional: { $ne: 'ARCHIVED' },
    $or: [
      { imagemPrincipal: { $type: 'string', $ne: '' } },
      { imagem: { $type: 'string', $ne: '' } },
      { mainImageUrl: { $type: 'string', $ne: '' } },
      { imageUrl: { $type: 'string', $ne: '' } },
      { imagens: { $elemMatch: { $or: [{ key: { $type: 'string', $ne: '' } }, { storageKey: { $type: 'string', $ne: '' } }, { url: { $type: 'string', $ne: '' } }] } } },
    ],
  })
    .select('_id empresaId numero_placa codigo mainImageUrl imagemPrincipal imagem imagens foto imageUrl fotoUrl storageKey imagemKey r2Key statusOperacional updatedAt')
    .lean()
    .cursor();

  for await (const doc of cursor) {
    issues.push(...buildStaticIssues(doc));

    const resolved = resolvePlacaImageReference(doc as any);
    if (resolved.storageKey) {
      const storage = await headStorage(resolved.storageKey);
      if (!storage.exists) {
        issues.push({
          type: 'ORPHAN_IMAGE',
          ...docIdentity(doc),
          details: {
            storageKey: resolved.storageKey,
            sourceField: resolved.sourceField,
            storage,
          },
        });
      }
    }

    if (issues.length >= limit) break;
  }

  return issues.slice(0, limit);
}

async function findControlWorking(excludeId: string | null): Promise<any | null> {
  const cursor = Placa.find({
    ...(excludeId ? { _id: { $ne: new mongoose.Types.ObjectId(excludeId) } } : {}),
    statusOperacional: { $ne: 'ARCHIVED' },
    $or: [
      { imagemPrincipal: { $type: 'string', $ne: '' } },
      { imagem: { $type: 'string', $ne: '' } },
      { imagens: { $elemMatch: { $or: [{ key: { $type: 'string', $ne: '' } }, { storageKey: { $type: 'string', $ne: '' } }, { url: { $type: 'string', $ne: '' } }] } } },
    ],
  })
    .select('_id empresaId numero_placa codigo mainImageUrl imagemPrincipal imagem imagens foto imageUrl fotoUrl storageKey imagemKey r2Key statusOperacional updatedAt')
    .lean()
    .cursor();

  for await (const doc of cursor) {
    const resolved = resolvePlacaImageReference(doc as any);
    if (!resolved.storageKey) continue;
    const storage = await headStorage(resolved.storageKey);
    if (storage.exists) return doc;
  }

  return null;
}

async function findBrokenWithMissingStorage(excludeIds: string[]): Promise<any | null> {
  const excludedObjectIds = excludeIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  const cursor = Placa.find({
    ...(excludedObjectIds.length ? { _id: { $nin: excludedObjectIds } } : {}),
    statusOperacional: { $ne: 'ARCHIVED' },
    $or: [
      { imagemPrincipal: { $type: 'string', $ne: '' } },
      { imagem: { $type: 'string', $ne: '' } },
      { imagens: { $elemMatch: { $or: [{ key: { $type: 'string', $ne: '' } }, { storageKey: { $type: 'string', $ne: '' } }, { url: { $type: 'string', $ne: '' } }] } } },
    ],
  })
    .select('_id empresaId numero_placa codigo mainImageUrl imagemPrincipal imagem imagens foto imageUrl fotoUrl storageKey imagemKey r2Key statusOperacional updatedAt')
    .lean()
    .cursor();

  for await (const doc of cursor) {
    const resolved = resolvePlacaImageReference(doc as any);
    if (!resolved.storageKey) continue;
    const storage = await headStorage(resolved.storageKey);
    if (!storage.exists) return doc;
  }

  return null;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const targetId = process.argv.find((arg) => /^[a-f0-9]{24}$/i.test(arg)) ?? '69b42002f5c3a35343097a2c';
  const fullAudit = args.has('--all') || args.has('--scan');
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const limit = Math.max(1, Number(limitArg?.split('=')[1] ?? 100));
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI ausente.');

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });

  const target = await Placa.findOne({ _id: targetId })
    .select('_id empresaId numero_placa codigo mainImageUrl imagemPrincipal imagem imagens foto imageUrl fotoUrl storageKey imagemKey r2Key statusOperacional updatedAt')
    .lean();
  const control = await findControlWorking(mongoose.Types.ObjectId.isValid(targetId) ? targetId : null);
  const broken = await findBrokenWithMissingStorage([
    targetId,
    control ? String((control as any)._id) : '',
  ]);

  const output = {
    target: target ? await auditDoc(target) : null,
    controlWorking: control ? await auditDoc(control) : null,
    brokenMissingStorage: broken ? await auditDoc(broken) : null,
    targetCandidates: target ? getPlacaImageCandidates(target as any).map((candidate) => candidate.field) : [],
    issues: fullAudit ? await auditBrokenReferences(limit) : target ? buildStaticIssues(target) : [],
  };

  console.log(JSON.stringify(output, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(JSON.stringify({ error: error.message }, null, 2));
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
