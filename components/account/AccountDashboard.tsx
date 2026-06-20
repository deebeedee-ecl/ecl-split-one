"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  chinaServerOptions,
  countryOptions,
  getChinaServerDisplayName,
  getCountryOption,
  roles,
} from "./account-options";
import {
  flushPendingProfile,
  loadProfile,
  saveProfile,
  type SignupProfilePayload,
  uploadAvatar,
  uploadBanner,
} from "./client-account";

type AccountProfile = SignupProfilePayload & {
  id: string;
  email: string;
  verificationStatus: string;
  accountStatus: string;
  kookVerifications?: Array<{
    code: string;
    status: string;
    expiresAt: string;
  }>;
};

const emptyProfile: SignupProfilePayload = {
  displayName: "",
  riotName: "",
  riotTag: "",
  chinaServerId: "1",
  chinaServerName: "Ionia",
  openId: "",
  kookUsername: "",
  kookId: "",
  wechatId: "",
  primaryRole: "MID",
  secondaryRole: "SUP",
  currentRank: "Unranked",
  nationality: "",
  timezone: "Asia/Shanghai",
  bio: "",
  avatarStyle: "crest",
  avatarUrl: "",
  bannerUrl: "",
  dashboardTheme: "crimson",
  championPool: {
    main: [],
    learning: [],
  },
  privacySettings: {
    showWechat: false,
    showEmail: false,
    showRiotId: true,
    bannerPositionY: 50,
  },
};

export default function AccountDashboard() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [form, setForm] = useState<SignupProfilePayload>(emptyProfile);
  const [hasSession, setHasSession] = useState(false);
  const [loading, setLoading] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const verification = profile?.kookVerifications?.[0];
  const avatarLetter = (form.displayName || form.riotName || "E").slice(0, 1).toUpperCase();

  const savePayload = useMemo<SignupProfilePayload>(
    () => ({
      ...form,
      championPool: {
        main: form.championPool?.main ?? [],
        learning: [],
      },
    }),
    [form]
  );

  useEffect(() => {
    async function boot() {
      setLoading(true);
      setError("");

      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        setHasSession(false);
        setLoading(false);
        return;
      }

      setHasSession(true);
      await flushPendingProfile().catch(() => null);
      const loaded = await loadProfile();

      if (loaded) {
        setProfile(loaded);
        setForm({
          ...emptyProfile,
          ...loaded,
          championPool: loaded.championPool ?? emptyProfile.championPool,
          privacySettings: loaded.privacySettings ?? emptyProfile.privacySettings,
        });
      } else {
        const metadata = data.session.user.user_metadata ?? {};
        const metadataProfile =
          metadata.ecl_profile && typeof metadata.ecl_profile === "object"
            ? (metadata.ecl_profile as Partial<SignupProfilePayload>)
            : null;
        const riotId =
          typeof metadata.riot_id === "string" ? metadata.riot_id.split("#") : [];

        setForm((current) => ({
          ...current,
          ...metadataProfile,
          championPool: metadataProfile?.championPool ?? current.championPool,
          privacySettings: metadataProfile?.privacySettings ?? current.privacySettings,
          displayName:
            metadataProfile?.displayName ??
            (typeof metadata.display_name === "string" ? metadata.display_name : current.displayName),
          riotName: metadataProfile?.riotName ?? riotId[0] ?? current.riotName,
          riotTag: metadataProfile?.riotTag ?? riotId[1] ?? current.riotTag,
          kookUsername:
            metadataProfile?.kookUsername ??
            (typeof metadata.kook_username === "string" ? metadata.kook_username : current.kookUsername),
        }));
      }

      setLoading(false);
    }

    boot();
  }, []);

  function update<K extends keyof SignupProfilePayload>(key: K, value: SignupProfilePayload[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setError("");
    setMessage("");

    try {
      const updated = await saveProfile(savePayload, profile ? "PATCH" : "POST");
      setProfile(updated);
      setMessage(profile ? "Profile saved." : "Profile created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    }
  }

  async function changeBanner(file: File | null) {
    if (!file) return;
    setError("");
    setMessage("");
    setBannerUploading(true);
    try {
      const bannerUrl = await uploadBanner(file);
      const updated = await saveProfile({ ...savePayload, bannerUrl }, "PATCH");
      setProfile(updated);
      setForm((current) => ({ ...current, bannerUrl }));
      setMessage("Banner uploaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload banner.");
    } finally {
      setBannerUploading(false);
    }
  }

  async function removeBanner() {
    setError("");
    setMessage("");
    setBannerUploading(true);

    try {
      const nextPrivacySettings = {
        ...savePayload.privacySettings,
        bannerPositionY: 50,
      };
      const nextPayload = {
        ...savePayload,
        bannerUrl: "",
        privacySettings: nextPrivacySettings,
      };
      const updated = await saveProfile(nextPayload, profile ? "PATCH" : "POST");
      setProfile(updated);
      setForm((current) => ({
        ...current,
        bannerUrl: "",
        privacySettings: nextPrivacySettings,
      }));
      setMessage("Banner removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove banner.");
    } finally {
      setBannerUploading(false);
    }
  }

  async function changeAvatar(file: File | null) {
    if (!file) return;

    setError("");
    setMessage("");
    setAvatarUploading(true);

    try {
      const avatarUrl = await uploadAvatar(file);
      const updated = await saveProfile({ ...savePayload, avatarUrl }, "PATCH");
      setProfile(updated);
      setForm((current) => ({ ...current, avatarUrl }));
      setMessage("Avatar uploaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload avatar.");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading) {
    return <div className="border border-[#1f1f1f] bg-[#0d0d0d] p-8 text-[#9ca3af]">Loading account...</div>;
  }

  if (!hasSession) {
    return (
      <div className="border border-[#1f1f1f] bg-[#0d0d0d] p-8">
        <h2 className="text-3xl font-black uppercase text-white">Log in to view your profile</h2>
        <p className="mt-3 max-w-2xl text-[#9ca3af]">
          Create an ECL account or log in after confirming your email.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/login" className="bg-[#b11226] px-5 py-3 font-black uppercase text-white">
            Log in
          </Link>
          <Link href="/signup" className="border border-[#1f1f1f] px-5 py-3 font-black uppercase text-white">
            Sign up
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <aside className="border border-[#1f1f1f] bg-[#0d0d0d] p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-24 w-24 items-center justify-center border border-[#b11226]/50 bg-[#b11226]/15 text-5xl font-black">
            {form.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.avatarUrl} alt={form.displayName} className="h-full w-full object-cover" />
            ) : (
              avatarLetter
            )}
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#b11226]">
              {profile ? `${profile.accountStatus} / ${profile.verificationStatus}` : "PROFILE SETUP"}
            </p>
            <h2 className="mt-1 text-3xl font-black text-white">
              {form.displayName || "Complete your profile"}
            </h2>
            <p className="mt-1 text-sm text-[#9ca3af]">
              {form.riotName && form.riotTag ? `${form.riotName}#${form.riotTag}` : "League identity pending"}
            </p>
          </div>
        </div>

        <div className="mt-6 border border-[#1f1f1f] bg-black/25 p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#b11226]">
            KOOK Verification
          </p>
          {profile?.verificationStatus === "VERIFIED" ? (
            <p className="mt-3 text-lg font-black text-white">Verified</p>
          ) : (
            <>
              <p className="mt-3 text-sm leading-6 text-[#9ca3af]">
                Send this code to the ECL KOOK bot from your KOOK account.
              </p>
              <div className="mt-4 border border-[#b11226]/50 bg-[#b11226]/15 px-4 py-3 text-2xl font-black tracking-[0.12em] text-white">
                {verification?.code ?? "Code pending"}
              </div>
            </>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Status label="Primary" value={form.primaryRole} />
          <Status label="Secondary" value={form.secondaryRole} />
          <Status
            label="Nationality"
            value={getCountryOption(form.nationality)?.name ?? form.nationality}
          />
          <Status
            label="Server"
            value={getChinaServerDisplayName(form.chinaServerId, form.chinaServerName)}
          />
        </div>

        <button
          type="button"
          onClick={signOut}
          className="mt-6 w-full border border-[#1f1f1f] px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:border-[#b11226]"
        >
          Sign out
        </button>
      </aside>

      <section className="border border-[#1f1f1f] bg-[#0d0d0d] p-5 sm:p-6">
        <div className="grid gap-5">
          <Panel title="Identity">
            <Field label="Display name" value={form.displayName} onChange={(value) => update("displayName", value)} />
            <Field label="Riot name" value={form.riotName} onChange={(value) => update("riotName", value)} />
            <Field label="Riot tag" value={form.riotTag} onChange={(value) => update("riotTag", value)} />
            <ServerField
              value={form.chinaServerId}
              onChange={(value) => {
                const server = chinaServerOptions.find((item) => item.id === value) ?? chinaServerOptions[0];
                update("chinaServerId", server.id);
                update("chinaServerName", server.name);
              }}
            />
          </Panel>

          <Panel title="Linked Accounts">
            <Field label="KOOK username" value={form.kookUsername} onChange={(value) => update("kookUsername", value)} />
            <Field label="KOOK ID" value={form.kookId} onChange={(value) => update("kookId", value)} />
            <Field label="WeChat ID" value={form.wechatId} onChange={(value) => update("wechatId", value)} />
          </Panel>

          <Panel title="Player Setup">
            <SelectField label="Primary role" value={form.primaryRole} options={roles} onChange={(value) => update("primaryRole", value)} />
            <SelectField label="Secondary role" value={form.secondaryRole} options={roles} onChange={(value) => update("secondaryRole", value)} />
            <CountryField value={form.nationality} onChange={(value) => update("nationality", value)} />
            <Field label="Timezone" value={form.timezone} onChange={(value) => update("timezone", value)} />
          </Panel>

          <Panel title="Profile Image">
            <AvatarUpload preview={form.avatarUrl} uploading={avatarUploading} onChange={changeAvatar} />
            <TextArea label="Bio" value={form.bio} onChange={(value) => update("bio", value)} />
            <BannerControls
              preview={form.bannerUrl}
              positionY={form.privacySettings.bannerPositionY ?? 50}
              uploading={bannerUploading}
              onChange={changeBanner}
              onRemove={removeBanner}
              onPositionChange={(positionY) =>
                update("privacySettings", {
                  ...form.privacySettings,
                  bannerPositionY: positionY,
                })
              }
            />
          </Panel>

          <Panel title="Privacy">
            <Toggle label="Show Riot ID publicly" checked={form.privacySettings.showRiotId} onChange={(checked) => update("privacySettings", { ...form.privacySettings, showRiotId: checked })} />
            <Toggle label="Show email publicly" checked={form.privacySettings.showEmail} onChange={(checked) => update("privacySettings", { ...form.privacySettings, showEmail: checked })} />
            <Toggle label="Show WeChat publicly" checked={form.privacySettings.showWechat} onChange={(checked) => update("privacySettings", { ...form.privacySettings, showWechat: checked })} />
          </Panel>

          {error && <p className="border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">{error}</p>}
          {message && <p className="border border-[#b11226]/40 bg-[#b11226]/10 p-4 text-sm font-bold text-white">{message}</p>}

          <button
            type="button"
            onClick={save}
            className="bg-[#b11226] px-5 py-4 text-sm font-black uppercase tracking-[0.14em] text-white transition hover:bg-[#d11a2a]"
          >
            {profile ? "Save Profile" : "Create Profile"}
          </button>
        </div>
      </section>
    </div>
  );
}

function AvatarUpload({
  preview,
  uploading,
  onChange,
}: {
  preview: string;
  uploading: boolean;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-2 block font-bold text-[#d1d5db]">Upload avatar</span>
      <div className="flex items-center gap-3 border border-[#1f1f1f] bg-[#050505] p-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border border-[#1f1f1f] bg-black text-xs font-black uppercase text-[#9ca3af]">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            "IMG"
          )}
        </div>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={uploading}
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
          className="w-full text-xs font-bold text-[#9ca3af] file:mr-3 file:border-0 file:bg-[#1f1f1f] file:px-3 file:py-2 file:text-xs file:font-black file:uppercase file:text-white disabled:opacity-50"
        />
      </div>
      <span className="mt-2 block text-xs text-[#6b7280]">
        {uploading ? "Uploading..." : "JPG, PNG, or WebP. Max 2MB."}
      </span>
    </label>
  );
}

function BannerUpload({
  preview,
  uploading,
  onChange,
}: {
  preview: string;
  uploading: boolean;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="block text-sm md:col-span-2">
      <span className="mb-2 block font-bold text-[#d1d5db]">Profile banner</span>
      <div className="border border-[#1f1f1f] bg-[#050505] p-3">
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Banner preview" className="mb-3 h-20 w-full object-cover" />
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={uploading}
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
          className="w-full text-xs font-bold text-[#9ca3af] file:mr-3 file:border-0 file:bg-[#1f1f1f] file:px-3 file:py-2 file:text-xs file:font-black file:uppercase file:text-white disabled:opacity-50"
        />
      </div>
      <span className="mt-2 block text-xs text-[#6b7280]">
        {uploading ? "Uploading..." : "Recommended: 1400×200px. JPG, PNG, or WebP. Max 2MB."}
      </span>
    </label>
  );
}

function BannerControls({
  preview,
  positionY,
  uploading,
  onChange,
  onRemove,
  onPositionChange,
}: {
  preview: string;
  positionY: number;
  uploading: boolean;
  onChange: (file: File | null) => void;
  onRemove: () => void;
  onPositionChange: (positionY: number) => void;
}) {
  return (
    <div className="block text-sm md:col-span-2">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="block font-bold text-[#d1d5db]">Profile banner</span>
        {preview && (
          <button
            type="button"
            onClick={onRemove}
            disabled={uploading}
            className="border border-red-500/30 px-3 py-1.5 text-xs font-black uppercase tracking-[0.1em] text-red-200 transition hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>
      <div className="border border-[#1f1f1f] bg-[#050505] p-3">
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Banner preview"
            className="mb-3 h-20 w-full object-cover"
            style={{ objectPosition: `50% ${positionY}%` }}
          />
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={uploading}
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
          className="w-full text-xs font-bold text-[#9ca3af] file:mr-3 file:border-0 file:bg-[#1f1f1f] file:px-3 file:py-2 file:text-xs file:font-black file:uppercase file:text-white disabled:opacity-50"
        />
        {preview && (
          <label className="mt-4 block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[#9ca3af]">
              Banner vertical position
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={positionY}
              disabled={uploading}
              onChange={(event) => onPositionChange(Number(event.target.value))}
              className="w-full accent-[#b11226] disabled:opacity-50"
            />
          </label>
        )}
      </div>
      <span className="mt-2 block text-xs text-[#6b7280]">
        {uploading ? "Uploading..." : "Recommended: 1400 x 200px. JPG, PNG, or WebP. Max 2MB."}
      </span>
    </div>
  );
}

function ServerField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-2 block font-bold text-[#d1d5db]">China server</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border border-[#1f1f1f] bg-[#050505] px-3 py-3 text-white outline-none transition focus:border-[#b11226]"
      >
        {chinaServerOptions.map((server) => (
          <option key={server.id} value={server.id}>
            {server.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function CountryField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const selected = getCountryOption(value)?.code ?? "";

  return (
    <label className="block text-sm">
      <span className="mb-2 block font-bold text-[#d1d5db]">Nationality</span>
      <select
        value={selected}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border border-[#1f1f1f] bg-[#050505] px-3 py-3 text-white outline-none transition focus:border-[#b11226]"
      >
        {countryOptions.map((country) => (
          <option key={country.code || "none"} value={country.code}>
            {country.flag ? `${country.flag} ${country.name}` : country.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#1f1f1f] bg-black/25 p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9ca3af]">{label}</p>
      <p className="mt-1 font-black text-white">{value || "-"}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border border-[#1f1f1f] bg-black/25 p-4">
      <h3 className="mb-4 text-sm font-black uppercase tracking-[0.18em] text-white">{title}</h3>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="mb-2 block font-bold text-[#d1d5db]">{label}</span>
      <input value={value ?? ""} onChange={(event) => onChange(event.target.value)} className="w-full border border-[#1f1f1f] bg-[#050505] px-3 py-3 text-white outline-none transition focus:border-[#b11226]" />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="mb-2 block font-bold text-[#d1d5db]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full border border-[#1f1f1f] bg-[#050505] px-3 py-3 text-white outline-none transition focus:border-[#b11226]">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm md:col-span-2">
      <span className="mb-2 block font-bold text-[#d1d5db]">{label}</span>
      <textarea value={value ?? ""} rows={4} onChange={(event) => onChange(event.target.value)} className="w-full border border-[#1f1f1f] bg-[#050505] px-3 py-3 text-white outline-none transition focus:border-[#b11226]" />
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 border border-[#1f1f1f] bg-[#050505] px-3 py-3 text-sm font-bold text-[#d1d5db]">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-[#b11226]" />
    </label>
  );
}
