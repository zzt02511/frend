#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Local workbench server for the custom-home content pipeline."""

from __future__ import annotations

import argparse
import base64
import cgi
import json
import re
from dataclasses import asdict
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

from cloud_runtime_client import (
    CloudRuntimeSettings,
    health_check,
    load_settings,
    public_settings,
    save_settings,
    submit_heygem_task,
    submit_tts_task,
)
from custom_home_agent import CaseInput, generate_outputs


ROOT = Path(__file__).resolve().parent
PROJECT_DIR = ROOT / "custom_home_projects"
MATERIAL_DIR = ROOT / "custom_home_materials"


def _safe_name(name: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', "-", str(name or "").strip())
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .")
    return cleaned[:80] or "未命名项目"


def _project_path(name: str) -> Path:
    return PROJECT_DIR / f"{_safe_name(name)}.json"


class CustomHomeHandler(SimpleHTTPRequestHandler):
    server_version = "CustomHomeAgent/1.2"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/":
            self.path = "/custom_home_agent.html"
            return super().do_GET()
        if parsed.path == "/api/projects":
            return self._send_json(self._list_projects())
        if parsed.path == "/api/cloud/settings":
            return self._send_json(public_settings(load_settings()))
        if parsed.path == "/api/cloud/health":
            return self._send_json(health_check(load_settings()))
        if parsed.path.startswith("/api/projects/"):
            name = unquote(parsed.path.removeprefix("/api/projects/"))
            path = _project_path(name)
            if not path.exists():
                return self._send_error(HTTPStatus.NOT_FOUND, "项目不存在")
            return self._send_json(json.loads(path.read_text(encoding="utf-8")))
        return super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/generate":
            payload = self._read_json()
            case = CaseInput(**{key: value for key, value in payload.items() if key in CaseInput.__dataclass_fields__})
            rows = [asdict(item) for item in generate_outputs(case)]
            return self._send_json({"rows": rows})
        if parsed.path == "/api/projects":
            payload = self._read_json()
            name = _safe_name(str(payload.get("name") or ""))
            PROJECT_DIR.mkdir(exist_ok=True)
            payload["name"] = name
            _project_path(name).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
            return self._send_json({"ok": True, "name": name, "projects": self._list_projects()})
        if parsed.path == "/api/materials":
            return self._handle_material_upload()
        if parsed.path == "/api/refined-materials":
            return self._handle_refined_material_save()
        if parsed.path == "/api/cloud/settings":
            payload = self._read_json()
            current = load_settings()
            for secret_key in ("api_key", "avatar_api_key", "voice_api_key"):
                if payload.get(secret_key) in ("", "***", None):
                    payload.pop(secret_key, None)
            merged = {**current.__dict__, **payload}
            settings = save_settings(
                CloudRuntimeSettings(
                    **{
                        key: value
                        for key, value in merged.items()
                        if key in CloudRuntimeSettings.__dataclass_fields__
                    }
                )
            )
            return self._send_json({"ok": True, "settings": public_settings(settings)})
        if parsed.path == "/api/cloud/heygem/submit":
            payload = self._read_json()
            row = payload.get("row") or payload
            override = payload.get("payload")
            return self._send_json(submit_heygem_task(row, override))
        if parsed.path == "/api/cloud/tts/submit":
            payload = self._read_json()
            text = payload.get("text") or payload.get("script") or ""
            override = payload.get("payload")
            return self._send_json(submit_tts_task(text, override))
        return self._send_error(HTTPStatus.NOT_FOUND, "接口不存在")

    def do_DELETE(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/projects/"):
            name = unquote(parsed.path.removeprefix("/api/projects/"))
            path = _project_path(name)
            if path.exists():
                path.unlink()
            return self._send_json({"ok": True, "projects": self._list_projects()})
        return self._send_error(HTTPStatus.NOT_FOUND, "接口不存在")

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        return json.loads(raw or "{}")

    def _list_projects(self) -> list[dict]:
        PROJECT_DIR.mkdir(exist_ok=True)
        projects = []
        for path in sorted(PROJECT_DIR.glob("*.json"), key=lambda item: item.stat().st_mtime, reverse=True):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                continue
            projects.append(
                {
                    "name": data.get("name") or path.stem,
                    "savedAt": data.get("savedAt") or "",
                    "count": len(data.get("rows") or []),
                }
            )
        return projects

    def _handle_material_upload(self) -> None:
        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE": self.headers.get("Content-Type", ""),
                "CONTENT_LENGTH": self.headers.get("Content-Length", "0"),
            },
        )
        project = _safe_name(form.getfirst("project", "未命名项目"))
        target_dir = MATERIAL_DIR / project
        target_dir.mkdir(parents=True, exist_ok=True)
        files = form["files"] if "files" in form else []
        if not isinstance(files, list):
            files = [files]
        saved = []
        for item in files:
            if not getattr(item, "filename", ""):
                continue
            filename = _safe_name(Path(item.filename).name)
            target = target_dir / filename
            stem = target.stem
            suffix = target.suffix
            counter = 2
            while target.exists():
                target = target_dir / f"{stem}-{counter}{suffix}"
                counter += 1
            with target.open("wb") as handle:
                while True:
                    chunk = item.file.read(1024 * 1024)
                    if not chunk:
                        break
                    handle.write(chunk)
            saved.append(
                {
                    "name": target.name,
                    "url": f"/custom_home_materials/{project}/{target.name}",
                    "size": target.stat().st_size,
                }
            )
        self._send_json({"ok": True, "project": project, "files": saved})

    def _handle_refined_material_save(self) -> None:
        payload = self._read_json()
        project = _safe_name(payload.get("project") or "未命名项目")
        filename = _safe_name(payload.get("filename") or "refined-material.png")
        if not filename.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
            filename = f"{filename}.png"

        data_url = str(payload.get("dataUrl") or "")
        if "," not in data_url:
            return self._send_error(HTTPStatus.BAD_REQUEST, "缺少图片 dataUrl")
        header, encoded = data_url.split(",", 1)
        try:
            raw = base64.b64decode(encoded)
        except Exception:
            return self._send_error(HTTPStatus.BAD_REQUEST, "图片数据解析失败")

        target_dir = MATERIAL_DIR / project / "refined"
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / filename
        stem = target.stem
        suffix = target.suffix or ".png"
        counter = 2
        while target.exists():
            target = target_dir / f"{stem}-{counter}{suffix}"
            counter += 1
        target.write_bytes(raw)
        self._send_json(
            {
                "ok": True,
                "project": project,
                "file": {
                    "name": target.name,
                    "url": f"/custom_home_materials/{project}/refined/{target.name}",
                    "size": target.stat().st_size,
                    "source": header,
                },
            }
        )

    def _send_json(self, payload: object, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _send_error(self, status: HTTPStatus, message: str) -> None:
        self._send_json({"ok": False, "error": message}, status)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the custom-home local workbench server.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), CustomHomeHandler)
    print(f"Custom home workbench: http://{args.host}:{args.port}/")
    print(f"Projects folder: {PROJECT_DIR}")
    print("Cloud runtime API: /api/cloud/settings, /api/cloud/health, /api/cloud/heygem/submit")
    server.serve_forever()


if __name__ == "__main__":
    main()
