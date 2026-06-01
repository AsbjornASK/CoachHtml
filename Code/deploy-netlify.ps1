param(
  [string]$SiteId = "e7787410-bd7d-4811-9d23-6df9b5a6d28e",
  [string]$StatusUrl = "https://coachhealth.netlify.app/"
)

$ErrorActionPreference = "Stop"

if (-not $env:NETLIFY_AUTH_TOKEN) {
  throw "NETLIFY_AUTH_TOKEN is not set. Set it in your environment before deploying."
}

$env:NETLIFY_SITE_ID = $SiteId
$env:MORNING_STATUS_URL = $StatusUrl

netlify deploy --prod --dir . --site $env:NETLIFY_SITE_ID --auth $env:NETLIFY_AUTH_TOKEN
