"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, ExternalLink, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LiveSharePanel({ shareUrl }: { shareUrl: string }) {
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [copyState, setCopyState] = useState("复制地址");

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(shareUrl, {
      margin: 1,
      width: 220,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    }).then((url) => {
      if (alive) setQrCodeUrl(url);
    });
    return () => {
      alive = false;
    };
  }, [shareUrl]);

  async function copyUrl() {
    await navigator.clipboard.writeText(shareUrl);
    setCopyState("已复制");
    window.setTimeout(() => setCopyState("复制地址"), 1400);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary" />
          微信分享
        </CardTitle>
        <CardDescription>把地址或二维码发给微信好友，对方可直接进入该直播间。</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="rounded-md border border-border bg-white p-3">
          {qrCodeUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrCodeUrl} alt="直播间分享二维码" className="mx-auto h-44 w-44" />
          ) : (
            <div className="grid h-44 place-items-center text-sm text-slate-500">生成二维码中...</div>
          )}
        </div>
        <div className="break-all rounded-md bg-secondary p-3 font-mono text-xs text-muted-foreground">
          {shareUrl}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={copyUrl} variant="secondary">
            <Copy className="h-4 w-4" /> {copyState}
          </Button>
          <Button asChild>
            <a href={shareUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" /> 打开直播间
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
