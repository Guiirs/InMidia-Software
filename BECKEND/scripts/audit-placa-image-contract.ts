import 'dotenv/config';
import mongoose from 'mongoose';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import Placa from '@modules/placas/Placa';
import { resolvePlacaImageReference, getPlacaImageCandidates } from '@modules/public-plates/placa-image-key.resolver';
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
  const targetId = process.argv[2]?.trim() || '69b42002f5c3a35343097a2c';
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
  };

  console.log(JSON.stringify(output, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(JSON.stringify({ error: error.message }, null, 2));
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
