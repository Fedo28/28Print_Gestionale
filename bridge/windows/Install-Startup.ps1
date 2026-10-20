$ErrorActionPreference = 'Stop'
$bridgeRoot = Split-Path $PSScriptRoot -Parent
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$account = $identity.Name
$launcher = Join-Path $PSScriptRoot 'Start-Bridge.ps1'
$panel = Join-Path $PSScriptRoot 'Bridge-Control.ps1'
$powershell = Join-Path $PSHOME 'powershell.exe'
$existing = Get-ScheduledTask -TaskName '28PRINT Bridge' -ErrorAction SilentlyContinue
if ($existing) {
  # Task Scheduler puo' restituire UTENTE, COMPUTER\UTENTE oppure il SID.
  # Confrontiamo l'identita' Windows risolta, non la rappresentazione del nome.
  $taskUser = [string]$existing.Principal.UserId
  try {
    $taskSid = if ($taskUser -match '^S-1-') {
      [System.Security.Principal.SecurityIdentifier]::new($taskUser)
    } else {
      ([System.Security.Principal.NTAccount]::new($taskUser)).Translate([System.Security.Principal.SecurityIdentifier])
    }
  } catch { throw 'Impossibile verificare l''utente dell''attivita esistente. Nessuna modifica eseguita.' }
  if ($existing.TaskPath -ne '\' -or @($existing.Actions).Count -ne 1 -or
      -not $existing.Actions[0].Arguments.Contains($launcher) -or
      $taskSid.Value -ne $identity.User.Value) {
    throw 'Esiste una attivita omonima di un altro percorso o utente. Nessuna modifica eseguita.'
  }
  if ($existing.State -eq 'Running') { throw 'Il Bridge pianificato e ancora attivo. Arrestarlo prima di aggiornare la configurazione.' }
}
if (-not (Test-Path -LiteralPath $panel)) { throw 'Pannello Bridge mancante: estrarre tutti i file del pacchetto.' }
if (-not (Test-Path -LiteralPath (Join-Path $bridgeRoot 'data\credential.dpapi'))) { throw 'Prima configurare la credenziale Bridge per questo utente Windows.' }
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop '28PRINT Bridge.lnk'
$shell = New-Object -ComObject WScript.Shell
if (Test-Path -LiteralPath $shortcutPath) {
  $oldShortcut = $shell.CreateShortcut($shortcutPath)
  if (-not $oldShortcut.Arguments.Contains($panel)) { throw 'Collegamento desktop omonimo estraneo: non sovrascritto.' }
}
$node = (Get-Command node.exe -ErrorAction Stop).Source
& $node (Join-Path $bridgeRoot 'src\cli.ts') check (Join-Path $bridgeRoot 'config.json')
if ($LASTEXITCODE -ne 0) { throw 'Controllo configurazione fallito. Avvio automatico non modificato.' }
$action = New-ScheduledTaskAction -Execute $powershell -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcher`"" -WorkingDirectory $bridgeRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $account
$settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId $account -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName '28PRINT Bridge' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $powershell
$shortcut.Arguments = "-NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$panel`""
$shortcut.WorkingDirectory = $bridgeRoot
$shortcut.Description = 'Stato e controllo 28PRINT Bridge. Chiudere il pannello non ferma il Bridge.'
$shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,16"
$shortcut.Save()
Write-Host 'Avvio silenzioso al login configurato. Collegamento 28PRINT Bridge creato sul desktop.'
Write-Host 'Apri il collegamento e premi Avvia Bridge. Chiudere il pannello non arresta il programma.'
