# Deploy Logs Reference

## Log File Location

```
FoundryVTT-Nimble/logs/deploy.log
```

## Log Format

Tab-separated, one entry per deploy:

```
TIMESTAMP               COMMAND         STATUS              DURATION
2026-03-08T05:43:58Z    deploy:nimble   SUCCESS             10s
2026-03-08T07:51:16Z    deploy:nimble   SUCCESS             8s
2026-03-09T01:43:16Z    deploy:nimble   SUCCESS             9s
```

Fields:
- **TIMESTAMP** — UTC ISO 8601 datetime the deploy started
- **COMMAND** — Label passed to `deploy-log.sh` (matches the `package.json` script name)
- **STATUS** — `SUCCESS` or `FAILURE (exit N)`
- **DURATION** — Wall-clock seconds

## How It Works

`pnpm deploy:nimble` wraps the actual build+rsync command via `scripts/deploy-log.sh` (bundled in `scripts/`). The script:
1. Runs `pnpm build:compendia && vite build && rsync ... dist/ ubuntu@foundryvtt.redirectme.net:...`
2. Records exit code and duration
3. Appends a single TSV line to `logs/deploy.log`

## Checking Recent Deploys

```bash
tail -10 logs/deploy.log
```

## What to Do on FAILURE

1. Re-run `pnpm deploy:nimble` to see the full error output (the log only records the exit code)
2. Common causes: SSH key not loaded (`ssh-add`), rsync connectivity, build errors
3. Do NOT SSH-restart the server if `deploy:nimble` failed — the remote files may be in a partial state
