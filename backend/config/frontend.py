import os
import mimetypes
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponse


def _repo_root() -> Path:
    # settings.BASE_DIR points to backend/; repo root is its parent
    return Path(settings.BASE_DIR).parent


def _candidate_dist_paths() -> list[Path]:
    # 1) explicit env override
    env = os.environ.get("FRONTEND_DIST")
    candidates: list[Path] = []
    if env:
        candidates.append(Path(env))

    # 2) common Angular 16+/20 output locations
    root = _repo_root()
    candidates.extend(
        [
            root / "frontend" / "dist" / "frontend" / "browser",
            root / "frontend" / "dist" / "browser",
            root / "frontend" / "dist",
        ]
    )
    return candidates


def _find_dist_root() -> Path | None:
    # Mode controls preference. Defaults to prototype (root index) if present.
    mode = os.environ.get("FRONTEND_MODE", "").lower()
    force_root = bool(os.environ.get("USE_ROOT_INDEX")) or mode in {"prototype", "root"}
    force_dist = bool(os.environ.get("USE_ANGULAR_DIST")) or mode in {"angular", "dist"}

    root_index = _repo_root() / "index.html"
    if root_index.exists() and not force_dist:
        # Prefer the root prototype unless explicitly told to use Angular dist
        return None

    if force_root:
        return None

    for path in _candidate_dist_paths():
        if path.is_dir() and (path / "index.html").exists():
            return path
    return None


def _read_index_html() -> str | None:
    # Prefer Angular build index.html
    dist = _find_dist_root()
    if dist is not None:
        return (dist / "index.html").read_text(encoding="utf-8")

    # Fallback to repo root index.html if present (non-Angular prototype)
    root_index = _repo_root() / "index.html"
    if root_index.exists():
        return root_index.read_text(encoding="utf-8")

    return None


def _inject_api_base(html: str) -> str:
    marker = "</head>"
    injection = (
        "<script>"
        "window.API_BASE = window.API_BASE || '/api';"
        "window.DG_API_BASE = window.DG_API_BASE || window.API_BASE;"
        "</script>\n"
    )
    try:
        idx = html.lower().rfind("</head>")
    except Exception:
        idx = -1
    if idx == -1:
        return injection + html
    return html[:idx] + injection + html[idx:]


def spa(request, path: str = ""):
    """
    Serve the Angular app (and its static assets) from the built dist folder.
    - If the request path matches a file in the dist folder, serve that file.
    - Otherwise, serve index.html (with API_BASE injection) to support SPA routing.
    - If no Angular build exists, fall back to the repo root index.html if present.
    """
    dist = _find_dist_root()

    # Try to serve a static file from dist if it exists
    if dist and path:
        # Prevent path traversal
        requested = (dist / path).resolve()
        try:
            dist_resolved = dist.resolve()
        except FileNotFoundError:
            dist_resolved = dist
        if str(requested).startswith(str(dist_resolved)) and requested.is_file():
            ctype, _ = mimetypes.guess_type(str(requested))
            return FileResponse(open(requested, "rb"), content_type=ctype or "application/octet-stream")

    # If no Angular build is present, serve assets from repo root to support
    # the prototype index.html (e.g., styles.css, app.js)
    if not dist and path:
        root_file = (_repo_root() / path).resolve()
        root_dir = _repo_root().resolve()
        if str(root_file).startswith(str(root_dir)) and root_file.is_file():
            ctype, _ = mimetypes.guess_type(str(root_file))
            return FileResponse(open(root_file, "rb"), content_type=ctype or "application/octet-stream")

    # Serve index.html (Angular build or root fallback)
    html = _read_index_html()
    if html is None:
        raise Http404("Frontend build not found. Run 'npm run build' in the frontend/ directory.")
    html = _inject_api_base(html)
    return HttpResponse(html, content_type="text/html")
