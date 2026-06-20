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

export async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
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

export async function uploadAvatar(file: File) {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("You need to be logged in before uploading an avatar.");
  }

  const body = new FormData();
  body.set("avatar", file);

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

  const body = new FormData();
  body.set("banner", file);

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

  const payload = JSON.parse(raw) as SignupProfilePayload;
  const profile = await saveProfile(payload, "POST");
  window.localStorage.removeItem(pendingProfileKey);
  return profile;
}
