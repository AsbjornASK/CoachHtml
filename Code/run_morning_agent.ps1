param(
  [string]$ProjectDir = $PSScriptRoot,
  [string]$SiteId = "e7787410-bd7d-4811-9d23-6df9b5a6d28e",
  [string]$StatusUrl = "https://coachhealth.netlify.app/",
  [string]$PermissionMode = "bypassPermissions"
)

$ErrorActionPreference = "Stop"

$runner = Join-Path $PSScriptRoot "run-morning-agent.ps1"

if (-not (Test-Path -LiteralPath $runner)) {
  throw "Could not find runner script: $runner"
}

& $runner `
  -ProjectDir $ProjectDir `
  -SiteId $SiteId `
  -StatusUrl $StatusUrl `
  -PermissionMode $PermissionMode
