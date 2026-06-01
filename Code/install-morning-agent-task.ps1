param(
  [string]$ProjectDir = $PSScriptRoot,
  [string]$TaskName = "Morning Health Coach Netlify Deploy",
  [string]$RunAt = "09:55"
)

$ErrorActionPreference = "Stop"

$runner = Join-Path $ProjectDir "run-morning-agent.ps1"

if (-not (Test-Path -LiteralPath $runner)) {
  throw "Could not find $runner"
}

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runner`""

$trigger = New-ScheduledTaskTrigger -Daily -At $RunAt

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 45)

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Runs Claude Code daily to generate and deploy the morning health page to Netlify." `
  -Force

Write-Host "Scheduled task installed: $TaskName"
Write-Host "Run time: $RunAt"
Write-Host "Runner: $runner"


# # Kør opgaven nu (test)
# Start-ScheduledTask -TaskName "Morning Health Coach Netlify Deploy"

# # Slå fra midlertidigt
# Disable-ScheduledTask -TaskName "Morning Health Coach Netlify Deploy"

# # Slå til igen
# Enable-ScheduledTask -TaskName "Morning Health Coach Netlify Deploy"

# # Slet helt
# Unregister-ScheduledTask -TaskName "Morning Health Coach Netlify Deploy" -Confirm:$false