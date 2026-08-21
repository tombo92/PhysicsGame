"""
Bob — a physics game module.

Self-contained git submodule: router + template + static assets.
Repository: https://github.com/tombo92/PhysicsGame

Mounted by the homeserver at ``modules/physics/``; the game registry
autodiscovers any ``modules/<name>/router.py`` and includes its router.

Directory structure:
  modules/physics/
    router.py         ← this file
    __init__.py
    templates/bob.html
    static/bob.css, bob.js
    VERSION
"""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, Response

router = APIRouter(prefix="/game", tags=["games"])

_MODULE_DIR = Path(__file__).resolve().parent
_TEMPLATES_DIR = _MODULE_DIR / "templates"
_STATIC_DIR = _MODULE_DIR / "static"
_VERSION_FILE = _MODULE_DIR / "VERSION"

_MIME_MAP = {
    ".css": "text/css",
    ".js": "application/javascript",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".webp": "image/webp",
}


def _version() -> str:
    try:
        return _VERSION_FILE.read_text(encoding="utf-8").strip()
    except OSError:
        return "0.0.0"


@router.get("/bob", response_class=HTMLResponse)
async def bob_page():
    """The playable intro. The full game is still in development."""
    html = (_TEMPLATES_DIR / "bob.html").read_text(encoding="utf-8")
    return HTMLResponse(content=html.replace("{{VERSION}}", _version()))


@router.get("/bob/static/{filename}")
async def bob_static(filename: str):
    """Serve the module's own CSS/JS.

    The submodule lives outside server/static, so it needs its own tiny
    static route rather than the gateway's StaticFiles mount.
    """
    # Reject traversal and nested paths outright — only flat names are served.
    if "/" in filename or "\\" in filename or filename.startswith("."):
        raise HTTPException(status_code=404)

    path = (_STATIC_DIR / filename).resolve()
    if not path.is_file() or _STATIC_DIR.resolve() not in path.parents:
        raise HTTPException(status_code=404)

    media_type = _MIME_MAP.get(path.suffix.lower())
    if media_type is None:
        raise HTTPException(status_code=404)

    return Response(
        content=path.read_bytes(),
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=3600"},
    )


def health() -> dict:
    """Hook read by the gateway's arcade hub.

    Reports ``coming-soon`` rather than ``ok`` so the hub can label the
    card honestly: the intro is playable, but the game is not finished.
    """
    missing = _missing_assets()
    return {
        "ok": not missing,
        "status": "coming-soon" if not missing else "error",
        "detail": None if not missing else f"missing assets: {', '.join(missing)}",
    }


def _missing_assets() -> list[str]:
    return [
        str(p.relative_to(_MODULE_DIR))
        for p in (_TEMPLATES_DIR / "bob.html",
                  _STATIC_DIR / "bob.css",
                  _STATIC_DIR / "bob.js")
        if not p.is_file()
    ]


@router.get("/bob/api/health")
async def bob_health():
    """Reports whether the module's own assets are present."""
    missing = _missing_assets()
    return {
        "ok": not missing,
        "version": _version(),
        "status": "coming-soon",
        "missing": missing,
    }
