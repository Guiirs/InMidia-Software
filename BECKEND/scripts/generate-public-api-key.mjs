/**
 * Dev tool: generate a valid public API key and seed it into the database.
 *
 * Usage (local dev only):
 *   node scripts/generate-public-api-key.mjs [empresa-id-or-cnpj]
 *
 * What it does:
 *   1. Connects to MongoDB (uses MONGODB_URI from .env)
 *   2. Finds the target Empresa (first one found if no arg given)
 *   3. Generates a random prefix + secret
 *   4. Bcrypt-hashes the secret and writes api_key_prefix + api_key_hash to the Empresa
 *   5. Prints the full key (prefix_secret) to stdout — copy it to test requests
 *
 * Security:
 *   - Secret is never stored anywhere — only the hash goes to MongoDB
 *   - Do NOT commit the printed key value — it is ephemeral
 *   - In production, key rotation is done through the admin UI (not this script)
 */

import crypto from 'crypto';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Load .env manually (no dotenv dep needed for a simple script)
try {
  const envPath = resolve(__dirname, '../.env');
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env not found — rely on environment variables already set
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI is not set. Check your .env file.');
  process.exit(1);
}

const { default: mongoose } = await import('mongoose');

const EmpresaSchema = new mongoose.Schema({
  nome: String,
  cnpj: String,
  ativo: Boolean,
  api_key_prefix: String,
  api_key_hash: String,
  api_key_last_used_at: Date,
}, { strict: false });

const Empresa = mongoose.models.Empresa || mongoose.model('Empresa', EmpresaSchema, 'empresas');

const { default: bcrypt } = await import('bcryptjs');

async function main() {
  await mongoose.connect(MONGODB_URI);

  const filterArg = process.argv[2];
  let empresa;

  if (filterArg) {
    empresa = await Empresa.findOne({
      $or: [
        { cnpj: filterArg },
        { _id: filterArg.match(/^[0-9a-f]{24}$/i) ? filterArg : null },
      ],
    });
    if (!empresa) {
      console.error(`ERROR: Empresa not found for filter: ${filterArg}`);
      process.exit(1);
    }
  } else {
    empresa = await Empresa.findOne().sort({ createdAt: 1 });
    if (!empresa) {
      console.error('ERROR: No empresa found in the database.');
      process.exit(1);
    }
  }

  // Generate key: prefix is short and human-readable; secret is high-entropy random
  const prefix  = `pub_${crypto.randomBytes(4).toString('hex')}`;
  // Keep the secret delimiter-safe because the runtime parser splits on the
  // last "_" to separate prefix and secret.
  const secret  = crypto.randomBytes(24).toString('hex');
  const hash    = await bcrypt.hash(secret, 10);
  const fullKey = `${prefix}_${secret}`;

  await Empresa.findByIdAndUpdate(empresa._id, {
    $set: {
      api_key_prefix: prefix,
      api_key_hash:   hash,
    },
  });

  console.log('\n✅ Public API key generated and saved to database\n');
  console.log(`  Empresa  : ${empresa.nome} (${empresa._id})`);
  console.log(`  Prefix   : ${prefix}`);
  console.log(`  Full key : ${fullKey}`);
  console.log('\nTest with:');
  console.log(`  curl -H "x-api-key: ${fullKey}" http://localhost:4000/public/v1/inventory`);
  console.log('\n⚠️  This key is NOT stored anywhere — save it now if you need it again.\n');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
