# Script de refatoracao do Frontend
Write-Host "Iniciando refatoracao..."

# Backup
$backupDir = "backup-frontend-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Write-Host "Criando backup em $backupDir..."
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item -Path "src" -Destination $backupDir -Recurse -Force

Write-Host "Aplicando substituicoes..."

# Aplicar substituicoes
Get-ChildItem -Path "src" -Recurse -Include "*.js","*.jsx","*.ts","*.tsx" |
ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $originalContent = $content

    # cliente -> clienteId
    $content = $content -replace '\.cliente(?!\w)', '.clienteId'

    # contrato.cliente -> contrato.clienteId
    $content = $content -replace 'contrato\.cliente', 'contrato.clienteId'

    # pi.cliente -> pi.clienteId
    $content = $content -replace 'pi\.cliente', 'pi.clienteId'

    # initialData.cliente -> initialData.clienteId
    $content = $content -replace 'initialData\.cliente', 'initialData.clienteId'

    # data.cliente -> data.clienteId
    $content = $content -replace 'data\.cliente(?!\w)', 'data.clienteId'

    # response.data.cliente -> response.data.clienteId
    $content = $content -replace 'response\.data\.cliente(?!\w)', 'response.data.clienteId'

    # cliente: -> clienteId:
    $content = $content -replace 'cliente:', 'clienteId:'

    # cliente = -> clienteId =
    $content = $content -replace 'cliente\s*=', 'clienteId ='

    if ($content -ne $originalContent) {
        Set-Content -Path $_.FullName -Value $content
        Write-Host "Atualizado: $($_.FullName)"
    }
}

Write-Host "Refatoracao concluida!"