# PixelForge deployment

The frontend remains on Vercel at `https://pixelforge.harikp.com`. The Node API runs on the shared Ubuntu ARM64 EC2 host at `127.0.0.1:8104`. Nginx terminates TLS for `https://api.pixelforge.harikp.com`. PostgreSQL runs locally. Final images use the shared private S3 bucket under `pixelforge/assets/`.

Migrated 2026-09-17 to the `Hari Personal` member account `514903006142`: EC2 host, Elastic IP (unchanged), EBS, IAM role, S3 objects, backups, alarms, and SSM parameters. The S3 bucket is `hari-sideprojects-prod-514903006142-ap-south-1`.

## External resources

- Shared `m6g.medium` EC2 in `ap-south-1` with encrypted gp3 storage and an Elastic IP (resized from `t4g.medium` at the 2026-09-17 account migration; t4g capacity was unavailable).
- Security group with public TCP 80 and 443. Restrict TCP 22 to the operator address. Keep 5432 and 8104 private.
- Shared private S3 bucket. The instance role may read and write `pixelforge/assets/*` and write PostgreSQL backups under its backup prefixes.
- Azure OpenAI resource with a deployed `gpt-image-2` model.
- GoDaddy A record for `api.pixelforge.harikp.com` after direct readiness checks pass.

## Database

Create a dedicated role and database. Keep PostgreSQL on localhost.

```sql
CREATE ROLE pixelforge LOGIN;
\password pixelforge
CREATE DATABASE pixelforge OWNER pixelforge;
REVOKE CONNECT ON DATABASE pixelforge FROM PUBLIC;
GRANT CONNECT ON DATABASE pixelforge TO pixelforge;
\connect pixelforge
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO pixelforge;
```

The API creates the current schema at startup. Future schema changes need ordered migrations before production data exists.

## Environment

Install `backend/env.example` as `/etc/pixelforge/pixelforge.env`, owned by `root:pixelforge` with mode `0640`. Replace every placeholder. Use the EC2 instance role for S3. Do not place AWS access keys in the environment.

`IP_HASH_PEPPER` must be a new random value. Changing it resets the identity used for per-IP daily quota. `ALLOWED_IMAGE_HOSTS` must list only the exact S3 hostname used for saved PixelForge images.

## Release

Build each reviewed commit in an immutable release directory:

```bash
RELEASE_ID="$(date -u +%Y%m%dT%H%M%SZ)-$(git rev-parse --short HEAD)"
RELEASE_DIR="/opt/sideprojects/pixelforge/releases/$RELEASE_ID"
sudo install -d -o root -g pixelforge -m 0750 "$RELEASE_DIR"
sudo git archive HEAD | sudo tar -x -C "$RELEASE_DIR"
cd "$RELEASE_DIR/backend"
sudo npm ci --omit=dev
sudo npm run build
sudo chown -R root:pixelforge "$RELEASE_DIR"
sudo chmod -R u=rwX,g=rX,o= "$RELEASE_DIR"
sudo ln -s "$RELEASE_DIR" "/opt/sideprojects/pixelforge/.current-$RELEASE_ID"
sudo mv -Tf "/opt/sideprojects/pixelforge/.current-$RELEASE_ID" /opt/sideprojects/pixelforge/current
sudo systemctl restart pixelforge
```

Install the tracked systemd and Nginx files on the first release. Certbot edits the installed Nginx file, so routine releases must not overwrite it.

## Verification

```bash
curl -fsS http://127.0.0.1:8104/health
curl -fsS http://127.0.0.1:8104/ready
curl -fsS http://127.0.0.1:8104/api/rate-limit
sudo journalctl -u pixelforge -n 200 --no-pager
```

Verify the quota against PostgreSQL before DNS cutover:

- A client can start two sprite projects in one UTC day.
- A third project from the same client returns HTTP 429.
- Existing project tokens survive an API restart.
- A token works only from the address that created it.
- A project stops after ten Azure image calls.
- The global counter cannot exceed 100 under concurrent requests.

Then test one complete project, gallery save, S3 read, share page, and ZIP export.

## TLS and cutover

After the API works through Nginx and DNS points at the Elastic IP:

```bash
sudo certbot --nginx -d api.pixelforge.harikp.com --redirect
curl -fsS https://api.pixelforge.harikp.com/ready
```

Set Vercel `NEXT_PUBLIC_API_URL=https://api.pixelforge.harikp.com`, deploy, and repeat the complete browser flow.

## Backup and rollback

Include the `pixelforge` database in the host's nightly custom-format PostgreSQL dumps to S3. Test a disposable restore monthly. Keep at least two application releases. Roll back by switching `/opt/sideprojects/pixelforge/current`, restarting the unit, and checking `/ready`. Database changes must remain compatible with rollback-eligible releases.
