#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Local workbench server for content and digital-human production."""

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
from ffmpeg_video_renderer import render_edit_plan
from talking_video_editor import build_edit_plan, normalize_materials, safe_project_id, save_edit_plan


ROOT = Path(__file__).resolve().parent
PROJECT_DIR = ROOT / "custom_home_projects"
MATERIAL_DIR = ROOT / "custom_home_materials"
AVATAR_DIR = ROOT / "digital_human_assets"
PACKAGE_DIR = ROOT / "digital_human_packages"
TALKING_VIDEO_DIR = ROOT / "talking_video_projects"


def _safe_name(name: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', "-", str(name or "").strip())
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .")
    return cleaned[:80] or "未命名项目"


def _project_path(name: str) -> Path:
    return PROJECT_DIR / f"{_safe_name(name)}.json"


def _package_path(name: str) -> Path:
    return PACKAGE_DIR / f"{_safe_name(name)}.json"


def _relative_url(path: Path) -> str:
    return "/" + path.relative_to(ROOT).as_posix()


class CustomHomeHandler(SimpleHTTPRequestHandler):
    server_version = "CustomHomeAgent/1.3"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/":
            self.path = "/custom_home_agent.html"
            return super().do_GET()
        if parsed.path == "/api/projects":
            return self._send_json(self._list_projects())
        if parsed.path == "/api/digital-human/packages":
            return self._send_json(self._list_digital_human_packages())
        if parsed.path == "/api/talking-video/projects":
            return self._send_json(self._list_talking_video_projects())
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
        if parsed.path.startswith("/api/digital-human/packages/"):
            name = unquote(parsed.path.removeprefix("/api/digital-human/packages/"))
            path = _package_path(name)
            if not path.exists():
                return self._send_error(HTTPStatus.NOT_FOUND, "制作包不存在")
            return self._send_json(json.loads(path.read_text(encoding="utf-8")))
        if parsed.path.startswith("/api/talking-video/projects/"):
            project_id = safe_project_id(unquote(parsed.path.removeprefix("/api/talking-video/projects/")))
            path = TALKING_VIDEO_DIR / project_id / "project.json"
            if not path.exists():
                return self._send_error(HTTPStatus.NOT_FOUND, "talking video project not found")
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
            return self._save_project(self._read_json())
        if parsed.path == "/api/materials":
            return self._handle_material_upload()
        if parsed.path == "/api/talking-video/projects":
            return self._save_talking_video_project(self._read_json())
        if parsed.path == "/api/talking-video/assets":
            return self._handle_talking_video_asset_upload()
        if parsed.path == "/api/talking-video/plan":
            return self._generate_talking_video_plan(self._read_json())
        if parsed.path == "/api/talking-video/render":
            return self._render_talking_video(self._read_json())
        if parsed.path == "/api/refined-materials":
            return self._handle_refined_material_save()
        if parsed.path == "/api/digital-human/assets":
            return self._handle_digital_human_asset_upload()
        if parsed.path == "/api/digital-human/packages":
            return self._save_digital_human_package(self._read_json())
        if parsed.path == "/api/cloud/settings":
            return self._save_cloud_settings(self._read_json())
        if parsed.path == "/api/cloud/heygem/submit":
            payload = self._read_json()
            row = payload.get("row") or payload
            override = payload.get("payload")
            return self._send_json(submit_heygem_task(row, override))
        if parsed.path == "/api/cloud/avatar-clone/submit":
            payload = self._read_json()
            row = self._build_avatar_video_row(payload, task_type="avatar_clone")
            override = payload.get("payload")
            result = submit_heygem_task(row, override)
            return self._send_json({"ok": result.get("ok", False), "row": row, "result": result})
        if parsed.path == "/api/cloud/voice-clone/submit":
            payload = self._read_json()
            row = self._build_avatar_video_row(payload, task_type="voice_clone")
            override = payload.get("payload")
            result = submit_heygem_task(row, override)
            return self._send_json({"ok": result.get("ok", False), "row": row, "result": result})
        if parsed.path == "/api/cloud/avatar-video/submit":
            payload = self._read_json()
            row = self._build_avatar_video_row(payload, task_type="avatar_video")
            override = payload.get("payload")
            result = submit_heygem_task(row, override)
            return self._send_json({"ok": result.get("ok", False), "row": row, "result": result})
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
        if parsed.path.startswith("/api/digital-human/packages/"):
            name = unquote(parsed.path.removeprefix("/api/digital-human/packages/"))
            path = _package_path(name)
            if path.exists():
                path.unlink()
            return self._send_json({"ok": True, "packages": self._list_digital_human_packages()})
        if parsed.path.startswith("/api/talking-video/projects/"):
            project_id = safe_project_id(unquote(parsed.path.removeprefix("/api/talking-video/projects/")))
            path = TALKING_VIDEO_DIR / project_id
            if path.exists():
                import shutil

                shutil.rmtree(path)
            return self._send_json({"ok": True, "projects": self._list_talking_video_projects()})
        return self._send_error(HTTPStatus.NOT_FOUND, "接口不存在")

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        return json.loads(raw or "{}")

    def _save_project(self, payload: dict) -> None:
        name = _safe_name(str(payload.get("name") or ""))
        PROJECT_DIR.mkdir(exist_ok=True)
        payload["name"] = name
        _project_path(name).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return self._send_json({"ok": True, "name": name, "projects": self._list_projects()})

    def _save_cloud_settings(self, payload: dict) -> None:
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

    def _list_digital_human_packages(self) -> list[dict]:
        PACKAGE_DIR.mkdir(exist_ok=True)
        packages = []
        for path in sorted(PACKAGE_DIR.glob("*.json"), key=lambda item: item.stat().st_mtime, reverse=True):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                continue
            packages.append(
                {
                    "name": data.get("name") or path.stem,
                    "savedAt": data.get("savedAt") or "",
                    "scriptLength": len(data.get("script") or ""),
                    "background": (data.get("background") or {}).get("name", ""),
                }
            )
        return packages

    def _save_uploaded_files(self, form: cgi.FieldStorage, base_dir: Path, project: str) -> list[dict]:
        target_dir = base_dir / _safe_name(project)
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
            saved.append({"name": target.name, "url": _relative_url(target), "size": target.stat().st_size})
        return saved

    def _read_multipart(self) -> cgi.FieldStorage:
        return cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE": self.headers.get("Content-Type", ""),
                "CONTENT_LENGTH": self.headers.get("Content-Length", "0"),
            },
        )

    def _handle_material_upload(self) -> None:
        form = self._read_multipart()
        project = _safe_name(form.getfirst("project", "未命名项目"))
        saved = self._save_uploaded_files(form, MATERIAL_DIR, project)
        self._send_json({"ok": True, "project": project, "files": saved})

    def _handle_digital_human_asset_upload(self) -> None:
        form = self._read_multipart()
        project = _safe_name(form.getfirst("project", "未命名数字人"))
        role = _safe_name(form.getfirst("role", "assets"))
        saved = self._save_uploaded_files(form, AVATAR_DIR / role, project)
        self._send_json({"ok": True, "project": project, "role": role, "files": saved})

    def _save_digital_human_package(self, payload: dict) -> None:
        name = _safe_name(payload.get("name") or payload.get("title") or "数字人口播制作包")
        PACKAGE_DIR.mkdir(exist_ok=True)
        payload["name"] = name
        _package_path(name).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return self._send_json({"ok": True, "name": name, "packages": self._list_digital_human_packages()})

    def _build_avatar_video_row(self, payload: dict, task_type: str = "avatar_video") -> dict:
        title = str(payload.get("title") or payload.get("name") or "数字人口播视频").strip()
        script = str(payload.get("script") or "").strip()
        avatar = payload.get("avatar") or {}
        voice = payload.get("voice") or {}
        background = payload.get("background") or {}
        task_titles = {
            "avatar_clone": "克隆数字人形象",
            "voice_clone": "克隆数字人声音",
            "avatar_video": title,
        }
        return {
            "titles": [task_titles.get(task_type, title)],
            "script": script,
            "rewritten_script": script,
            "pillar": task_type,
            "cover": payload.get("cover") or task_titles.get(task_type, title),
            "dm_keyword": payload.get("dm_keyword") or "案例",
            "avatar_asset": avatar,
            "voice_asset": voice,
            "background": background,
            "avatar_asset_url": avatar.get("url", ""),
            "voice_asset_url": voice.get("url", ""),
            "background_url": background.get("url", ""),
            "task_type": task_type,
            "clone_mode": payload.get("clone_mode") or "avatar_voice_background",
            "aspect_ratio": payload.get("aspect_ratio") or "9:16",
            "visual_notes": payload.get("visual_notes") or "",
            "xiaohongshu_video_plan": [
                "使用用户真实背景作为主画面或场景底图",
                "数字人保持正脸口播，字幕使用小红书竖屏安全区",
                "口播结尾引导评论关键词或私信咨询",
            ],
        }

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
                    "url": _relative_url(target),
                    "size": target.stat().st_size,
                    "source": header,
                },
            }
        )

    def _talking_project_dir(self, project_id: str) -> Path:
        return TALKING_VIDEO_DIR / safe_project_id(project_id)

    def _list_talking_video_projects(self) -> list[dict]:
        TALKING_VIDEO_DIR.mkdir(exist_ok=True)
        projects = []
        for path in sorted(TALKING_VIDEO_DIR.glob("*/project.json"), key=lambda item: item.stat().st_mtime, reverse=True):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                continue
            projects.append(
                {
                    "id": data.get("id") or path.parent.name,
                    "name": data.get("name") or path.parent.name,
                    "savedAt": data.get("savedAt") or "",
                    "hasPlan": (path.parent / "edit_plan.json").exists(),
                    "hasRender": (path.parent / "renders" / "final.mp4").exists(),
                }
            )
        return projects

    def _save_talking_video_project(self, payload: dict) -> None:
        import datetime

        name = str(payload.get("name") or "鍙ｆ挱鍓緫椤圭洰")
        project_id = safe_project_id(payload.get("id") or name)
        project_dir = self._talking_project_dir(project_id)
        project_dir.mkdir(parents=True, exist_ok=True)
        data = {
            **payload,
            "id": project_id,
            "name": name,
            "savedAt": datetime.datetime.now().isoformat(timespec="seconds"),
        }
        (project_dir / "project.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        self._send_json({"ok": True, "project": data, "projects": self._list_talking_video_projects()})

    def _save_talking_video_uploaded_files(self, form: cgi.FieldStorage, target_dir: Path) -> list[dict]:
        target_dir.mkdir(parents=True, exist_ok=True)
        files = form["files"] if "files" in form else []
        if not isinstance(files, list):
            files = [files]
        saved = []
        project_dir = target_dir.parents[1]
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
                    "url": target.relative_to(project_dir).as_posix(),
                    "size": target.stat().st_size,
                }
            )
        return saved

    def _handle_talking_video_asset_upload(self) -> None:
        form = self._read_multipart()
        project = safe_project_id(form.getfirst("project", "talking-video"))
        role = safe_project_id(form.getfirst("role", "assets"))
        project_dir = self._talking_project_dir(project)
        saved = self._save_talking_video_uploaded_files(form, project_dir / "uploads" / role)
        self._send_json({"ok": True, "project": project, "role": role, "files": saved})

    def _validate_talking_video_media_path(self, value: object, field_name: str) -> str:
        path_text = str(value or "").strip().replace("\\", "/")
        if not path_text:
            raise ValueError(f"invalid media path: {field_name}")
        if "://" in path_text or Path(path_text).is_absolute():
            raise ValueError(f"invalid media path: {field_name}")
        parts = [part for part in path_text.split("/") if part]
        if any(part == ".." for part in parts):
            raise ValueError(f"invalid media path: {field_name}")
        return "/".join(parts)

    def _validate_talking_video_material_paths(self, materials: list[dict]) -> list[dict]:
        validated = []
        for index, material in enumerate(materials):
            item = dict(material)
            for key in ("url", "path"):
                if item.get(key):
                    item[key] = self._validate_talking_video_media_path(item[key], f"materials[{index}].{key}")
            validated.append(item)
        return validated

    def _parse_execute_flag(self, value: object) -> bool:
        if isinstance(value, bool):
            return value
        if value is None:
            return True
        if isinstance(value, str):
            return value.strip().lower() not in {"false", "0", "no", "off"}
        return bool(value)

    def _generate_talking_video_plan(self, payload: dict) -> None:
        project_id = safe_project_id(payload.get("projectId") or payload.get("name") or "talking-video")
        project_dir = self._talking_project_dir(project_id)
        project_dir.mkdir(parents=True, exist_ok=True)
        try:
            talking_video = self._validate_talking_video_media_path(
                payload.get("talkingVideo") or "uploads/talking.mp4",
                "talkingVideo",
            )
            material_payload = self._validate_talking_video_material_paths(payload.get("materials") or [])
        except ValueError as error:
            return self._send_error(HTTPStatus.BAD_REQUEST, str(error))
        materials = normalize_materials(material_payload)
        plan = build_edit_plan(
            project_id=project_id,
            talking_video=talking_video,
            script=payload.get("script") or payload.get("transcript") or "",
            materials=materials,
            duration=payload.get("duration"),
            aspect_ratio=payload.get("aspectRatio") or "9:16",
            title=payload.get("title"),
            cta=payload.get("cta"),
        )
        save_edit_plan(plan, project_dir / "edit_plan.json")
        self._send_json({"ok": True, "projectId": project_id, "plan": plan})

    def _render_talking_video(self, payload: dict) -> None:
        project_id = safe_project_id(payload.get("projectId") or "")
        if not project_id:
            return self._send_error(HTTPStatus.BAD_REQUEST, "missing projectId")
        project_dir = self._talking_project_dir(project_id)
        plan_path = project_dir / "edit_plan.json"
        if not plan_path.exists():
            return self._send_error(HTTPStatus.NOT_FOUND, "edit plan not found")
        plan = json.loads(plan_path.read_text(encoding="utf-8"))
        result = render_edit_plan(
            plan,
            project_dir,
            ffmpeg_path=payload.get("ffmpegPath") or "ffmpeg",
            execute=self._parse_execute_flag(payload.get("execute", True)),
        )
        self._send_json(result)

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
    parser = argparse.ArgumentParser(description="Run the local content workbench server.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), CustomHomeHandler)
    print(f"Custom home workbench: http://{args.host}:{args.port}/")
    print(f"Digital human studio: http://{args.host}:{args.port}/digital_human_studio.html")
    print(f"Projects folder: {PROJECT_DIR}")
    server.serve_forever()


if __name__ == "__main__":
    main()
