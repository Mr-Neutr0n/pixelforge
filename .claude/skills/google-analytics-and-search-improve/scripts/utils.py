"""Shared utilities for all skill scripts.

Centralizes:
- Data directory discovery (.skills-data/google-analytics-and-search-improve/)
- .env loading
- Google credential auto-discovery (Service Account, GWS/CC OAuth, ADC, interactive OAuth)
- Warning suppression for clean output
"""

import json
import os
import re
import shutil
import subprocess
import sys
import warnings
from pathlib import Path

# ---------------------------------------------------------------------------
# Suppress noisy warnings before any third-party imports
# ---------------------------------------------------------------------------
# FutureWarning: Python 3.9 EOL notices from google-auth / google-api-core
# NotOpenSSLWarning: urllib3 v2 + LibreSSL on macOS
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", message=".*urllib3.*OpenSSL.*")

from dotenv import load_dotenv


# ---------------------------------------------------------------------------
# Data directory discovery
# ---------------------------------------------------------------------------

_SKILL_DIR_NAME = "google-analytics-and-search-improve"


def find_data_dir() -> Path | None:
    """Locate .skills-data/google-analytics-and-search-improve/ by walking up
    from this script's directory toward the filesystem root.

    Returns the Path if found, or None.
    """
    d = Path(__file__).resolve().parent
    while d != d.parent:
        candidate = d / ".skills-data" / _SKILL_DIR_NAME
        if candidate.is_dir():
            return candidate
        d = d.parent
    return None


DATA_DIR: Path | None = find_data_dir()


# ---------------------------------------------------------------------------
# .env loading (runs once at import time)
# ---------------------------------------------------------------------------

if DATA_DIR:
    _env_path = DATA_DIR / ".env"
    if _env_path.exists():
        load_dotenv(_env_path)


# ---------------------------------------------------------------------------
# Scopes needed for GSC + GA4
# ---------------------------------------------------------------------------

GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly"
ALL_SCOPES = [GSC_SCOPE, GA4_SCOPE]


# ---------------------------------------------------------------------------
# Google credential discovery — SA, GWS/CC, cache, ADC, interactive OAuth
# ---------------------------------------------------------------------------

# Prefer the shared GWS Desktop OAuth client ("CC") over a skill-only client.
_GWS_CONFIG_DIR = Path(
    os.environ.get("GOOGLE_WORKSPACE_CLI_CONFIG_DIR", Path.home() / ".config" / "gws")
)


def find_google_credentials() -> str | None:
    """Auto-discover a Google Service Account JSON key.

    Resolution order:
    1. ``GOOGLE_APPLICATION_CREDENTIALS`` env var (if set and file exists)
    2. First ``*.json`` file (alphabetically) inside ``DATA_DIR/configs/``
       (excluding client_secret.json and backup files)

    Returns the path string, or None if no SA key is found.
    """
    # 1. Explicit env var takes priority
    explicit = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if explicit and Path(explicit).is_file():
        return explicit

    # 2. Auto-discover from configs/ (skip client_secret and backups)
    if DATA_DIR:
        configs_dir = DATA_DIR / "configs"
        if configs_dir.is_dir():
            json_files = sorted(
                f for f in configs_dir.glob("*.json")
                if f.name not in ("client_secret.json",)
                and not f.name.endswith(".bak.json")
                and not f.name.endswith(".bak")
            )
            if json_files:
                path = str(json_files[0])
                os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = path
                return path

    return None


def adc_available() -> bool:
    """Check if Application Default Credentials (ADC) are available.

    ADC works with:
    - gcloud auth application-default login
    - GOOGLE_APPLICATION_CREDENTIALS env var
    - Compute Engine / Cloud Run metadata service
    """
    try:
        from google.auth import default as google_auth_default
        from google.auth.exceptions import DefaultCredentialsError
        try:
            _, _ = google_auth_default(scopes=None)
            return True
        except DefaultCredentialsError:
            return False
    except ImportError:
        return False


def _cache_path() -> Path | None:
    if DATA_DIR:
        return DATA_DIR / ".oauth-cache.json"
    return None


def _load_cached_credentials(scopes: list[str]) -> dict | None:
    """Load cached OAuth token info if it covers the requested scopes."""
    cache = _cache_path()
    if not cache or not cache.exists():
        return None
    try:
        with open(cache, "r") as f:
            data = json.load(f)
        cached_scopes = set(data.get("scopes", []))
        needed = set(scopes)
        if not needed.issubset(cached_scopes):
            return None
        return data
    except (json.JSONDecodeError, KeyError):
        return None


def _save_cached_credentials(token_info: dict) -> None:
    cache = _cache_path()
    if cache:
        with open(cache, "w") as f:
            json.dump(token_info, f, indent=2)


def _token_scopes(access_token: str) -> set[str] | None:
    """Query tokeninfo endpoint to discover actual scopes on a token.

    Returns None if the endpoint is unreachable or the token is invalid.
    """
    import urllib.request
    import urllib.error
    url = f"https://oauth2.googleapis.com/tokeninfo?access_token={access_token}"
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))
        scope_str = data.get("scope", "")
        return set(scope_str.split()) if scope_str else set()
    except (urllib.error.HTTPError, urllib.error.URLError, json.JSONDecodeError):
        return None


def _credentials_cover_scopes(creds, scopes: list[str]) -> bool:
    """Return True if creds have a usable token that includes all needed scopes."""
    if not creds or not getattr(creds, "token", None):
        return False
    declared = set(creds.scopes or [])
    needed = set(scopes)
    if declared and needed.issubset(declared):
        return True
    actual = _token_scopes(creds.token)
    if actual is None:
        # tokeninfo unavailable — trust declared scopes / refresh success
        return bool(declared) and needed.issubset(declared)
    return needed.issubset(actual)


def _credentials_from_cache(data: dict, scopes: list[str]):
    """Build google.oauth2.credentials.Credentials from cached token info."""
    from google.oauth2.credentials import Credentials
    return Credentials(
        token=data.get("token"),
        refresh_token=data.get("refresh_token"),
        token_uri=data.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=data["client_id"],
        client_secret=data["client_secret"],
        scopes=data.get("scopes", scopes),
    )


def _try_refresh_cached(data: dict, scopes: list[str]):
    """Silently refresh cached token data. Returns creds or None."""
    if not data or not data.get("refresh_token"):
        return None
    try:
        from google.auth.transport.requests import Request
        creds = _credentials_from_cache(data, scopes)
        if not creds.valid:
            creds.refresh(Request())
        if not _credentials_cover_scopes(creds, scopes):
            return None
        actual = _token_scopes(creds.token) or set(creds.scopes or scopes)
        _save_cached_credentials({
            "token": creds.token,
            "refresh_token": creds.refresh_token,
            "token_uri": creds.token_uri,
            "client_id": creds.client_id,
            "client_secret": creds.client_secret,
            "scopes": sorted(actual),
            "source": data.get("source", "oauth-cache"),
        })
        return creds
    except Exception:
        return None


def _parse_json_payload(text: str) -> dict | None:
    """Extract a trailing JSON object from CLI output that may have a preamble."""
    text = (text or "").strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}\s*$", text)
        if not match:
            return None
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None


def _gws_client_secret_path() -> Path | None:
    p = _GWS_CONFIG_DIR / "client_secret.json"
    return p if p.is_file() else None


def _find_client_secret() -> Path | None:
    """Prefer the shared GWS/CC Desktop client, then the skill-local copy."""
    gws = _gws_client_secret_path()
    if gws:
        return gws
    if DATA_DIR:
        p = DATA_DIR / "configs" / "client_secret.json"
        if p.exists():
            return p
    return None


def _gws_auth_status() -> dict | None:
    if not shutil.which("gws"):
        return None
    try:
        result = subprocess.run(
            ["gws", "auth", "status"],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    return _parse_json_payload(result.stdout) or _parse_json_payload(result.stderr)


def _gws_auth_export() -> dict | None:
    """Export GWS/CC credentials with secrets unmasked for silent refresh."""
    if not shutil.which("gws"):
        return None
    try:
        # Default `gws auth export` masks client_secret/refresh_token; --unmasked
        # is required for programmatic token refresh.
        result = subprocess.run(
            ["gws", "auth", "export", "--unmasked"],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    data = _parse_json_payload(result.stdout) or _parse_json_payload(result.stderr)
    if not data or not data.get("refresh_token") or not data.get("client_id"):
        return None
    # Reject still-masked payloads (older gws or failed decrypt)
    secret = data.get("client_secret") or ""
    refresh = data.get("refresh_token") or ""
    if "..." in secret or "..." in refresh:
        return None
    return data


def _try_gws_credentials(scopes: list[str]):
    """Reuse the shared GWS/CC OAuth token if it already covers needed scopes."""
    status = _gws_auth_status()
    if status:
        status_scopes = set(status.get("scopes") or [])
        if status_scopes and not set(scopes).issubset(status_scopes):
            return None
        if status.get("token_valid") is False and not status.get("has_refresh_token"):
            return None

    exported = _gws_auth_export()
    if not exported:
        return None

    # Request only the scopes this skill needs (must be a subset of the GWS grant).
    # Passing the full GWS scope list can warn about openid alias mismatches.
    data = {
        "token": None,
        "refresh_token": exported.get("refresh_token"),
        "token_uri": "https://oauth2.googleapis.com/token",
        "client_id": exported["client_id"],
        "client_secret": exported.get("client_secret"),
        "scopes": list(scopes),
        "source": "gws",
    }
    return _try_refresh_cached(data, scopes)


def _try_adc_credentials(scopes: list[str]):
    """Use Application Default Credentials only when they already include needed scopes."""
    try:
        from google.auth import default as google_auth_default
        from google.auth.exceptions import DefaultCredentialsError
        from google.auth.transport.requests import Request
    except ImportError:
        return None

    try:
        creds, _ = google_auth_default(scopes=scopes)
    except DefaultCredentialsError:
        return None

    try:
        if not creds.valid:
            creds.refresh(Request())
    except Exception:
        return None

    if not _credentials_cover_scopes(creds, scopes):
        return None
    return creds


def _union_gws_login_scopes(extra_scopes: list[str] | None = None) -> str:
    """Build a comma-separated scope list that preserves existing GWS scopes."""
    extra = list(extra_scopes or ALL_SCOPES)
    existing: list[str] = []
    status = _gws_auth_status()
    if status and status.get("scopes"):
        existing = list(status["scopes"])
    if not existing:
        # Sensible defaults matching a typical `gws auth login --full` install.
        existing = [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
            "https://www.googleapis.com/auth/cloud-platform",
            "https://www.googleapis.com/auth/drive",
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/documents",
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/presentations",
            "https://www.googleapis.com/auth/tasks",
            "https://www.googleapis.com/auth/pubsub",
        ]
    merged: list[str] = []
    for scope in existing + extra:
        if scope not in merged:
            merged.append(scope)
    return ",".join(merged)


def _run_oauth_flow(client_secret_path: Path, scopes: list[str]):
    """Run interactive OAuth 2.0 installed-app flow (last resort only)."""
    try:
        from google_auth_oauthlib.flow import InstalledAppFlow
    except ImportError as exc:
        raise RuntimeError(
            "google-auth-oauthlib is required for interactive OAuth.\n"
            "Install it: pip install google-auth-oauthlib"
        ) from exc

    print(
        "INFO: No usable cached/GWS credentials — opening browser for OAuth "
        f"(client={client_secret_path}).",
        file=sys.stderr,
    )
    flow = InstalledAppFlow.from_client_secrets_file(
        str(client_secret_path), scopes=scopes
    )
    # prompt=consent only when we truly need a fresh grant
    creds = flow.run_local_server(port=0, prompt="consent")

    token_info = {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": list(creds.scopes or []),
        "source": "interactive-oauth",
    }
    _save_cached_credentials(token_info)
    return creds


def _oauth_setup_message() -> str:
    union = _union_gws_login_scopes(ALL_SCOPES)
    return (
        "Google credentials missing or broken for GSC/GA4.\n"
        "\n"
        "PREFERRED FIX (reuse the shared GWS/CC Desktop OAuth app — preserves existing scopes):\n"
        f"  gws auth login --scopes='{union}'\n"
        "\n"
        "Do NOT run a narrow `gcloud auth application-default login --scopes=analytics,webmasters`\n"
        "login — that replaces ADC scopes and can drop cloud-platform / other grants.\n"
        "\n"
        "After login succeeds, re-run the skill script. It will reuse GWS credentials\n"
        "silently and will not open a browser unless auth is broken.\n"
    )


def credentials_are_healthy(scopes: list[str] | None = None) -> bool:
    """Return True if silent credential resolution works (no browser needed)."""
    scopes = scopes or ALL_SCOPES
    try:
        # Probe without triggering interactive OAuth.
        if find_google_credentials():
            return True
        if _try_gws_credentials(scopes) is not None:
            return True
        if _try_refresh_cached(_load_cached_credentials(scopes) or {}, scopes) is not None:
            return True
        if _try_adc_credentials(scopes) is not None:
            return True
        return False
    except Exception:
        return False


def get_credentials(scopes: list[str] | None = None):
    """Return usable Google credentials with the requested scopes.

    Priority (browser only as last resort when auth is broken):
    1. Service Account JSON key (from configs/ or env var)
    2. Shared GWS/CC OAuth credentials (`gws auth export`) if scopes cover the need
    3. Skill-local cached OAuth token (silent refresh)
    4. Application Default Credentials, only if token already has required scopes
    5. Interactive OAuth via the GWS/CC Desktop client_secret (last resort)

    Raises RuntimeError if no credentials are available.
    """
    scopes = scopes or ALL_SCOPES

    # 1. Service Account
    sa_path = find_google_credentials()
    if sa_path:
        from google.oauth2 import service_account
        return service_account.Credentials.from_service_account_file(
            sa_path, scopes=scopes
        )

    # 2. Shared GWS/CC token — preferred user OAuth path
    gws_creds = _try_gws_credentials(scopes)
    if gws_creds is not None:
        return gws_creds

    # 3. Skill-local OAuth cache
    cached = _load_cached_credentials(scopes)
    cached_creds = _try_refresh_cached(cached or {}, scopes)
    if cached_creds is not None:
        return cached_creds
    if cached:
        # Cache exists but is stale / missing scopes — drop it, do not browser yet
        cache = _cache_path()
        if cache and cache.exists():
            print(
                "INFO: Skill OAuth cache is stale or missing required scopes; "
                "trying other silent credential sources before any browser login.",
                file=sys.stderr,
            )
            cache.unlink()

    # 4. ADC only when it already has the right scopes
    adc_creds = _try_adc_credentials(scopes)
    if adc_creds is not None:
        return adc_creds

    # 5. Last resort: interactive browser OAuth with the shared GWS/CC client
    client_secret = _find_client_secret()
    if client_secret:
        return _run_oauth_flow(client_secret, scopes)

    raise RuntimeError(_oauth_setup_message())


def require_google_credentials() -> str:
    """Deprecated. Use :func:`get_credentials` instead.

    Kept for backward compat with scripts that call it for side effects.
    """
    path = find_google_credentials()
    if not path:
        if credentials_are_healthy(ALL_SCOPES):
            return "adc_or_oauth"
        print(
            "Error: No Google credentials found.\n" + _oauth_setup_message(),
            file=sys.stderr,
        )
        sys.exit(1)
    return path
