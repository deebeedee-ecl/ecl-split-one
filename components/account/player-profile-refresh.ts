export type StoredProfileRefreshLoad<TProfile> = {
  visibleProfile: TProfile | null;
  refreshCandidate: TProfile | null;
};

type StoredProfileRefreshFlow<TProfile> = {
  loadStoredProfile: () => Promise<StoredProfileRefreshLoad<TProfile>>;
  shouldRefresh: (profile: TProfile) => boolean;
  refreshProfile: (profile: TProfile) => Promise<TProfile | null>;
  isCurrent: () => boolean;
  onStoredProfile: (profile: TProfile | null) => void;
  onReady: () => void;
  onLoadError: (error: unknown) => void;
  onRefreshStart: () => void;
  onRefreshSkipped: () => void;
  onRefreshSuccess: (profile: TProfile) => void;
  onRefreshError: (error: unknown) => void;
  onRefreshEnd: () => void;
};

/**
 * Publishes the stored route-specific profile before starting optional provider
 * enrichment. Every callback is guarded so an obsolete component/user request
 * cannot replace the currently visible profile state.
 */
export async function runStoredProfileRefreshFlow<TProfile>({
  loadStoredProfile,
  shouldRefresh,
  refreshProfile,
  isCurrent,
  onStoredProfile,
  onReady,
  onLoadError,
  onRefreshStart,
  onRefreshSkipped,
  onRefreshSuccess,
  onRefreshError,
  onRefreshEnd,
}: StoredProfileRefreshFlow<TProfile>) {
  let loaded: StoredProfileRefreshLoad<TProfile>;
  try {
    loaded = await loadStoredProfile();
  } catch (error) {
    if (isCurrent()) onLoadError(error);
    return;
  }
  if (!isCurrent()) return;

  onStoredProfile(loaded.visibleProfile);
  onReady();

  const candidate = loaded.refreshCandidate;
  if (!candidate || !shouldRefresh(candidate)) {
    onRefreshSkipped();
    return;
  }

  onRefreshStart();
  try {
    const refreshed = await refreshProfile(candidate);
    if (!isCurrent()) return;
    if (!refreshed) {
      throw new Error("The refreshed profile could not be loaded.");
    }
    onRefreshSuccess(refreshed);
  } catch (error) {
    if (isCurrent()) onRefreshError(error);
  } finally {
    if (isCurrent()) onRefreshEnd();
  }
}
