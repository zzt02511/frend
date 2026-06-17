import type {
  AppStore,
  CustomerFollowUp,
  CustomerLead,
  LeadTemperature,
} from "./domain";
import { nowIso } from "./domain";
import { persistStoreIfGlobal } from "./store";

type LeadDraft = Omit<CustomerLead, "temperature">;
type FollowUpPatch = Partial<
  Pick<CustomerFollowUp, "wecomStatus" | "leadStage" | "followUpOwnerId" | "followUpStatus" | "followUpNote">
>;

export function getCustomerLeads(store: AppStore, liveId: string): CustomerLead[] {
  const leads = new Map<string, LeadDraft>();

  for (const visit of store.shareVisits.filter((item) => item.liveId === liveId)) {
    const lead = getOrCreateLead(leads, visit.viewerId, visit.createdAt);
    lead.visitCount += 1;
    lead.source = visit.source;
    lead.sharedBy = visit.sharedBy;
    lead.firstSeenAt = minIso(lead.firstSeenAt, visit.createdAt);
    lead.lastActiveAt = maxIso(lead.lastActiveAt, visit.createdAt);
  }

  for (const comment of store.comments.filter((item) => item.liveId === liveId && item.status !== "deleted")) {
    const lead = getOrCreateLead(leads, comment.userId, comment.createdAt);
    lead.commentCount += 1;
    if (comment.status === "pending") lead.pendingCommentCount += 1;
    if (comment.status === "approved") lead.approvedCommentCount += 1;
    if (comment.status === "rejected") lead.rejectedCommentCount += 1;
    if (comment.isHighValueQuestion) lead.highValueQuestionCount += 1;
    lead.questions.push({
      id: comment.id,
      content: comment.content,
      status: comment.status,
      isHighValueQuestion: comment.isHighValueQuestion,
      createdAt: comment.createdAt,
    });
    lead.firstSeenAt = minIso(lead.firstSeenAt, comment.createdAt);
    lead.lastActiveAt = maxIso(lead.lastActiveAt, comment.createdAt);
  }

  for (const participant of store.participants.filter((item) => item.liveId === liveId)) {
    const lead = getOrCreateLead(leads, participant.userId, participant.joinTime);
    lead.watchDurationSeconds += getWatchDurationSeconds(participant);
    lead.firstSeenAt = minIso(lead.firstSeenAt, participant.joinTime);
    lead.lastActiveAt = maxIso(lead.lastActiveAt, participant.leaveTime ?? participant.joinTime);
  }

  for (const followUp of store.customerFollowUps.filter((item) => item.liveId === liveId)) {
    const lead = getOrCreateLead(leads, followUp.customerId, followUp.updatedAt);
    lead.wecomStatus = followUp.wecomStatus;
    lead.leadStage = followUp.leadStage;
    lead.followUpOwnerId = followUp.followUpOwnerId;
    lead.followUpStatus = followUp.followUpStatus;
    lead.followUpNote = followUp.followUpNote;
    lead.followUpUpdatedAt = followUp.updatedAt;
    lead.lastActiveAt = maxIso(lead.lastActiveAt, followUp.updatedAt);
  }

  return [...leads.values()]
    .map((lead) => ({
      ...lead,
      questions: lead.questions.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      temperature: getLeadTemperature(lead),
    }))
    .sort(
      (a, b) =>
        temperatureScore(b.temperature) - temperatureScore(a.temperature) ||
        b.commentCount - a.commentCount ||
        b.visitCount - a.visitCount ||
        b.lastActiveAt.localeCompare(a.lastActiveAt),
    );
}

export function updateCustomerFollowUp(
  store: AppStore,
  liveId: string,
  customerId: string,
  patch: FollowUpPatch,
): CustomerFollowUp {
  const current = store.customerFollowUps.find((item) => item.liveId === liveId && item.customerId === customerId);
  const updatedAt = nowIso();

  if (current) {
    Object.assign(current, sanitizeFollowUpPatch(patch), { updatedAt });
    persistStoreIfGlobal(store);
    return current;
  }

  const followUp: CustomerFollowUp = {
    liveId,
    customerId,
    wecomStatus: patch.wecomStatus ?? "not_contacted",
    leadStage: patch.leadStage ?? "new",
    followUpOwnerId: patch.followUpOwnerId,
    followUpStatus: patch.followUpStatus ?? "unassigned",
    followUpNote: patch.followUpNote,
    updatedAt,
  };
  store.customerFollowUps.push(followUp);
  persistStoreIfGlobal(store);
  return followUp;
}

function getOrCreateLead(leads: Map<string, LeadDraft>, customerId: string, seenAt: string) {
  const current = leads.get(customerId);
  if (current) return current;

  const lead: LeadDraft = {
    customerId,
    source: "direct",
    sharedBy: "direct",
    visitCount: 0,
    watchDurationSeconds: 0,
    commentCount: 0,
    pendingCommentCount: 0,
    approvedCommentCount: 0,
    rejectedCommentCount: 0,
    highValueQuestionCount: 0,
    questions: [],
    firstSeenAt: seenAt,
    lastActiveAt: seenAt,
    wecomStatus: "not_contacted",
    leadStage: "new",
    followUpStatus: "unassigned",
  };
  leads.set(customerId, lead);
  return lead;
}

function getLeadTemperature(lead: LeadDraft): LeadTemperature {
  if (lead.highValueQuestionCount > 0 || lead.commentCount >= 2 || lead.watchDurationSeconds >= 600) return "hot";
  if (lead.commentCount > 0 || lead.visitCount >= 2 || lead.watchDurationSeconds >= 180) return "warm";
  return "cold";
}

function getWatchDurationSeconds(participant: { watchDuration: number; joinTime: string; leaveTime?: string }) {
  if (participant.watchDuration > 0) return Math.round(participant.watchDuration);
  if (!participant.leaveTime) return 0;
  return Math.max(0, Math.round((Date.parse(participant.leaveTime) - Date.parse(participant.joinTime)) / 1000));
}

function sanitizeFollowUpPatch(patch: FollowUpPatch) {
  const sanitized: FollowUpPatch = {};
  if (patch.wecomStatus) sanitized.wecomStatus = patch.wecomStatus;
  if (patch.leadStage) sanitized.leadStage = patch.leadStage;
  if (patch.followUpOwnerId !== undefined) sanitized.followUpOwnerId = patch.followUpOwnerId;
  if (patch.followUpStatus) sanitized.followUpStatus = patch.followUpStatus;
  if (patch.followUpNote !== undefined) sanitized.followUpNote = patch.followUpNote;
  return sanitized;
}

function temperatureScore(temperature: LeadTemperature) {
  if (temperature === "hot") return 3;
  if (temperature === "warm") return 2;
  return 1;
}

function minIso(left: string, right: string) {
  return left < right ? left : right;
}

function maxIso(left: string, right: string) {
  return left > right ? left : right;
}
