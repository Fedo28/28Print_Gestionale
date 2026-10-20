# Pannello locale: nessuna porta aperta, nessuna lettura delle credenziali DPAPI.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$bridgeRoot = Split-Path $PSScriptRoot -Parent
try {
  $config = Get-Content -LiteralPath (Join-Path $bridgeRoot 'config.json') -Raw | ConvertFrom-Json
  $dataDir = Join-Path $config.workDir 'data'
  $logsDir = Join-Path $config.workDir 'logs'
  $baseUri = [Uri]$config.baseUrl
  if ($baseUri.Scheme -ne 'https' -or $baseUri.UserInfo -or $baseUri.Query -or $baseUri.Fragment -or $baseUri.AbsolutePath -ne '/') {
    throw 'Origine HTTPS non valida.'
  }
} catch {
  [System.Windows.Forms.MessageBox]::Show('Configurazione non leggibile. Verifica config.json nella cartella del Bridge.', '28PRINT Bridge') | Out-Null
  exit 1
}

function Get-BridgeTask {
  $task = Get-ScheduledTask -TaskName '28PRINT Bridge' -TaskPath '\' -ErrorAction SilentlyContinue
  if ($task) {
    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    $launcher = Join-Path $PSScriptRoot 'Start-Bridge.ps1'
    $taskUser = [string]$task.Principal.UserId
    try {
      $taskSid = if ($taskUser -match '^S-1-') {
        [System.Security.Principal.SecurityIdentifier]::new($taskUser)
      } else {
        ([System.Security.Principal.NTAccount]::new($taskUser)).Translate([System.Security.Principal.SecurityIdentifier])
      }
    } catch { throw 'Impossibile verificare l''utente dell''attivita esistente.' }
    if (@($task.Actions).Count -ne 1 -or -not $task.Actions[0].Arguments.Contains($launcher) -or
        $taskSid.Value -ne $identity.User.Value) {
      throw 'Attivita omonima di un altro utente o percorso: nessuna modifica consentita.'
    }
  }
  return $task
}
function Read-BridgeStatus {
  try {
    $value = Get-Content -LiteralPath (Join-Path $dataDir 'runtime-status.json') -Raw | ConvertFrom-Json
    if ($value.version -ne 1 -or $value.instanceId -notmatch '^[a-f0-9-]{36}$') { return $null }
    return $value
  } catch { return $null }
}
function Show-Problem([string]$message) {
  [System.Windows.Forms.MessageBox]::Show($message, '28PRINT Bridge', 'OK', 'Warning') | Out-Null
}

$form = New-Object System.Windows.Forms.Form
$form.Text = '28PRINT Bridge'
$form.ClientSize = New-Object System.Drawing.Size(660, 490)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.Font = New-Object System.Drawing.Font('Segoe UI', 10)

function Add-Label([int]$y, [int]$height, [string]$text) {
  $label = New-Object System.Windows.Forms.Label
  $label.Location = New-Object System.Drawing.Point(20, $y)
  $label.Size = New-Object System.Drawing.Size(620, $height)
  $label.Text = $text
  $form.Controls.Add($label)
  return $label
}
$heading = Add-Label 18 34 '28PRINT Bridge'
$heading.Font = New-Object System.Drawing.Font('Segoe UI', 17, [System.Drawing.FontStyle]::Bold)
$stateLabel = Add-Label 60 28 'Lettura stato...'
$stateLabel.Font = New-Object System.Drawing.Font('Segoe UI', 12, [System.Drawing.FontStyle]::Bold)
$contactLabel = Add-Label 92 26 ''
$startupLabel = Add-Label 122 26 ''
$notice = Add-Label 155 50 'Il PC deve restare acceso, senza sospensione, con questo utente collegato e Fiery Hot Folders attivo.'

function Add-Button([int]$x, [int]$y, [int]$width, [string]$text) {
  $button = New-Object System.Windows.Forms.Button
  $button.Location = New-Object System.Drawing.Point($x, $y)
  $button.Size = New-Object System.Drawing.Size($width, 36)
  $button.Text = $text
  $form.Controls.Add($button)
  return $button
}
$startButton = Add-Button 20 215 190 'Avvia Bridge'
$pauseButton = Add-Button 225 215 190 'Pausa Bridge'
$webButton = Add-Button 430 215 210 'Apri gestionale'
$logsButton = Add-Button 20 260 190 'Apri cartella log'
$refreshButton = Add-Button 225 260 190 'Aggiorna stato'
$help = Add-Label 309 44 'Pausa attende la fine dell''operazione in corso e disabilita l''avvio al login. Avvia Bridge lo riabilita. Non usare Pausa come arresto di emergenza della stampante.'
$taskDetail = Add-Label 365 40 ''
$footer = Add-Label 422 50 'Puoi chiudere questa finestra: il Bridge continua in background. Consegnato alla Hot Folder non significa stampato.'

function Refresh-Panel {
  try {
    $task = Get-BridgeTask
    $status = Read-BridgeStatus
    $active = $task -and $task.State -eq 'Running'
    $stateLabel.ForeColor = [System.Drawing.Color]::DarkOrange
    if (-not $task) {
      $stateLabel.Text = 'Avvio automatico non configurato'
      $startupLabel.Text = 'Esegui Configura-Desktop.cmd con il solito utente Windows.'
    } else {
      $startupLabel.Text = if ($task.Settings.Enabled) { 'Avvio automatico: attivo al login di questo utente' } else { 'Avvio automatico: in pausa' }
      if (-not $active) { $stateLabel.Text = 'Bridge fermo (attivita pianificata non in esecuzione)' }
      elseif (-not $status) { $stateLabel.Text = 'Avvio in corso / diagnostica non ancora disponibile' }
      elseif ($status.state -eq 'stopped') { $stateLabel.Text = 'Arresto in corso...' }
      elseif ($status.state -eq 'night_paused') { $stateLabel.Text = 'Pausa notturna - ripresa automatica alle 08:00 (ora italiana)' }
      elseif ($status.state -eq 'retrying') { $stateLabel.Text = 'Connessione o registro da verificare - nuovo tentativo automatico' }
      elseif ($status.lastSuccessAt -and ([DateTimeOffset]::UtcNow - [DateTimeOffset]::Parse($status.lastSuccessAt)).TotalSeconds -lt 90) {
        $stateLabel.Text = 'Bridge attivo - ultimo ciclo riuscito di recente'
        $stateLabel.ForeColor = [System.Drawing.Color]::DarkGreen
      } else { $stateLabel.Text = 'Bridge in esecuzione - contatto recente non confermato' }
    }
    $contactLabel.Text = if ($status -and $status.lastSuccessAt) {
      'Ultimo ciclo riuscito: ' + ([DateTimeOffset]::Parse($status.lastSuccessAt)).ToLocalTime().ToString('dd/MM/yyyy HH:mm:ss')
    } else { 'Ultimo ciclo riuscito: non disponibile. Controlla anche il gestionale.' }
    $startButton.Enabled = [bool]$task -and (-not $active)
    $pauseButton.Enabled = [bool]$task -and ($active -or $task.Settings.Enabled)
    if ($task) {
      $info = Get-ScheduledTaskInfo -TaskName '28PRINT Bridge' -TaskPath '\'
      $taskDetail.Text = 'Stato Windows: ' + $task.State + ' | Ultimo risultato attivita: ' + $info.LastTaskResult + "`r`nDurante l'esecuzione 267009 (0x41301) e normale."
    } else { $taskDetail.Text = '' }
  } catch {
    $stateLabel.Text = 'Stato non disponibile: verificare attivita e configurazione'
    $stateLabel.ForeColor = [System.Drawing.Color]::DarkRed
    $startButton.Enabled = $false
    $pauseButton.Enabled = $false
  }
}
$startButton.Add_Click({
  try {
    $task = Get-BridgeTask
    if (-not $task) { throw 'Attivita non installata.' }
    Enable-ScheduledTask -TaskName '28PRINT Bridge' -TaskPath '\' | Out-Null
    Start-ScheduledTask -TaskName '28PRINT Bridge' -TaskPath '\'
    Refresh-Panel
  } catch { Show-Problem 'Avvio non riuscito. Controlla l''attivita Windows e i log. Non aprire una seconda istanza manuale.' }
})
$pauseButton.Add_Click({
  if ([System.Windows.Forms.MessageBox]::Show('Mettere in pausa il Bridge e il suo avvio automatico? Un invio gia iniziato potra terminare. I lavori gia su Fiery restano invariati.', '28PRINT Bridge', 'YesNo', 'Question') -ne 'Yes') { return }
  try {
    $task = Get-BridgeTask
    if (-not $task) { throw 'Attivita non installata.' }
    $status = Read-BridgeStatus
    if ($task.State -eq 'Running' -and (-not $status -or $status.state -eq 'stopped')) { throw 'Diagnostica non ancora pronta.' }
    Disable-ScheduledTask -TaskName '28PRINT Bridge' -TaskPath '\' | Out-Null
    if ($task.State -eq 'Running') {
      $request = @{ instanceId = $status.instanceId } | ConvertTo-Json -Compress
      [System.IO.File]::WriteAllText((Join-Path $dataDir 'stop-request.json'), $request, (New-Object System.Text.UTF8Encoding($false)))
    }
    Refresh-Panel
  } catch { Show-Problem 'Pausa non completata. Controlla lo stato: l''avvio automatico potrebbe essere disabilitato ma il processo ancora attivo. Non forzare l''arresto durante un invio.' }
})
$webButton.Add_Click({ try { Start-Process ($baseUri.GetLeftPart([UriPartial]::Authority) + '/settings/printing') } catch { Show-Problem 'Apri la Preview dal browser e vai alla pagina Bridge.' } })
$logsButton.Add_Click({ try { Start-Process explorer.exe -ArgumentList ('"' + $logsDir + '"') } catch { Show-Problem 'Cartella log non disponibile.' } })
$refreshButton.Add_Click({ Refresh-Panel })
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 5000
$timer.Add_Tick({ Refresh-Panel })
$form.Add_Shown({ Refresh-Panel; $timer.Start() })
$form.Add_FormClosed({ $timer.Stop(); $timer.Dispose() })
[void]$form.ShowDialog()
$form.Dispose()
