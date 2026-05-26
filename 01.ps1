param(
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Test-PortListening {
  param([int]$Port)

  try {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    return $null -ne $conn
  } catch {
    return $false
  }
}

function Start-DevWindow {
  param(
    [string]$Title,
    [string]$Workdir,
    [string]$Command
  )

  Write-Host "-> $Title" -ForegroundColor Cyan
  Write-Host "   Pasta : $Workdir"
  Write-Host "   Cmd   : $Command"

  if ($DryRun) {
    return
  }

  Start-Process powershell.exe -ArgumentList @(
    '-NoExit',
    '-Command',
    "Set-Location -LiteralPath '$Workdir'; $Command"
  ) | Out-Null
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Join-Path $root 'BECKEND'
$frontendPath = Join-Path $root 'REACT'

if (-not (Test-Path $backendPath)) {
  throw "Diretorio backend nao encontrado: $backendPath"
}

if (-not (Test-Path $frontendPath)) {
  throw "Diretorio frontend nao encontrado: $frontendPath"
}

Write-Host ''
Write-Host '== Iniciador de Instancias ==' -ForegroundColor Green
Write-Host "Raiz: $root"
Write-Host ''

$backendAlreadyRunning = Test-PortListening -Port 4000
$frontendAlreadyRunning = Test-PortListening -Port 5173

if ($backendAlreadyRunning) {
  Write-Host 'Backend ja esta em execucao na porta 4000. Nenhuma nova instancia sera aberta.' -ForegroundColor Yellow
} else {
  Start-DevWindow -Title 'BACKEND' -Workdir $backendPath -Command '$env:WHATSAPP_ENABLED=''false''; npm run dev'
}

if ($frontendAlreadyRunning) {
  Write-Host 'Frontend ja esta em execucao na porta 5173. Nenhuma nova instancia sera aberta.' -ForegroundColor Yellow
} else {
  Start-DevWindow -Title 'FRONTEND' -Workdir $frontendPath -Command 'npm run dev'
}

Write-Host ''
Write-Host 'Instancias solicitadas.' -ForegroundColor Green
Write-Host 'Backend:  http://localhost:4000'
Write-Host 'Frontend: http://localhost:5173'
Write-Host ''
Write-Host 'Uso: .\01.ps1   |   teste: .\01.ps1 -DryRun'
