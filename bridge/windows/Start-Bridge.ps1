$ErrorActionPreference = 'Stop'
$bridgeRoot = Split-Path $PSScriptRoot -Parent
$previousToken = $env:PRINT_BRIDGE_TOKEN
$previousBypass = $env:PRINT_BRIDGE_VERCEL_BYPASS
$bridgeExitCode = 1
try {
  $nodeCommand = Get-Command node.exe -ErrorAction Stop
  $secretFile = Join-Path $bridgeRoot 'data\credential.dpapi'
  $secure = Get-Content -LiteralPath $secretFile | ConvertTo-SecureString
  $env:PRINT_BRIDGE_TOKEN = [System.Net.NetworkCredential]::new('', $secure).Password
  # Non eredita un eventuale segreto di un altro progetto dalla sessione Windows.
  $env:PRINT_BRIDGE_VERCEL_BYPASS = $null
  $bypassFile = Join-Path $bridgeRoot 'data\vercel-bypass.dpapi'
  if (Test-Path -LiteralPath $bypassFile) {
    $secureBypass = Get-Content -LiteralPath $bypassFile | ConvertTo-SecureString
    $env:PRINT_BRIDGE_VERCEL_BYPASS = [System.Net.NetworkCredential]::new('', $secureBypass).Password
  }
  Set-Location $bridgeRoot
  & $nodeCommand.Source (Join-Path $bridgeRoot 'src\cli.ts') run (Join-Path $bridgeRoot 'config.json')
  $bridgeExitCode = $LASTEXITCODE
  if ($bridgeExitCode -ne 0) { throw 'Motore Bridge terminato con errore.' }
} catch {
  # Nessun dettaglio dell'eccezione: potrebbe contenere percorsi o valori riservati.
  $bridgeExitCode = 1
  try {
    $logs = Join-Path $bridgeRoot 'logs'
    New-Item -ItemType Directory -Force -Path $logs | Out-Null
    $failureLog = Join-Path $logs 'launcher-error.log'
    ([DateTime]::UtcNow.ToString('o') + ' Avvio/esecuzione non riusciti. Verificare Node, config.json, stesso utente DPAPI e assenza di una seconda istanza. Consultare bridge.log.') | Set-Content -LiteralPath $failureLog -Encoding UTF8
  } catch {}
} finally {
  $env:PRINT_BRIDGE_TOKEN = $previousToken
  $env:PRINT_BRIDGE_VERCEL_BYPASS = $previousBypass
}
exit $bridgeExitCode
