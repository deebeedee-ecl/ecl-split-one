import type {
  AccountProfileView,
  ApplicationProfileDto,
  PlayerProfileDto,
  ReporterProfileDto,
  SettingsProfileDto,
} from "@/lib/account-profile-dto";

export const PROFILE_REQUEST_TIMEOUT_MS = 10_000;

type ProfileViewDto = {
  profile: PlayerProfileDto;
  settings: SettingsProfileDto;
  application: ApplicationProfileDto;
  reporter: ReporterProfileDto;
};

type ProfileRequestOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

export class ProfileRequestError extends Error {
  status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "ProfileRequestError";
    this.status = status;
  }
}

function abortError() {
  return new DOMException("The profile request was cancelled.", "AbortError");
}

export async function requestAccountProfile<TView extends AccountProfileView>(
  view: TView,
  accessToken: string,
  options: ProfileRequestOptions = {},
): Promise<ProfileViewDto[TView] | null> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? PROFILE_REQUEST_TIMEOUT_MS;
  let timedOut = false;
  const cancel = () => controller.abort();

  if (options.signal?.aborted) throw abortError();
  options.signal?.addEventListener("abort", cancel, { once: true });
  const timer = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(`/api/account/profile?view=${view}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => ({}))) as {
      message?: string;
      profile?: ProfileViewDto[TView] | null;
    };

    if (!response.ok) {
      throw new ProfileRequestError(
        data.message ?? `Profile request failed (${response.status}).`,
        response.status,
      );
    }

    return data.profile ?? null;
  } catch (error) {
    if (timedOut) {
      throw new ProfileRequestError(
        "The profile request took too long. Check your connection and try again.",
      );
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancel);
  }
}

export function profileLoadErrorMessage(error: unknown) {
  if (error instanceof ProfileRequestError) return error.message;
  return "The profile could not be loaded. Check your connection and try again.";
}
