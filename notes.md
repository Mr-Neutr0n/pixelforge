# PixelForge notes

## Production target

- Frontend: Vercel at `https://pixelforge.harikp.com`
- API: shared EC2 at `https://api.pixelforge.harikp.com`
- Image model: Azure OpenAI `gpt-image-2`
- Database: local PostgreSQL with a dedicated database and role
- Object storage: the shared private S3 bucket under `pixelforge/assets/`

## Generation limits

A quota applies to complete sprite projects rather than individual provider calls. A client may start two projects per UTC day. The service may start 100 projects across all clients per UTC day. Each project permits at most ten Azure image calls for the character, four animation sheets, and limited edits or retries.

PostgreSQL admits projects atomically. The database stores only an HMAC of the client IP and a SHA-256 hash of the project token. Restarting the process does not reset quota.

## Remaining product work

- Add cleanup for S3 objects when a gallery entry is removed.
- Add an explicit gallery deletion flow before accepting user-owned private assets.
- Measure provider cost per successful sprite project.
- Review the generated-image policy before raising either daily limit.
