const KOOK_API_BASE_URL = "https://www.kookapp.cn/api/v3";
const MAX_KOOK_MESSAGE_LENGTH = 3800;

type KookMessageResponse = {
  code?: number;
  message?: string;
};

function kookBotToken() {
  return process.env.KOOK_BOT_TOKEN?.trim() || "";
}

export function hasKookAdminNotifier() {
  return Boolean(kookBotToken() && process.env.KOOK_ADMIN_CHANNEL_ID?.trim());
}

function trimKookMessage(content: string) {
  if (content.length <= MAX_KOOK_MESSAGE_LENGTH) return content;
  return `${content.slice(0, MAX_KOOK_MESSAGE_LENGTH - 40)}\n\n[Message truncated in KOOK]`;
}

export async function sendKookChannelMessage({
  channelId,
  content,
}: {
  channelId: string;
  content: string;
}) {
  const token = kookBotToken();
  const targetId = channelId.trim();

  if (!token || !targetId || !content.trim()) {
    return { ok: false, skipped: true, message: "KOOK notifier is not configured." };
  }

  const response = await fetch(`${KOOK_API_BASE_URL}/message/create`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: 9,
      target_id: targetId,
      content: trimKookMessage(content),
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as KookMessageResponse;

  if (!response.ok || payload.code !== 0) {
    throw new Error(
      payload.message || `KOOK message failed with HTTP ${response.status}`,
    );
  }

  return { ok: true, skipped: false };
}

export async function notifyKookAdmins(content: string) {
  const channelId = process.env.KOOK_ADMIN_CHANNEL_ID?.trim() || "";
  return sendKookChannelMessage({ channelId, content });
}
