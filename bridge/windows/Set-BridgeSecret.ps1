param(
  [ValidateSet('Bridge', 'VercelBypass')]
  [string]$Kind = 'Bridge'
)
$ErrorActionPreference = 'Stop'
$bridgeRoot = Split-Path $PSScriptRoot -Parent
$dataDir = Join-Path $bridgeRoot 'data'
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
$fileName = if ($Kind -eq 'VercelBypass') { 'vercel-bypass.dpapi' } else { 'credential.dpapi' }
$description = if ($Kind -eq 'VercelBypass') { 'automazione Vercel del solo progetto di test' } else { 'dedicata del Bridge' }
$secret = Read-Host "Incolla la credenziale $description (input nascosto)" -AsSecureString
if ($secret.Length -eq 0) { throw 'Credenziale vuota: nessun file salvato.' }
$secretFile = Join-Path $dataDir $fileName
$secret | ConvertFrom-SecureString | Set-Content -LiteralPath $secretFile
$account = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $secretFile /inheritance:r /grant:r "${account}:(F)" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Protezione del file credenziale non riuscita.' }
Write-Host 'Credenziale protetta con DPAPI per questo utente Windows. Nessun invio eseguito.'
