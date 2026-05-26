/**
 * Script Runner Service
 * Executor de scripts do sistema
 */
import { spawn } from 'child_process';
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
import logger from '../../../shared/container/logger';

interface RunScriptOptions {
  args?: string[];
  background?: boolean;
  env?: Record<string, string>;
}

const SCRIPTS_DIR = path.join(__dirname, '..', 'scripts');
const LOGS_DIR = path.join(__dirname, '..', 'logs', 'scripts');

async function ensureLogsDir() {
  if (!fsSync.existsSync(LOGS_DIR)) {
    await fs.mkdir(LOGS_DIR, { recursive: true });
  }
}

/**
 * Runs a script located under the `scripts/` folder.
 * scriptRelativePath: e.g. 'conversion/test_excel_to_pdf.js' or 'template-tools/add_placeholders.ps1'
 * options: { args: Array<string>, background: boolean, env: Object }
 */
async function runScript(scriptRelativePath: string, options: RunScriptOptions = {}) {
  await ensureLogsDir();

  const { args = [], background = false, env = {} } = options;

  // Normalize and prevent path traversal
  const normalized = path.normalize(scriptRelativePath).replace(/^\.\.[/\\]/, '');
  const scriptPath = path.join(SCRIPTS_DIR, normalized);

  if (!fsSync.existsSync(scriptPath)) {
    const msg = `Script não encontrado: ${scriptPath}`;
    logger.error(msg);
    throw new Error(msg);
  }

  const ext = path.extname(scriptPath).toLowerCase();

  let cmd;
  let cmdArgs = [];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = path.basename(scriptPath).replace(/[^a-zA-Z0-9._-]/g, '_');

  if (ext === '.js') {
    // Try to require & run the module directly if it exports a callable function.
    try {
      const moduleExports = require(scriptPath);
      // Prefer exported function named 'run' or 'main' or default export or module itself if it's a function
      const fn = (moduleExports && typeof moduleExports === 'function')
        ? moduleExports
        : (moduleExports && (moduleExports.run || moduleExports.main || moduleExports.default));

      if (fn && typeof fn === 'function') {
        // Call the function directly and await if it returns a promise
        const start = Date.now();
        logger.info(`[ScriptRunner] Invocando módulo diretamente: ${scriptPath}`);
        const maybePromise = fn(...args);
        if (maybePromise && typeof maybePromise.then === 'function') {
          const res = await maybePromise;
          const duration = Date.now() - start;
          logger.info(`[ScriptRunner] Módulo executado: ${scriptPath} (${duration}ms)`);
          return { jobId: `${timestamp}_${baseName}_direct`, direct: true, result: res };
        }
        return { jobId: `${timestamp}_${baseName}_direct`, direct: true, result: maybePromise };
      }

      // If no callable export, fall back to spawning node
      cmd = process.execPath || 'node'; // node executable
      cmdArgs = [scriptPath, ...args];
    } catch (requireErr: unknown) {
      // If requiring fails (syntax error or process.exit), fallback to spawn
      const errMsg = requireErr instanceof Error ? requireErr.message : String(requireErr);
      logger.warn(`[ScriptRunner] require() falhou para ${scriptPath}, fallback para spawn: ${errMsg}`);
      cmd = process.execPath || 'node';
      cmdArgs = [scriptPath, ...args];
    }
  } else if (ext === '.ps1') {
    // Use powershell.exe (Windows) with bypass
    cmd = 'powershell.exe';
    cmdArgs = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...args];
  } else if (ext === '.sh') {
    cmd = 'bash';
    cmdArgs = [scriptPath, ...args];
  } else {
    throw new Error(`Extensão de script não suportada: ${ext}`);
  }

  const outLog = path.join(LOGS_DIR, `${timestamp}_${baseName}.out.log`);
  const errLog = path.join(LOGS_DIR, `${timestamp}_${baseName}.err.log`);

  const outStream = fsSync.createWriteStream(outLog, { flags: 'a' });
  const errStream = fsSync.createWriteStream(errLog, { flags: 'a' });

  logger.info(`[ScriptRunner] Executando ${scriptPath} (${background ? 'background' : 'foreground'})`);

  const child = spawn(cmd, cmdArgs, {
    env: { ...process.env, ...env },
    cwd: path.dirname(scriptPath),
    windowsHide: true,
  });

  child.stdout.pipe(outStream);
  child.stderr.pipe(errStream);

  const jobId = `${timestamp}_${baseName}_${child.pid}`;

  const result = {
    jobId,
    pid: child.pid,
    outLog,
    errLog,
  };

  if (background) {
    // detach streams and return immediately
    logger.info(`[ScriptRunner] Script executando em background: jobId=${jobId}`);
    return result;
  }

  // Return a promise that resolves when process exits
  return new Promise((resolve, reject) => {
    child.on('error', async (err) => {
      logger.error('[ScriptRunner] Erro ao executar script:', err.message);
      try { outStream.end(); errStream.end(); } catch (e) {}
      reject(err);
    });

    child.on('close', async (code, signal) => {
      try { outStream.end(); errStream.end(); } catch (e) {}
      logger.info(`[ScriptRunner] Script finalizado: jobId=${jobId} code=${code} signal=${signal}`);
      resolve({ ...result, code, signal });
    });
  });
}

export default { runScript };


