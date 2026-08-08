"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Check,
  ExternalLink,
  Flame,
  MessageSquareWarning,
  Mic2,
  Pin,
  Radio,
  Search,
  Shield,
  Trash2,
  UserX,
  X,
} from "lucide-react";
import type {
  CommentAnalytics,
  CommentStatus,
  CustomerLead,
  LiveComment,
  LiveParticipant,
  LiveSession,
  LiveStats,
  MicRequest,
} from "@/lib/domain";
import { buildLiveShareUrl } from "@/lib/share-url";
import { LiveSharePanel } from "@/components/live-share-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Props = {
  liveSessions: LiveSession[];
  initialComments: LiveComment[];
  initialMicRequests: MicRequest[];
  initialParticipants: LiveParticipant[];
  stats: LiveStats;
  initialShareRanking: { sharedBy: string; source: string; visits: number; uniqueViewers: number }[];
  initialCommentAnalytics: CommentAnalytics;
  initialCustomerLeads: CustomerLead[];
  roomScoped?: boolean;
  initialTab?: "comments" | "commentStats" | "leads" | "mic" | "participants";
};

type ApiPayload<T> = {
  ok: boolean;
  data: T;
};

const statusText: Record<LiveSession["status"], string> = {
  draft: "草稿",
  scheduled: "未开播",
  live: "直播中",
  ended: "已结束",
  closed: "已关闭",
};

const commentStatusText: Record<CommentStatus, string> = {
  pending: "待审核",
  approved: "已通过",
  rejected: "已拒绝",
  deleted: "已删除",
};

const wecomStatusText: Record<CustomerLead["wecomStatus"], string> = {
  not_contacted: "未联系",
  pending_add: "待添加",
  added: "已加企微",
  rejected: "拒绝添加",
};

const leadStageText: Record<CustomerLead["leadStage"], string> = {
  new: "新客户",
  identified: "已识别",
  converted: "已转线索",
  invalid: "无效",
};

const followUpStatusText: Record<CustomerLead["followUpStatus"], string> = {
  unassigned: "未分配",
  pending: "待跟进",
  contacted: "已联系",
  done: "已完成",
};

function statusVariant(status: LiveSession["status"]) {
  if (status === "live") return "success";
  if (status === "ended" || status === "closed") return "outline";
  return "warning";
}

function commentStatusVariant(status: CommentStatus) {
  if (status === "approved") return "success";
  if (status === "rejected" || status === "deleted") return "danger";
  return "warning";
}

function formatDuration(totalSeconds: number) {
  if (totalSeconds <= 0) return "未统计";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds} 秒`;
  return `${minutes} 分 ${seconds} 秒`;
}

function commentUserName(comment: LiveComment) {
  return comment.userName || comment.userId;
}

function micRequestUserName(request: MicRequest) {
  return request.userName || request.userId;
}

function participantUserName(participant: LiveParticipant) {
  return participant.userName || participant.userId;
}

function leadCustomerName(lead: CustomerLead) {
  return lead.customerName || lead.customerId;
}

function rankingUserName(user: CommentAnalytics["userRanking"][number]) {
  return user.userName || user.userId;
}

export function AdminConsole({
  liveSessions,
  initialComments,
  initialMicRequests,
  initialParticipants,
  stats: initialStats,
  initialShareRanking,
  initialCommentAnalytics,
  initialCustomerLeads,
  roomScoped = false,
  initialTab = "comments",
}: Props) {
  const [sessions, setSessions] = useState(liveSessions);
  const [activeLiveId, setActiveLiveId] = useState(liveSessions[0]?.id ?? "");
  const [comments, setComments] = useState(initialComments);
  const [micRequests, setMicRequests] = useState(initialMicRequests);
  const [participants, setParticipants] = useState(initialParticipants);
  const [stats, setStats] = useState(initialStats);
  const [shareRanking, setShareRanking] = useState(initialShareRanking);
  const [commentAnalytics, setCommentAnalytics] = useState(initialCommentAnalytics);
  const [customerLeads, setCustomerLeads] = useState(initialCustomerLeads);
const [title, setTitle] = useState("");
const [newLivePassword, setNewLivePassword] = useState("");
  const [sharedBy, setSharedBy] = useState("moderator-1");
  const [commentQuery, setCommentQuery] = useState("");
  const [commentStatusFilter, setCommentStatusFilter] = useState<CommentStatus | "all">("all");
  const [origin, setOrigin] = useState("");
const [editingLiveId, setEditingLiveId] = useState("");
const [editTitle, setEditTitle] = useState("");
const [editDescription, setEditDescription] = useState("");
const [editEnableMicApply, setEditEnableMicApply] = useState(true);
const [editAccessPassword, setEditAccessPassword] = useState("");
const [originalEditAccessPassword, setOriginalEditAccessPassword] = useState("");
  const activeLive = sessions.find((item) => item.id === activeLiveId) ?? sessions[0];
  const reviewComments = useMemo(
    () =>
      [...comments].sort((first, second) => {
        if (first.status === "pending" && second.status !== "pending") return -1;
        if (first.status !== "pending" && second.status === "pending") return 1;
        return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
      }),
    [comments],
  );
  const visibleComments = useMemo(() => {
    const query = commentQuery.trim().toLowerCase();
    return comments.filter((comment) => {
      const matchesQuery =
        !query ||
        comment.userId.toLowerCase().includes(query) ||
        commentUserName(comment).toLowerCase().includes(query) ||
        comment.content.toLowerCase().includes(query);
      const matchesStatus = commentStatusFilter === "all" || comment.status === commentStatusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [commentQuery, commentStatusFilter, comments]);
  const shareUrl = activeLive
    ? buildLiveShareUrl({
        origin: origin || "http://127.0.0.1:4017",
        liveId: activeLive.id,
        source: "wechat",
        sharedBy,
      })
    : "";

  useEffect(() => {
    window.setTimeout(() => setOrigin(window.location.origin), 0);
  }, []);

  const loadLiveData = useCallback(async (liveId: string) => {
    const [commentsRes, micRes, participantsRes, statsRes, shareRankingRes, commentAnalyticsRes, leadsRes] = await Promise.all([
      fetch(`/api/live-sessions/${liveId}/comments`),
      fetch(`/api/live-sessions/${liveId}/mic-requests`),
      fetch(`/api/live-sessions/${liveId}/participants`),
      fetch(`/api/live-sessions/${liveId}/stats`),
      fetch(`/api/live-sessions/${liveId}/share-ranking`),
      fetch(`/api/live-sessions/${liveId}/comment-analytics`),
      fetch(`/api/live-sessions/${liveId}/leads`),
    ]);
    const [
      commentsPayload,
      micPayload,
      participantsPayload,
      statsPayload,
      shareRankingPayload,
      commentAnalyticsPayload,
      leadsPayload,
    ] = await Promise.all([
      commentsRes.json() as Promise<ApiPayload<LiveComment[]>>,
      micRes.json() as Promise<ApiPayload<MicRequest[]>>,
      participantsRes.json() as Promise<ApiPayload<LiveParticipant[]>>,
      statsRes.json() as Promise<ApiPayload<LiveStats>>,
      shareRankingRes.json() as Promise<ApiPayload<Props["initialShareRanking"]>>,
      commentAnalyticsRes.json() as Promise<ApiPayload<CommentAnalytics>>,
      leadsRes.json() as Promise<ApiPayload<CustomerLead[]>>,
    ]);
    if (commentsPayload.ok) setComments(commentsPayload.data);
    if (micPayload.ok) setMicRequests(micPayload.data);
    if (participantsPayload.ok) setParticipants(participantsPayload.data);
    if (statsPayload.ok) setStats(statsPayload.data);
    if (shareRankingPayload.ok) setShareRanking(shareRankingPayload.data);
    if (commentAnalyticsPayload.ok) setCommentAnalytics(commentAnalyticsPayload.data);
    if (leadsPayload.ok) setCustomerLeads(leadsPayload.data);
  }, []);

  useEffect(() => {
    if (!activeLive?.id) return;
    let ignore = false;

    async function pollLiveData() {
      if (ignore || !activeLive?.id) return;
      await loadLiveData(activeLive.id);
    }

    const timer = window.setInterval(pollLiveData, 3000);
    return () => {
      ignore = true;
      window.clearInterval(timer);
    };
  }, [activeLive?.id, loadLiveData]);

  async function selectLive(liveId: string) {
    setActiveLiveId(liveId);
    setCommentQuery("");
    setCommentStatusFilter("all");
    await loadLiveData(liveId);
  }

  async function mutateComment(commentId: string, action: "approve" | "reject" | "pin" | "mark-question" | "delete") {
    if (!activeLive) return;
    const method = action === "delete" ? "DELETE" : "POST";
    const suffix = action === "delete" ? "" : `/${action}`;
    const response = await fetch(`/api/live-sessions/${activeLive.id}/comments/${commentId}${suffix}`, {
      method,
      headers: { "Content-Type": "application/json" },
    });
    const payload = (await response.json()) as ApiPayload<LiveComment>;
    if (payload.ok) await loadLiveData(activeLive.id);
  }

  async function kick(participantId: string) {
    if (!activeLive) return;
    const response = await fetch(`/api/live-sessions/${activeLive.id}/participants/${participantId}/kick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const payload = (await response.json()) as ApiPayload<LiveParticipant>;
    if (payload.ok) await loadLiveData(activeLive.id);
  }

  async function updateLead(customerId: string, patch: Partial<CustomerLead>) {
    if (!activeLive) return;
    const response = await fetch(`/api/live-sessions/${activeLive.id}/leads/${encodeURIComponent(customerId)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    const payload = (await response.json()) as ApiPayload<CustomerLead | undefined>;
    if (payload.ok && payload.data) {
      setCustomerLeads((items) => items.map((item) => (item.customerId === customerId ? payload.data! : item)));
    }
  }

  async function createLive() {
    if (!title.trim()) return;
    const response = await fetch("/api/live-sessions", {
      method: "POST",
      body: JSON.stringify({ title, description: "新建私域直播，可分享给微信好友进入观看。", accessPassword: newLivePassword || undefined }),
    });
    const payload = (await response.json()) as ApiPayload<LiveSession>;
    if (payload.ok) {
      setSessions((items) => [payload.data, ...items]);
      setActiveLiveId(payload.data.id);
      setCommentQuery("");
      setCommentStatusFilter("all");
      await loadLiveData(payload.data.id);
      setTitle("");
      setNewLivePassword("");
    }
  }

async function startEditLive(session: LiveSession) {
    setEditingLiveId(session.id);
    setEditTitle(session.title);
    setEditDescription(session.description);
    setEditEnableMicApply(session.enableMicApply);
    setEditAccessPassword("");
    setOriginalEditAccessPassword("");

    const response = await fetch(`/api/live-sessions/${session.id}/manage`);
    const payload = (await response.json()) as ApiPayload<LiveSession & { accessPassword?: string }>;
    if (payload.ok) {
      const password = payload.data.accessPassword ?? "";
      setEditAccessPassword(password);
      setOriginalEditAccessPassword(password);
    }
  }

function cancelEditLive() {
    setEditingLiveId("");
    setEditTitle("");
    setEditDescription("");
    setEditEnableMicApply(true);
    setEditAccessPassword("");
    setOriginalEditAccessPassword("");
  }

  async function saveLiveSession(liveId: string) {
    if (!editTitle.trim()) return;
    const passwordPatch =
      editAccessPassword === originalEditAccessPassword
        ? {}
        : editAccessPassword
          ? { accessPassword: editAccessPassword }
          : { clearPassword: true };
    const response = await fetch(`/api/live-sessions/${liveId}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: editTitle.trim(),
        description: editDescription.trim(),
        enableMicApply: editEnableMicApply,
        ...passwordPatch,
      }),
    });
    const payload = (await response.json()) as ApiPayload<LiveSession>;
    if (payload.ok) {
      setSessions((items) => items.map((item) => (item.id === liveId ? payload.data : item)));
      cancelEditLive();
    }
  }

  async function deleteLiveFromList(liveId: string) {
    if (!window.confirm("确定要删除这个直播间吗？相关留言、连麦、在线用户和统计数据也会一起删除。")) return;
    const response = await fetch(`/api/live-sessions/${liveId}`, { method: "DELETE" });
    const payload = (await response.json()) as ApiPayload<{ id: string }>;
    if (!payload.ok) return;

    const nextSessions = sessions.filter((item) => item.id !== liveId);
    setSessions(nextSessions);
    if (activeLive?.id !== liveId) return;

    const nextLive = nextSessions[0];
    setActiveLiveId(nextLive?.id ?? "");
    if (nextLive) {
      await loadLiveData(nextLive.id);
    } else {
      setComments([]);
      setMicRequests([]);
      setParticipants([]);
      setShareRanking([]);
      setCustomerLeads([]);
    }
  }

  async function changeLiveStatus(action: "start" | "end") {
    if (!activeLive) return;
    const response = await fetch(`/api/live-sessions/${activeLive.id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const payload = (await response.json()) as ApiPayload<LiveSession>;
    if (payload.ok) {
      setSessions((items) => items.map((item) => (item.id === payload.data.id ? payload.data : item)));
    }
  }

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto grid max-w-7xl gap-5">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">PC 场控后台</p>
            <h1 className="text-3xl font-semibold tracking-normal">直播列表、分享与互动审核</h1>
          </div>
          {!roomScoped ? <div className="flex gap-2">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="输入新直播标题" className="max-w-[200px]" />
            <Input type="password" value={newLivePassword} onChange={(event) => setNewLivePassword(event.target.value)} placeholder="访问密码(可选)" className="max-w-[140px]" />
            <Button onClick={createLive}>创建直播</Button>
          </div> : null}
        </header>

        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="h-5 w-5 text-primary" />
                已创建直播间
              </CardTitle>
              <CardDescription>选择某个直播间后，可以查看开播状态、审核互动，并复制微信分享地址或二维码。</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>直播标题</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>开始时间</TableHead>
                    <TableHead>分享</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => {
                    const selected = session.id === activeLive?.id;
                    const url = buildLiveShareUrl({
                      origin: origin || "http://127.0.0.1:4017",
                      liveId: session.id,
                      source: "wechat",
                    });
                    return (
                      <TableRow key={session.id} className={selected ? "bg-primary/10" : undefined}>
                        <TableCell>
                          {editingLiveId === session.id ? (
                            <div className="grid gap-2">
                              <Input
                                value={editTitle}
                                onChange={(event) => setEditTitle(event.target.value)}
                                placeholder="直播标题"
                              />
                              <Input
                                value={editDescription}
                                onChange={(event) => setEditDescription(event.target.value)}
               placeholder="直播说明"
             />
            <label className="grid grid-cols-[88px_1fr] items-center gap-2 text-sm">
              <span className="text-muted-foreground">连麦</span>
              <select
                aria-label="连麦申请状态"
                value={editEnableMicApply ? "enabled" : "disabled"}
                onChange={(event) => setEditEnableMicApply(event.target.value === "enabled")}
                className="h-9 rounded-md border border-input bg-background px-3"
              >
                <option value="enabled">启用</option>
                <option value="disabled">关闭</option>
              </select>
            </label>
            <Input
              type="password"
              value={editAccessPassword}
              onChange={(event) => setEditAccessPassword(event.target.value)}
              placeholder="访问密码（留空则不设密码）"
            />
          </div>
                          ) : (
                            <>
                              <button className="text-left font-medium hover:text-primary" onClick={() => void selectLive(session.id)}>
                                {session.title}
                              </button>
                              <p className="font-mono text-xs text-muted-foreground">{session.roomName}</p>
                            </>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(session.status)}>{statusText[session.status]}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{new Date(session.startTime).toLocaleString()}</TableCell>
                        <TableCell>
                          <a className="inline-flex items-center gap-1 text-sm text-primary hover:underline" href={url} target="_blank" rel="noreferrer">
                            打开 <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </TableCell>
                        <TableCell>
                          {editingLiveId === session.id ? (
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" onClick={() => void saveLiveSession(session.id)}>
                                保存
                              </Button>
                              <Button size="sm" variant="outline" onClick={cancelEditLive}>
                                取消
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <Button asChild size="sm" variant="outline">
                                <a href={`/host/${session.id}`} target="_blank" rel="noreferrer">主播端</a>
                              </Button>
                              <Button asChild size="sm" variant="outline">
                                <a href={`/admin/${session.id}`} target="_blank" rel="noreferrer">管理端</a>
                              </Button>
                              <Button size="sm" variant={selected ? "secondary" : "outline"} onClick={() => void selectLive(session.id)}>
                                {selected ? "当前控制" : "切换控制"}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => void startEditLive(session)}>
                                编辑
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => void deleteLiveFromList(session.id)}
                                disabled={session.status === "live"}
                              >
                                删除
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {activeLive ? <LiveSharePanel shareUrl={shareUrl} /> : null}
        </section>

        <section className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>生成专属分享码</CardTitle>
              <CardDescription>选择分享人后，二维码会带上分享人 ID，用于统计客户来源。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Input value={sharedBy} onChange={(event) => setSharedBy(event.target.value)} placeholder="分享人 ID，例如 moderator-1" />
              <p className="text-xs text-muted-foreground">建议后续接入账号体系后，自动使用当前登录用户 ID。</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>分享排名</CardTitle>
              <CardDescription>统计通过分享链接进入直播间的客户观看来源。</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>排名</TableHead>
                    <TableHead>分享人</TableHead>
                    <TableHead>渠道</TableHead>
                    <TableHead>访问次数</TableHead>
                    <TableHead>独立客户</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shareRanking.map((rank, index) => (
                    <TableRow key={`${rank.sharedBy}-${rank.source}`}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">{rank.sharedBy}</TableCell>
                      <TableCell>{rank.source}</TableCell>
                      <TableCell>{rank.visits}</TableCell>
                      <TableCell>{rank.uniqueViewers}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        {activeLive ? (
          <section className="grid gap-3 md:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>当前直播</CardDescription>
                <CardTitle className="text-base">{activeLive.title}</CardTitle>
              </CardHeader>
            </Card>
            {[
              ["当前在线", stats.currentOnline],
              ["峰值在线", stats.peakOnline],
              ["留言数", stats.commentCount],
              ["连麦申请", stats.micApplyCount],
            ].map(([label, value]) => (
              <Card key={String(label)}>
                <CardHeader className="pb-2">
                  <CardDescription>{label}</CardDescription>
                  <CardTitle className="text-3xl">{value}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </section>
        ) : null}

        {activeLive ? (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => changeLiveStatus("start")}>标记开播</Button>
            <Button variant="secondary" onClick={() => changeLiveStatus("end")}>结束直播</Button>
          </div>
        ) : null}

        <Tabs defaultValue={initialTab}>
          <TabsList>
            <TabsTrigger value="comments">
              <MessageSquareWarning className="mr-2 h-4 w-4" /> 留言审核
            </TabsTrigger>
            <TabsTrigger value="commentStats">
              <BarChart3 className="mr-2 h-4 w-4" /> 发言统计
            </TabsTrigger>
            <TabsTrigger value="leads">
              <Flame className="mr-2 h-4 w-4" /> 客户线索
            </TabsTrigger>
            <TabsTrigger value="mic">
              <Mic2 className="mr-2 h-4 w-4" /> 连麦申请
            </TabsTrigger>
            <TabsTrigger value="participants">
              <Shield className="mr-2 h-4 w-4" /> 在线用户
            </TabsTrigger>
          </TabsList>

          <TabsContent value="comments">
            <Card>
              <CardHeader>
                <CardTitle>待审核留言</CardTitle>
                <CardDescription>默认先审后发，审核通过后才进入观众公开评论流。</CardDescription>
              </CardHeader>
              <CardContent>
                <Table data-testid="admin-review-comments-panel">
                  <TableHeader>
                    <TableRow>
                      <TableHead>用户</TableHead>
                      <TableHead>内容</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviewComments.map((comment) => (
                      <TableRow key={comment.id} data-testid="admin-review-comment-row">
                        <TableCell>{commentUserName(comment)}</TableCell>
                        <TableCell>{comment.content}</TableCell>
                        <TableCell>
                          <Badge variant={commentStatusVariant(comment.status)}>{commentStatusText[comment.status]}</Badge>
                        </TableCell>
                        <TableCell className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => mutateComment(comment.id, "approve")}>
                            <Check className="h-4 w-4" /> 通过
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => mutateComment(comment.id, "mark-question")}>
                            <Pin className="h-4 w-4" /> 高价值
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => mutateComment(comment.id, "reject")}>
                            <X className="h-4 w-4" /> 拒绝
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => mutateComment(comment.id, "delete")}>
                            <Trash2 className="h-4 w-4" /> 删除
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="commentStats">
            <div className="grid gap-4">
              <section className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
                {[
                  ["总发言", commentAnalytics.summary.total],
                  ["待审核", commentAnalytics.summary.pending],
                  ["已通过", commentAnalytics.summary.approved],
                  ["已拒绝", commentAnalytics.summary.rejected],
                  ["已删除", commentAnalytics.summary.deleted],
                  ["高价值", commentAnalytics.summary.highValueQuestions],
                  ["置顶", commentAnalytics.summary.pinned],
                  ["发言用户", commentAnalytics.summary.uniqueUsers],
                ].map(([label, value]) => (
                  <Card key={String(label)}>
                    <CardHeader className="pb-2">
                      <CardDescription>{label}</CardDescription>
                      <CardTitle className="text-2xl">{value}</CardTitle>
                    </CardHeader>
                  </Card>
                ))}
              </section>

              <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
                <Card>
                  <CardHeader>
                    <CardTitle>发言查询</CardTitle>
                    <CardDescription>按用户、留言内容和审核状态筛选当前直播间发言。</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid gap-2 md:grid-cols-[1fr_180px]">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={commentQuery}
                          onChange={(event) => setCommentQuery(event.target.value)}
                          placeholder="搜索用户或发言内容"
                          className="pl-9"
                        />
                      </div>
                      <select
                        value={commentStatusFilter}
                        onChange={(event) => setCommentStatusFilter(event.target.value as CommentStatus | "all")}
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="all">全部状态</option>
                        <option value="pending">待审核</option>
                        <option value="approved">已通过</option>
                        <option value="rejected">已拒绝</option>
                        <option value="deleted">已删除</option>
                      </select>
                    </div>
                    <Table data-testid="admin-comment-search-panel">
                      <TableHeader>
                        <TableRow>
                          <TableHead>用户</TableHead>
                          <TableHead>发言内容</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>时间</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleComments.map((comment) => (
                          <TableRow key={comment.id}>
                            <TableCell>{commentUserName(comment)}</TableCell>
                            <TableCell>{comment.content}</TableCell>
                            <TableCell>
                              <Badge variant={commentStatusVariant(comment.status)}>{commentStatusText[comment.status]}</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{new Date(comment.createdAt).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>发言用户排行</CardTitle>
                    <CardDescription>按当前直播间内发言次数排序。</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table data-testid="admin-comment-ranking-panel">
                      <TableHeader>
                        <TableRow>
                          <TableHead>用户</TableHead>
                          <TableHead>总数</TableHead>
                          <TableHead>通过</TableHead>
                          <TableHead>拒绝</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {commentAnalytics.userRanking.map((user) => (
                          <TableRow key={user.userId}>
                            <TableCell className="font-medium">{rankingUserName(user)}</TableCell>
                            <TableCell>{user.total}</TableCell>
                            <TableCell>{user.approved}</TableCell>
                            <TableCell>{user.rejected}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </section>
            </div>
          </TabsContent>

          <TabsContent value="leads">
            <Card>
              <CardHeader>
                <CardTitle>客户跟进看板</CardTitle>
                <CardDescription>查看谁进来了、看了多久、问了什么，并分配企微添加、线索转化和直播后跟进。</CardDescription>
              </CardHeader>
              <CardContent>
                <Table data-testid="admin-leads-panel">
                  <TableHeader>
                    <TableRow>
                      <TableHead>客户</TableHead>
                      <TableHead>热度</TableHead>
                      <TableHead>来源</TableHead>
                      <TableHead>观看</TableHead>
                      <TableHead>问了什么</TableHead>
                      <TableHead>加企微</TableHead>
                      <TableHead>转线索</TableHead>
                      <TableHead>直播后跟进</TableHead>
                      <TableHead>最后活跃</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerLeads.map((lead) => (
                      <TableRow key={lead.customerId}>
                        <TableCell className="font-medium">{leadCustomerName(lead)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              lead.temperature === "hot"
                                ? "danger"
                                : lead.temperature === "warm"
                                  ? "warning"
                                  : "outline"
                            }
                          >
                            {lead.temperature === "hot" ? "高温" : lead.temperature === "warm" ? "中温" : "低温"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="grid gap-1">
                            <span>{lead.source}</span>
                            <span className="text-xs text-muted-foreground">分享人：{lead.sharedBy}</span>
                            <span className="text-xs text-muted-foreground">进入 {lead.visitCount} 次</span>
                          </div>
                        </TableCell>
                        <TableCell>{formatDuration(lead.watchDurationSeconds)}</TableCell>
                        <TableCell className="min-w-64">
                          <div className="grid gap-1">
                            <span>
                              发言 {lead.commentCount} 条，高价值 {lead.highValueQuestionCount} 条
                            </span>
                            {lead.questions.slice(-2).map((question) => (
                              <span key={question.id} className="text-xs text-muted-foreground">
                                {question.isHighValueQuestion ? "重点：" : ""}
                                {question.content}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <select
                            value={lead.wecomStatus}
                            onChange={(event) =>
                              void updateLead(lead.customerId, {
                                wecomStatus: event.target.value as CustomerLead["wecomStatus"],
                              })
                            }
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                          >
                            {Object.entries(wecomStatusText).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                        <TableCell>
                          <select
                            value={lead.leadStage}
                            onChange={(event) =>
                              void updateLead(lead.customerId, {
                                leadStage: event.target.value as CustomerLead["leadStage"],
                              })
                            }
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                          >
                            {Object.entries(leadStageText).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                        <TableCell className="min-w-56">
                          <div className="grid gap-2">
                            <Input
                              defaultValue={lead.followUpOwnerId ?? ""}
                              placeholder="跟进人 ID"
                              onBlur={(event) =>
                                void updateLead(lead.customerId, {
                                  followUpOwnerId: event.target.value.trim() || undefined,
                                })
                              }
                            />
                            <select
                              value={lead.followUpStatus}
                              onChange={(event) =>
                                void updateLead(lead.customerId, {
                                  followUpStatus: event.target.value as CustomerLead["followUpStatus"],
                                })
                              }
                              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                            >
                              {Object.entries(followUpStatusText).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                            <Input
                              defaultValue={lead.followUpNote ?? ""}
                              placeholder="跟进备注"
                              onBlur={(event) =>
                                void updateLead(lead.customerId, {
                                  followUpNote: event.target.value.trim() || undefined,
                                })
                              }
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{new Date(lead.lastActiveAt).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mic">
            <Card>
              <CardHeader>
                <CardTitle>连麦申请</CardTitle>
                <CardDescription>这里查看申请状态；通过和拒绝由主播在开播端处理。</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3" data-testid="admin-mic-panel">
                {micRequests.length === 0 ? <p className="text-sm text-muted-foreground">暂无连麦申请。</p> : null}
                {micRequests.map((request) => (
                  <div key={request.id} className="flex flex-col gap-3 rounded-md border border-border p-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium">{micRequestUserName(request)}</p>
                      <p className="text-sm text-muted-foreground">{request.reason}</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">{request.status}</Badge>
                      <Badge variant="secondary">主播端处理</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="participants">
            <Card>
              <CardHeader>
                <CardTitle>在线用户</CardTitle>
                <CardDescription>场控可以静音、踢人，并查看用户是否具备发布权限。</CardDescription>
              </CardHeader>
              <CardContent>
                <Table data-testid="admin-participants-panel">
                  <TableHeader>
                    <TableRow>
                      <TableHead>用户</TableHead>
                      <TableHead>角色</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participants.map((participant) => (
                      <TableRow key={participant.id}>
                        <TableCell>{participantUserName(participant)}</TableCell>
                        <TableCell>{participant.role}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {participant.canPublish ? <Badge variant="success">可发言</Badge> : <Badge variant="outline">仅观看</Badge>}
                            {participant.isBanned ? <Badge variant="danger">已踢出</Badge> : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="destructive" onClick={() => kick(participant.id)}>
                            <UserX className="h-4 w-4" /> 踢出
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
