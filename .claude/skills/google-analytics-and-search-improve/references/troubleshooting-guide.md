# Troubleshooting Guide

Quick fixes for the most common errors when collecting or analyzing data with this skill.

---

## Authentication Errors

### `403 User does not have sufficient permission for site`

**Cause**: The credential has the right scopes but isn't authorized for the specific GSC property.

**Most common reason**: Using a Service Account that was never added as a user in Google Search Console.

**Fix**:
1. Add the SA email to GSC: Settings → Users and permissions → Add user → "Restricted"
2. Or switch to OAuth with the personal Google account that owns the property:
   ```bash
   mv "$DATA_DIR/configs/"*.json "$DATA_DIR/configs/service-account.json.bak"
   ```
   Then re-run the script. It will trigger OAuth login.

---

### `403 Request had insufficient authentication scopes`

**Cause**: The credential object being used by the API client doesn't have the required scopes (`webmasters.readonly` and/or `analytics.readonly`).

**Most common reasons**:

1. **ADC scope mismatch**: You ran `gcloud auth application-default login` but the default client doesn't have analytics/webmasters scopes. `utils.py` detects this and falls through to OAuth, but if you bypass `utils.py` or use a different auth path, you hit this error.

2. **GA4 client silently using ADC**: You called `get_credentials()` correctly but didn't pass `credentials=` to `BetaAnalyticsDataClient` or `AlphaAnalyticsDataClient`. The constructor auto-detects ADC instead of using your credential object.

**Fix for reason 1**: Run gcloud with explicit scopes:
```bash
gcloud auth application-default login \
  --scopes='https://www.googleapis.com/auth/webmasters.readonly,https://www.googleapis.com/auth/analytics.readonly'
```

**Fix for reason 2**: Always capture `_CREDENTIALS = get_credentials()` before importing Google client libs, then pass `credentials=_CREDENTIALS` to the constructor. See [data-collection-reference.md](data-collection-reference.md) §1d.

---

### `DefaultCredentialsError` / "Could not automatically determine credentials"

**Cause**: No credentials available at all (no SA key, no cached OAuth, no ADC, no client_secret.json).

**Fix**: Follow the auth setup in [data-collection-reference.md](data-collection-reference.md) §1. The fastest path is usually `gcloud auth application-default login --scopes=...`

---

### OAuth browser flow doesn't open

**Cause**: `google-auth-oauthlib` not installed, or running in a headless environment.

**Fix**:
```bash
source "$DATA_DIR/venv/bin/activate"
pip install google-auth-oauthlib
```

If running headless (e.g., remote server), the OAuth flow can't open a browser. Use one of these alternatives:
- Run the script locally first to generate `$DATA_DIR/.oauth-cache.json`, then copy the cache to the remote machine
- Use a Service Account instead
- Use `gcloud auth application-default login --scopes=...` on the remote machine

---

## GSC Errors

### `404 Site not found`

**Cause**: `GSC_SITE_URL` doesn't match the exact property format in Search Console.

**Fix**: Check your GSC property type:

| Property Type | Correct Format | Example |
|---|---|---|
| Domain property | `sc-domain:example.com` | `sc-domain:example.com` |
| URL-prefix property | Full URL | `https://example.com` |

In GSC, look at the property selector (top-left). If it shows a bare domain, use `sc-domain:`. If it shows a full URL, use the full URL.

---

### GSC returns empty results (zero rows)

**Cause 1**: The site has no search data yet (new site, not indexed).

**Cause 2**: Date range is too narrow — GSC has a ~2 day data delay.

**Cause 3**: Property format mismatch (see above).

**Fix**: Try `28daysAgo` to `yesterday` as the date range. If still empty, the site genuinely has no GSC data yet.

---

## GA4 Errors

### `400 Invalid property`

**Cause**: `GA4_PROPERTY_ID` doesn't exist, isn't a GA4 property, or the credential lacks access.

**Fix**: In GA4 Admin → Property Settings, confirm the Property ID is numeric (e.g., `123456789`). Make sure the credential (SA or OAuth user) has at least "Viewer" role on the property.

---

### GA4 returns zero users/sessions

**Cause 1**: The property is new and has no traffic yet.

**Cause 2**: Data retention settings are too short — GA4 defaults to 2 months for some reports.

**Cause 3**: Using a GA4 property that receives data from a different source (e.g., Firebase app instead of web).

**Fix**: Check the GA4 web UI for the same date range. If the UI also shows zero, the property genuinely has no data.

---

### `403 User does not have sufficient permission for this property`

**Cause**: Same as GSC — credential lacks GA4 property access.

**Fix**: In GA4 Admin → Property Access Management, add the SA email with "Viewer" role. Or switch to OAuth with the owner's account.

---

## PageSpeed Insights Errors

### `429 Quota exceeded`

**Cause**: PSI API quota exceeded. The free quota is 25 queries per 100 seconds.

**Fix**: Enable the PageSpeed Insights API in your Google Cloud project ([API Library](https://console.cloud.google.com/apis/library)). If already enabled, wait a few minutes and retry. For high-volume auditing, add a PSI API key to `.env` as `PSI_API_KEY`.

---

### PSI returns null scores

**Cause**: The URL is unreachable (blocked by robots, behind auth, or down), or the page takes too long to load.

**Fix**: Verify the page loads in a browser. Check for `X-Robots-Tag: noindex` headers or firewall blocks.

---

## Data Collection Script Errors

### `ModuleNotFoundError: No module named 'google'`

**Cause**: Running with system Python instead of the skill's venv.

**Fix**:
```bash
source "$DATA_DIR/venv/bin/activate"
python scripts/xxx.py ...
```

---

### Scripts hang or timeout

**Cause 1**: OAuth browser flow is waiting for interaction.

**Cause 2**: API pagination is fetching too many rows.

**Fix for cause 1**: Check if a browser window opened. If headless, use SA or pre-cache OAuth token.

**Fix for cause 2**: Add `--limit` to cap rows, or filter dimensions to narrow the query.

---

## Analysis Errors

### Charts fail with `FontNotFound`

**Cause**: matplotlib can't find a font that supports the characters in your data (e.g., CJK characters in page titles or queries).

**Fix**: Install a CJK font or configure matplotlib fallback. See [data-visualization-guide.md](data-visualization-guide.md) §CJK Font Support.

---

### Analysis script can't find data files

**Cause**: Running the script from the wrong directory, or data files weren't collected.

**Fix**: Always run from the skill root. Check that `$DATA_DIR/data/` contains the expected `.json` files before running analysis.

---

## Deployment Gotchas (Vercel + GitHub)

### Vercel deployments fail with "No GitHub account was found matching the commit author email address"

**Cause**: Git commit author email doesn't match any linked GitHub account in Vercel.

**Fix**: Ensure git is configured with the email associated with your GitHub account:
```bash
git config --global user.email "your-github-email@example.com"
git config --global user.name "YourGitHubUsername"
```

Then amend the last commit and force-push:
```bash
git commit --amend --no-edit
git push --force-with-lease origin main
```

---

## General Debugging Tips

1. **Run scripts with `-o` to save output**: `python scripts/gsc_query.py -o data/debug.json`
2. **Check the credential tier being used**: `utils.py` prints which tier (SA, cached OAuth, ADC, fresh OAuth) to stderr when falling through tiers.
3. **Verify scopes with tokeninfo**: If you have an access token, query `https://oauth2.googleapis.com/tokeninfo?access_token=TOKEN` to see actual scopes.
4. **Test GSC access first**: GSC auth is simpler than GA4. If GSC works but GA4 doesn't, it's likely a scope or property permission issue.
5. **Check `.env` values**: Common mistakes: wrong property type prefix (`https://` vs `sc-domain:`), wrong GA4 Property ID, missing trailing slash in URL-prefix properties.
