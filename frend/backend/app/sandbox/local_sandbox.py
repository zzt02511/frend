"""本地沙箱 - 无 Docker 的子进程隔离执行"""

import asyncio
import os
import signal
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SandboxResult:
    success: bool
    output_path: str = ""
    stdout: str = ""
    stderr: str = ""
    error: str = ""
    duration_s: float = 0.0


class LocalSandbox:
    """FFmpeg 子进程沙箱 - 隔离执行 + 资源限制"""

    def __init__(self, ffmpeg_path: str = "ffmpeg"):
        self.ffmpeg_path = ffmpeg_path
        self._running_processes: dict[str, asyncio.subprocess.Process] = {}

    async def run_ffmpeg(
        self,
        args: list[str],
        job_id: str = "",
        timeout: int = 300,
        working_dir: Optional[str] = None,
    ) -> SandboxResult:
        """执行 FFmpeg 命令"""
        import time

        # 验证命令
        if args[0] != self.ffmpeg_path:
            args = [self.ffmpeg_path] + args

        start = time.time()

        try:
            proc = await asyncio.create_subprocess_exec(
                *args,
                cwd=working_dir,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            if job_id:
                self._running_processes[job_id] = proc

            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=timeout
            )

            duration = time.time() - start
            success = proc.returncode == 0

            return SandboxResult(
                success=success,
                stdout=stdout.decode("utf-8", errors="replace") if stdout else "",
                stderr=stderr.decode("utf-8", errors="replace") if stderr else "",
                error="" if success else f"FFmpeg 退出码: {proc.returncode}",
                duration_s=duration,
            )
        except asyncio.TimeoutError:
            await self.cancel(job_id)
            return SandboxResult(
                success=False,
                error=f"渲染超时 ({timeout}秒)",
                duration_s=time.time() - start,
            )
        except Exception as e:
            return SandboxResult(
                success=False,
                error=f"执行失败: {e}",
                duration_s=time.time() - start,
            )
        finally:
            if job_id and job_id in self._running_processes:
                del self._running_processes[job_id]

    async def cancel(self, job_id: str):
        """取消正在运行的作业"""
        proc = self._running_processes.get(job_id)
        if proc and proc.returncode is None:
            try:
                proc.terminate()
                await asyncio.sleep(0.5)
                if proc.returncode is None:
                    proc.kill()
            except Exception:
                pass

    def is_running(self, job_id: str) -> bool:
        """检查作业是否还在运行"""
        proc = self._running_processes.get(job_id)
        return proc is not None and proc.returncode is None


# 全局实例
sandbox = LocalSandbox()
