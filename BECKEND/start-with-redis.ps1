# Script para iniciar Redis e API em paralelo
# Inicia o Redis via Docker e depois a API

Write-Host "🚀 Verificando Docker..." -ForegroundColor Cyan

# Verifica se o Docker está rodando
try {
    $null = docker ps 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker não está rodando"
    }
} catch {
    Write-Host "❌ Docker Desktop não está rodando!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Por favor:" -ForegroundColor Yellow
    Write-Host "1. Abra o Docker Desktop" -ForegroundColor Yellow
    Write-Host "2. Aguarde até ele iniciar completamente" -ForegroundColor Yellow
    Write-Host "3. Execute este script novamente: npm run dev:redis" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Ou inicie sem Redis: npm run dev" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

Write-Host "✅ Docker está rodando!" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Iniciando Redis via Docker..." -ForegroundColor Cyan

# Verifica se o container redis já existe
$redisContainer = docker ps -a -q -f name=backstage-redis

if ($redisContainer) {
    Write-Host "📦 Container Redis já existe. Iniciando..." -ForegroundColor Yellow
    docker start backstage-redis | Out-Null
} else {
    Write-Host "📦 Criando novo container Redis..." -ForegroundColor Yellow
    docker run -d `
        --name backstage-redis `
        -p 6380:6379 `
        --restart unless-stopped `
        redis:alpine | Out-Null
}

# Aguarda o Redis estar pronto
Write-Host "⏳ Aguardando Redis inicializar..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Verifica se está rodando
$redisRunning = docker ps -q -f name=backstage-redis
if ($redisRunning) {
    Write-Host "✅ Redis iniciado na porta 6380" -ForegroundColor Green
} else {
    Write-Host "❌ Falha ao iniciar Redis" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🚀 Iniciando API..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""

# Inicia a API
npm run dev
