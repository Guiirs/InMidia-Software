/**
 * Script para iniciar Frontend (React) e Backend (Node.js) simultaneamente
 * 
 * Uso: npm run dev
 */

const { spawn } = require('child_process');
const path = require('path');

// Cores para console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(prefix, message, color = colors.reset) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${color}[${timestamp}] [${prefix}]${colors.reset} ${message}`);
}

function startProcess(name, command, args, cwd, color) {
  log(name, `Iniciando em ${cwd}...`, color);
  
  const process = spawn(command, args, {
    cwd,
    shell: true,
    stdio: 'pipe'
  });

  process.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      output.split('\n').forEach(line => {
        log(name, line, color);
      });
    }
  });

  process.stderr.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      output.split('\n').forEach(line => {
        log(name, line, colors.red);
      });
    }
  });

  process.on('error', (error) => {
    log(name, `Erro: ${error.message}`, colors.red);
  });

  process.on('close', (code) => {
    if (code !== 0) {
      log(name, `Processo finalizado com código ${code}`, colors.red);
    } else {
      log(name, 'Processo finalizado', colors.yellow);
    }
  });

  return process;
}

// Paths
const backendPath = path.join(__dirname, 'BECKEND');
const frontendPath = path.join(__dirname, 'REACT');
const redisPath = path.join(__dirname, 'redis-new');

const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

console.log('\n╔═══════════════════════════════════════════════════════╗');
console.log('║   INICIANDO AMBIENTE DE DESENVOLVIMENTO               ║');
console.log('╚═══════════════════════════════════════════════════════╝\n');

// Verificar se os diretórios existem
const fs = require('fs');
if (!fs.existsSync(backendPath)) {
  console.error(`${colors.red}Erro: Diretório BECKEND não encontrado!${colors.reset}`);
  process.exit(1);
}

if (!fs.existsSync(frontendPath)) {
  console.error(`${colors.red}Erro: Diretório REACT não encontrado!${colors.reset}`);
  process.exit(1);
}

if (!fs.existsSync(redisPath)) {
  console.error(`${colors.red}Erro: Diretório redis-new não encontrado!${colors.reset}`);
  process.exit(1);
}

// Check if Redis is already listening on REDIS_PORT — skip spawn if so
const net = require('net');
function checkRedisRunning(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.setTimeout(500, () => { socket.destroy(); resolve(false); });
  });
}

(async () => {
  // Start Redis only if not already listening on REDIS_PORT
  const redisAlreadyUp = await checkRedisRunning(REDIS_PORT);
  let redis;
  if (redisAlreadyUp) {
    log('REDIS', `Já em execução em 127.0.0.1:${REDIS_PORT} — reutilizando instância existente`, colors.yellow);
    redis = { kill: () => {} };
  } else {
    const confFile = `redis${REDIS_PORT}.conf`;
    if (!fs.existsSync(path.join(redisPath, confFile))) {
      console.error(`${colors.red}Erro: Arquivo de configuração redis-new/${confFile} não encontrado!${colors.reset}`);
      process.exit(1);
    }
    redis = startProcess(
      'REDIS',
      'redis-server.exe',
      [confFile],
      redisPath,
      colors.green
    );
  }

  const backend = startProcess(
    'BACKEND',
    'npm',
    ['run', 'dev'],
    backendPath,
    colors.cyan
  );

  const frontend = startProcess(
    'FRONTEND',
    'npm',
    ['run', 'dev'],
    frontendPath,
    colors.magenta
  );

  // Tratamento de sinais para encerramento gracioso
  process.on('SIGINT', () => {
    console.log('\n');
    log('SYSTEM', 'Encerrando processos...', colors.yellow);

    redis.kill('SIGINT');
    backend.kill('SIGINT');
    frontend.kill('SIGINT');

    setTimeout(() => {
      redis.kill('SIGKILL');
      backend.kill('SIGKILL');
      frontend.kill('SIGKILL');
      process.exit(0);
    }, 3000);
  });

  process.on('SIGTERM', () => {
    redis.kill('SIGTERM');
    backend.kill('SIGTERM');
    frontend.kill('SIGTERM');
    process.exit(0);
  });
})();

// Informações úteis
setTimeout(() => {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║   SERVIDORES INICIADOS                                ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log(`${colors.green}Redis:${colors.reset}    localhost:${REDIS_PORT}`);
  console.log(`${colors.cyan}Backend:${colors.reset}  http://localhost:4000 (ou conforme PORT no .env)`);
  console.log(`${colors.magenta}Frontend:${colors.reset} http://localhost:5173 (ou conforme Vite)`);
  console.log(`\n${colors.yellow}Pressione Ctrl+C para parar todos os servidores${colors.reset}\n`);
}, 3000);


