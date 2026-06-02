$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path (Get-Location) "backups"
$backupFile = Join-Path $backupDir "bodega360-$timestamp.sql"

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

docker exec bodega360-postgres pg_dump -U bodega360 -d bodega360 | Out-File -Encoding utf8 $backupFile

Write-Host "Respaldo creado en $backupFile"
