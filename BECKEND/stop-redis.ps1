# Script para parar o Redis

Write-Host "🛑 Parando Redis..." -ForegroundColor Yellow

$redisContainer = docker ps -q -f name=backstage-redis

if ($redisContainer) {
    docker stop backstage-redis | Out-Null
    Write-Host "✅ Redis parado com sucesso!" -ForegroundColor Green
} else {
    Write-Host "ℹ️  Redis não está rodando" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Para remover o container completamente:" -ForegroundColor Gray
Write-Host "  docker rm backstage-redis" -ForegroundColor Gray
