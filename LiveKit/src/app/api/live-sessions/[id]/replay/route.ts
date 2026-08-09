import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { jsonError } from "@/lib/http";
import { getLiveSession } from "@/lib/live-service";
import { getStore } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const live = getLiveSession(getStore(), id);
    if (!live.enableRecord || live.status !== "ended") {
      return new Response("暂无可下载录像", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }

    const fileName = `${id}.mp4`;
    const filePath = join(process.env.REPLAY_DIRECTORY || "/app/replays", fileName);
    if (!existsSync(filePath)) {
      return new Response("录播正在生成，请稍候刷新后下载", { status: 409, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }

    const video = await readFile(filePath);
    return new Response(video, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
