import { jsonError, jsonOk } from "@/lib/http";
import { getLiveSession } from "@/lib/live-service";
import { getStore } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

type WeChatTokenResponse = {
  access_token?: string;
  openid?: string;
  errcode?: number;
  errmsg?: string;
};

type WeChatUserInfoResponse = {
  nickname?: string;
  openid?: string;
  errcode?: number;
  errmsg?: string;
};

function fallbackNickname(viewerId: string) {
  return `微信观众 ${viewerId.slice(-6)}`;
}

function getConfiguredApp() {
  const appId = process.env.WECHAT_OAUTH_APP_ID?.trim();
  const appSecret = process.env.WECHAT_OAUTH_APP_SECRET?.trim();
  if (!appId || !appSecret) return undefined;
  return { appId, appSecret };
}

function buildAuthUrl(appId: string, redirectUri: string, state: string) {
  const params = new URLSearchParams({
    appid: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "snsapi_userinfo",
    state,
  });
  return `https://open.weixin.qq.com/connect/oauth2/authorize?${params.toString()}#wechat_redirect`;
}

async function fetchWeChatNickname(appId: string, appSecret: string, code: string) {
  const tokenParams = new URLSearchParams({
    appid: appId,
    secret: appSecret,
    code,
    grant_type: "authorization_code",
  });
  const tokenResponse = await fetch(`https://api.weixin.qq.com/sns/oauth2/access_token?${tokenParams.toString()}`);
  const tokenPayload = (await tokenResponse.json()) as WeChatTokenResponse;
  if (!tokenResponse.ok || !tokenPayload.access_token || !tokenPayload.openid) {
    throw new Error(tokenPayload.errmsg || "WECHAT_TOKEN_FAILED");
  }

  const profileParams = new URLSearchParams({
    access_token: tokenPayload.access_token,
    openid: tokenPayload.openid,
    lang: "zh_CN",
  });
  const profileResponse = await fetch(`https://api.weixin.qq.com/sns/userinfo?${profileParams.toString()}`);
  const profilePayload = (await profileResponse.json()) as WeChatUserInfoResponse;
  if (!profileResponse.ok || !profilePayload.nickname) {
    throw new Error(profilePayload.errmsg || "WECHAT_PROFILE_FAILED");
  }

  return profilePayload.nickname;
}

export async function GET(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    getLiveSession(getStore(), id);

    const url = new URL(request.url);
    const viewerId = url.searchParams.get("viewerId")?.trim() || url.searchParams.get("state")?.trim();
    if (!viewerId) throw new Error("VIEWER_ID_REQUIRED");

    const configuredApp = getConfiguredApp();
    const code = url.searchParams.get("code")?.trim();
    if (configuredApp && code) {
      const nickname = await fetchWeChatNickname(configuredApp.appId, configuredApp.appSecret, code);
      return jsonOk({ viewerId, nickname, source: "wechat" });
    }

    const returnTo = url.searchParams.get("returnTo")?.trim();
    if (configuredApp && returnTo) {
      return jsonOk({
        viewerId,
        authUrl: buildAuthUrl(configuredApp.appId, returnTo, viewerId),
        source: "wechat-oauth",
      });
    }

    return jsonOk({ viewerId, nickname: fallbackNickname(viewerId), source: "fallback" });
  } catch (error) {
    return jsonError(error);
  }
}
