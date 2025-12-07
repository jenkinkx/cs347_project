import os
import mimetypes
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponse


def _repo_root() -> Path:
    # settings.BASE_DIR points to backend/; repo root is its parent
    return Path(settings.BASE_DIR).parent


def _candidate_dist_paths() -> list[Path]:
    # Angular support removed: always return empty
    return []


def _find_dist_root() -> Path | None:
    # Angular/Dist disabled; always serve the root prototype if present
    return None


def _read_index_html() -> str | None:
    # Serve repo root index.html (prototype)
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
    Serve the prototype app from repo root. Static assets like styles.css and app.js
    are served directly; otherwise return index.html (with API_BASE injection).
    """
    # Serve assets from repo root (prototype index and static files)
    if path:
        root_file = (_repo_root() / path).resolve()
        root_dir = _repo_root().resolve()
        if str(root_file).startswith(str(root_dir)) and root_file.is_file():
            ctype, _ = mimetypes.guess_type(str(root_file))
            return FileResponse(open(root_file, "rb"), content_type=ctype or "application/octet-stream")

    # Serve index.html (prototype)
    html = _read_index_html()
    if html is None:
        raise Http404("Frontend not found. Place index.html, app.js, styles.css in repo root.")
    html = _inject_api_base(html)
    return HttpResponse(html, content_type="text/html")
