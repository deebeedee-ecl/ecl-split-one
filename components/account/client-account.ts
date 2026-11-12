"use client";

import { supabase } from "@/lib/supabase";
import type { SettingsProfileDto } from "@/lib/account-profile-dto";
import { requestAccountProfile } from "./profile-request";

export type SignupProfilePayload = {
  displayName: string;
  riotName: string;
  riotTag: string;
  chinaServerId: string;
  chinaServerName: string;
  openId: string;
  kookUsername: string;
  kookId: string;
  wechatId: string;
  primaryRole: string;
  secondaryRole: string;
  currentRank: string;
  nationality: string;
  timezone: string;
  bio: string;
  avatarStyle: string;
  avatarUrl: string;
  bannerUrl: string;
  dashboardTheme: string;
  championPool: {
    main: string[];
    learning: string[];
  };
  privacySettings: {
    showWechat: boolean;
    showEmail: boolean;
    showRiotId: boolean;
    bannerPositionY?: number;
  };
};

export const pendingProfileKey = "ecl.pendingSignupProfile";

export function cleanSignupProfilePayload(payload: Partial<SignupProfilePayload> & Record<string, unknown>) {
  const { email: _email, password: _password, ...profile } = payload;
  const riotName = typeof profile.riotName === "string" ? profile.riotName.trim() : "";
  const riotTag = typeof profile.riotTag === "string" ? profile.riotTag.trim().replace(/^#+/, "") : "";

  return {
    ...profile,
    riotName,
    riotTag,
    kookId: "",
  } as Partial<SignupProfilePayload>;
}

export async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

type ImageUploadOptions = {
  maxWidth: number;
  maxHeight: number;
  quality: number;
};

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image could not be loaded."));
    };
    image.src = objectUrl;
  });
}

async function prepareImageUpload(file: File, options: ImageUploadOptions) {
  if (typeof window === "undefined" || !file.type.startsWith("image/")) {
    return file;
  }

  try {
    const image = await loadImage(file);
    const scale = Math.min(
      1,
      options.maxWidth / image.naturalWidth,
      options.maxHeight / image.naturalHeight,
    );
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) return file;

    canvas.width = width;
    canvas.height = height;
    context.drawImage(image, 0, 0, width, height);

    const outputType = file.type === "image/png" && file.size < 300_000 ? "image/png" : "image/webp";
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, outputType, options.quality);
    });

    if (!blob) return file;

    const extension = outputType === "image/webp" ? "webp" : "png";
    const name = file.name.replace(/\.[^.]+$/, "") || "ecl-upload";
    return new File([blob], `${name}.${extension}`, { type: blob.type || outputType });
  } catch {
    return file;
  }
}

export async function saveProfile(
  payload: Partial<SignupProfilePayload>,
  method: "POST" | "PATCH",
  accessToken?: string | null,
) {
  const token = accessToken ?? (await getAccessToken());

  if (!token) {
    throw new Error("You need to be logged in before this profile can be saved.");
  }

  const response = await fetch("/api/account/profile", {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message ?? "Profile save failed.");
  }

  return data.profile as SettingsProfileDto;
}

function requiredProfileToken(accessToken?: string | null) {
  return accessToken ? Promise.resolve(accessToken) : getAccessToken();
}

export async function loadPlayerProfile(
  accessToken?: string | null,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
) {
  const token = await requiredProfileToken(accessToken);
  if (!token) return null;
  return requestAccountProfile("profile", token, options);
}

export async function loadSettingsProfile(
  accessToken?: string | null,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
) {
  const token = await requiredProfileToken(accessToken);
  if (!token) return null;
  return requestAccountProfile("settings", token, options);
}

export async function loadApplicationProfile(
  accessToken?: string | null,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
) {
  const token = await requiredProfileToken(accessToken);
  if (!token) return null;
  return requestAccountProfile("application", token, options);
}

export async function loadReporterProfile(
  accessToken?: string | null,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
) {
  const token = accessToken ?? (await getAccessToken());
  if (!token) return null;
  return requestAccountProfile("reporter", token, options);
}

export async function loadHubBootstrapProfile(accessToken: string) {
  const response = await fetch("/api/account/profile/bootstrap", {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) return null;

  const data = await response.json();
  return data.profile ?? null;
}

export async function requestKookVerificationCode(accessToken?: string | null) {
  const token = accessToken ?? (await getAccessToken());

  if (!token) {
    throw new Error("You need to be logged in before requesting a KOOK code.");
  }

  const response = await fetch("/api/account/kook-verification", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message ?? "Could not create a KOOK verification code.");
  }

  return data.verification;
}

export async function uploadAvatar(file: File, accessToken?: string | null) {
  const token = accessToken ?? (await getAccessToken());

  if (!token) {
    throw new Error("You need to be logged in before uploading an avatar.");
  }

  const preparedFile = await prepareImageUpload(file, {
    maxWidth: 1024,
    maxHeight: 1024,
    quality: 0.92,
  });
  const body = new FormData();
  body.set("avatar", preparedFile);

  const response = await fetch("/api/account/avatar", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message ?? "Avatar upload failed.");
  }

  return data.avatarUrl as string;
}

export async function uploadBanner(file: File, accessToken?: string | null) {
  const token = accessToken ?? (await getAccessToken());

  if (!token) {
    throw new Error("You need to be logged in before uploading a banner.");
  }

  const preparedFile = await prepareImageUpload(file, {
    maxWidth: 2800,
    maxHeight: 900,
    quality: 0.92,
  });
  const body = new FormData();
  body.set("banner", preparedFile);

  const response = await fetch("/api/account/banner", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message ?? "Banner upload failed.");
  }

  return data.bannerUrl as string;
}

export async function flushPendingProfile(accessToken?: string | null) {
  const raw = window.localStorage.getItem(pendingProfileKey);
  if (!raw) return null;

  const payload = cleanSignupProfilePayload(JSON.parse(raw)) as SignupProfilePayload;
  const profile = await saveProfile(payload, "POST", accessToken);
  window.localStorage.removeItem(pendingProfileKey);
  return profile;
}
