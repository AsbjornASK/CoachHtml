# Coach Health Morning Page

Static mobile readiness page deployed to:

https://coachhealth.netlify.app/

## Files

- `MorningAgent.md` - the full daily coach workflow and scoring rules.
- `CLAUDE.md` - Claude Code project instructions.
- `index.html` - generated/static mobile page.
- `netlify.toml` - Netlify publish configuration.
- `run-morning-agent.ps1` - runs Claude Code, generates the page, and deploys.
- `run_morning_agent.ps1` - console-friendly alias for manual runs.
- `deploy-netlify.ps1` - deploys the current folder to Netlify.
- `install-morning-agent-task.ps1` - installs the daily Windows Scheduled Task.

## Required environment

Set this as a Windows user environment variable:

```powershell
[Environment]::SetEnvironmentVariable("NETLIFY_AUTH_TOKEN", "your-token-here", "User")
```

Open a new PowerShell window after setting it.

## Manual run

```powershell
cd "C:\Users\AsbjørnSchönebergKro\source\Health\Code"
.\run-morning-agent.ps1
```

Underscore alias:

```powershell
cd "C:\Users\AsbjørnSchönebergKro\source\Health\Code"
.\run_morning_agent.ps1
```

## Install daily task

```powershell
.\install-morning-agent-task.ps1
```

Default run time is `09:55`.

To choose another time:

```powershell
.\install-morning-agent-task.ps1 -RunAt "10:00"
```

## Notes

- Do not commit or write `NETLIFY_AUTH_TOKEN` to files.
- `reference-images/` contains local design references and is ignored by git.
- `logs/` contains local run logs and is ignored by git.

## Azure DevOps pipeline

`azure-pipelines.yml` can run the same workflow in Azure DevOps.

Create these pipeline variables and mark secrets as secret:

```text
ANTHROPIC_API_KEY      secret
NETLIFY_AUTH_TOKEN     secret
```

The pipeline defines:

```text
NETLIFY_SITE_ID=e7787410-bd7d-4811-9d23-6df9b5a6d28e
MORNING_STATUS_URL=https://coachhealth.netlify.app/
```

The schedule is:

```yaml
cron: "55 7 * * *"
```

Azure DevOps cron schedules are UTC. `07:55 UTC` is `09:55` in Denmark during summer time. Adjust it when needed for winter time, or manage the schedule in the Azure DevOps UI.
