import Link from "next/link";
import { Radio, ShieldCheck, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function Home() {
  const live = getStore().liveSessions.find((item) => item.status === "live" || item.status === "scheduled" || item.status === "draft")
    ?? getStore().liveSessions[0];
  const highlights = [
    {
      title: "默认先审后发",
      body: "观众留言先进入审核池，通过后公开展示。",
      Icon: ShieldCheck,
    },
    {
      title: "移动主播优先",
      body: "手机摄像头、麦克风、前后摄像头切换和断线提示。",
      Icon: Smartphone,
    },
    {
      title: "LiveKit 权限边界",
      body: "普通观众默认不可发布音视频，连麦审批后授权。",
      Icon: Radio,
    },
  ];

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-6xl gap-6 px-4 py-8 md:grid-cols-[1fr_360px] md:px-8">
      <section className="flex flex-col justify-center gap-6">
        <Badge className="w-fit" variant="success">MVP</Badge>
        <div className="space-y-4">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-normal md:text-6xl">
            微信私域互动直播控制台
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
            移动端主播走动讲解产品，观众在微信 H5 观看互动，场控审核留言、管理连麦、静音和踢人。
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/live/${live.id}`}>进入观众端</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/host">移动主播端</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin">场控后台</Link>
          </Button>
        </div>
      </section>

      <section className="grid content-center gap-4">
        {highlights.map(({ title, body, Icon }) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                {title}
              </CardTitle>
              <CardDescription>{body}</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Next.js + Tailwind + shadcn/Radix + Prisma + Auth.js</CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
