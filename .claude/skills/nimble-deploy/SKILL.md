---
name: nimble-deploy
description: "Invoke when the user asks to deploy the Nimble system to the remote server. Builds compendia + system, rsyncs dist/ to the server, and restarts FoundryVTT via pm2."
---

## Deploy Workflow

When the user asks to deploy (e.g., "deploy", "deploy:nimble", "push to server"):

1. **Confirm** before proceeding:
   > "I will build and deploy to `foundryvtt.redirectme.net`. Confirm?"

2. **Build and rsync:**
   ```bash
   cd FoundryVTT-Nimble && pnpm deploy:nimble
   ```
   This builds compendia + system and rsyncs `dist/` to the remote server.

3. **Restart FoundryVTT** (only after a successful deploy):
   ```bash
   ssh ubuntu@foundryvtt.redirectme.net "pm2 restart foundry"
   ```
   > **Note:** If the restart command is different (e.g., `sudo systemctl restart foundry`), ask the user to confirm the correct command before running.

4. **Report** the deploy + restart result to the user.

## Deploy Logs

Each `pnpm deploy:nimble` run appends a line to `logs/deploy.log` via `scripts/deploy-log.sh`. See `references/deploy-logs.md` for the log format, location, and how to interpret failures.

## Error Handling

- If `pnpm deploy:nimble` fails, **stop immediately** and report the error — do NOT attempt to SSH or restart.
- If the SSH command fails, report the error and ask the user whether to retry or investigate the server.
- Check `logs/deploy.log` to review recent deploy history.
