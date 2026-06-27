export type UserRole = "super_admin" | "director" | "host" | "moderator" | "audience";
export type UserStatus = "active" | "disabled" | "blacklisted";
export type LiveStatus = "draft" | "scheduled" | "live" | "ended" | "closed";
export type CommentMode = "free" | "review" | "host_only" | "closed";
export type CommentStatus = "pending" | "approved" | "rejected" | "deleted";
export type MicRequestStatus =
  | "applied"
  | "approved"
  | "rejected"
  | "connected"
  | "cancelled"
  | "ended"
  | "kicked";
export type ReplayStatus = "recording" | "processing" | "ready" | "failed" | "hidden" | "deleted";

export type User = {
  id: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string;
  mobile?: string;
  openid?: string;
  unionid?: string;
};

export type LiveSession = {
  id: string;
  title: string;
  coverUrl: string;
  description: string;
  roomName: string;
  status: LiveStatus;
  startTime: string;
  endTime?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  hostUserId: string;
  moderatorIds: string[];
  enableComment: boolean;
  commentMode: CommentMode;
  enableMicApply: boolean;
  enableRecord: boolean;
  cdnPlayUrl?: string;
  replayUrl?: string;
};

export type LiveParticipant = {
  id: string;
  liveId: string;
  userId: string;
  userName?: string;
  livekitIdentity: string;
  role: UserRole;
  joinTime: string;
  lastActiveAt?: string;
  leaveTime?: string;
  watchDuration: number;
  isMuted: boolean;
  isBanned: boolean;
  canPublish: boolean;
};

export type LiveComment = {
  id: string;
  liveId: string;
  userId: string;
  userName?: string;
  content: string;
  status: CommentStatus;
  isPinned: boolean;
  isHighValueQuestion: boolean;
  visibleToSender: boolean;
  hitSensitiveWords: string[];
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
};

export type MicRequest = {
  id: string;
  liveId: string;
  userId: string;
  userName?: string;
  status: MicRequestStatus;
  reason: string;
  approvedBy?: string;
  approvedAt?: string;
  connectedAt?: string;
  endedAt?: string;
  createdAt: string;
};

export type ReplayRecord = {
  id: string;
  liveId: string;
  status: ReplayStatus;
  url: string;
  visible: boolean;
  createdAt: string;
};

export type LiveStats = {
  id: string;
  liveId: string;
  pv: number;
  uv: number;
  peakOnline: number;
  currentOnline: number;
  avgWatchDuration: number;
  commentCount: number;
  likeCount: number;
  micApplyCount: number;
  successfulMicCount: number;
  leadCount: number;
  replayViewCount: number;
};

export type AuditLog = {
  id: string;
  actorId: string;
  action: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type ShareVisit = {
  id: string;
  liveId: string;
  viewerId: string;
  source: string;
  sharedBy: string;
  createdAt: string;
};

export type ShareRank = {
  sharedBy: string;
  source: string;
  visits: number;
  uniqueViewers: number;
};

export type CommentAnalyticsSummary = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  deleted: number;
  highValueQuestions: number;
  pinned: number;
  uniqueUsers: number;
};

export type CommentStatusCount = {
  status: CommentStatus;
  count: number;
};

export type CommentUserStat = {
  userId: string;
  userName?: string;
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  deleted: number;
  highValueQuestions: number;
  lastCommentAt: string;
};

export type CommentAnalytics = {
  summary: CommentAnalyticsSummary;
  statusBreakdown: CommentStatusCount[];
  userRanking: CommentUserStat[];
};

export type LeadTemperature = "hot" | "warm" | "cold";
export type WecomStatus = "not_contacted" | "pending_add" | "added" | "rejected";
export type LeadStage = "new" | "identified" | "converted" | "invalid";
export type FollowUpStatus = "unassigned" | "pending" | "contacted" | "done";

export type LeadQuestion = {
  id: string;
  content: string;
  status: CommentStatus;
  isHighValueQuestion: boolean;
  createdAt: string;
};

export type CustomerLead = {
  customerId: string;
  customerName?: string;
  source: string;
  sharedBy: string;
  visitCount: number;
  watchDurationSeconds: number;
  commentCount: number;
  pendingCommentCount: number;
  approvedCommentCount: number;
  rejectedCommentCount: number;
  highValueQuestionCount: number;
  questions: LeadQuestion[];
  firstSeenAt: string;
  lastActiveAt: string;
  temperature: LeadTemperature;
  wecomStatus: WecomStatus;
  leadStage: LeadStage;
  followUpOwnerId?: string;
  followUpStatus: FollowUpStatus;
  followUpNote?: string;
  followUpUpdatedAt?: string;
};

export type CustomerFollowUp = {
  liveId: string;
  customerId: string;
  wecomStatus: WecomStatus;
  leadStage: LeadStage;
  followUpOwnerId?: string;
  followUpStatus: FollowUpStatus;
  followUpNote?: string;
  updatedAt: string;
};

export type LiveKitGrants = {
  roomJoin: boolean;
  canSubscribe: boolean;
  canPublish: boolean;
  canPublishData: boolean;
  roomAdmin: boolean;
};

export type LiveKitAccessToken = {
  token: string;
  identity: string;
  roomName: string;
  serverUrl: string;
  grants: LiveKitGrants;
};

export type AppStore = {
  users: User[];
  liveSessions: LiveSession[];
  participants: LiveParticipant[];
  comments: LiveComment[];
  micRequests: MicRequest[];
  replays: ReplayRecord[];
  stats: LiveStats[];
  auditLogs: AuditLog[];
  shareVisits: ShareVisit[];
  customerFollowUps: CustomerFollowUp[];
};

export function nowIso() {
  return new Date().toISOString();
}

export function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
