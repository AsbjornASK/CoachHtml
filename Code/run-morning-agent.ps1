param(
  [string]$ProjectDir = $PSScriptRoot,
  [string]$SiteId = "e7787410-bd7d-4811-9d23-6df9b5a6d28e",
  [string]$StatusUrl = "https://coachhealth.netlify.app/",
  [string]$PermissionMode = "bypassPermissions"
)

$ErrorActionPreference = "Stop"

Set-Location -LiteralPath $ProjectDir

$env:NETLIFY_SITE_ID = $SiteId
$env:MORNING_STATUS_URL = $StatusUrl

if (-not $env:NETLIFY_AUTH_TOKEN) {
  throw "NETLIFY_AUTH_TOKEN is not set. Set it as a user environment variable before running the daily task."
}

if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
  throw "Claude Code CLI was not found on PATH."
}

if (-not (Get-Command netlify -ErrorAction SilentlyContinue)) {
  throw "Netlify CLI was not found on PATH. Install it with: npm install -g netlify-cli"
}

$logDir = Join-Path $ProjectDir "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$stamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logPath = Join-Path $logDir "morning-agent_$stamp.log"

$prompt = @"
Run the daily MorningAgent workflow now.

Use MorningAgent.md and CLAUDE.md as the source of truth.
Generate today's mobile index.html with real data, deploy it to Netlify, then create/update the Google Calendar event.
Do not use demo data. If a required integration or credential is missing, report the exact blocker and do not invent data or links.
"@

claude -p $prompt --permission-mode $PermissionMode --output-format text *>&1 | Tee-Object -FilePath $logPath
