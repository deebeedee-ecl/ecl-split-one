"use client";

import { supabase } from "@/lib/supabase";

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
export const hubAccessCacheKey = "ecl.hubAccess";

type HubAccessCacheStatus = "ready" | "profile";

export function getHubAccessCache() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(hubAccessCacheKey);
    if (!raw) return null;

    const value = JSON.parse(raw) as { status?: string };
    if (value.status === "ready" || value.status === "profile") {
      return value as { status: HubAccessCacheStatus };
    }
  } catch {
    return null;
  }

  return null;
}

export function setHubAccessCache(status: HubAccessCacheStatus) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(hubAccessCacheKey, JSON.stringify({ status }));
}

export function clearHubAccessCache() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(hubAccessCacheKey);
}

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

export async function saveProfile(payload: Partial<SignupProfilePayload>, method: "POST" | "PATCH") {
  const token = await getAccessToken();

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

  return data.profile;
}

export async function loadProfile() {
  const token = await getAccessToken();

  if (!token) return null;

  const response = await fetch("/api/account/profile", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) return null;

  const data = await response.json();
  return data.profile ?? null;
}

export async function requestKookVerificationCode() {
  const token = await getAccessToken();

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

export async function uploadAvatar(file: File) {
  const token = await getAccessToken();

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

export async function uploadBanner(file: File) {
  const token = await getAccessToken();

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

export async function flushPendingProfile() {
  const raw = window.localStorage.getItem(pendingProfileKey);
  if (!raw) return null;

  const payload = cleanSignupProfilePayload(JSON.parse(raw)) as SignupProfilePayload;
  const profile = await saveProfile(payload, "POST");
  window.localStorage.removeItem(pendingProfileKey);
  return profile;
}
