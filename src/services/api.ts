import type { TRegisterValues } from "@/schemas/register.schema";

export interface PlayerRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  province: string;
  school: string;
  major: string;
  interest: string;
  isFollowingOa: boolean;
  createdAt: string;
  spinCount: number;
  rewardCount: number;
  latestReward: string | null;
  lastPlayedAt: string | null;
}

export interface AdminStats {
  playerCount: number;
  spinCount: number;
  rewardCount: number;
}

export interface RecruitmentOaConfig {
  oaUrl: string | null;
}

export interface PlayerList {
  players: PlayerRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface SpinResult {
  slotId: number;
  slotIndex: number;
  reward: string | null;
  createdAt: string;
  wheel: WheelOption[];
}

export interface SpinStatus {
  used: boolean;
}

export type PuzzleLevel = 1 | 2;
export type PuzzlePlayState = "started" | "completed" | "failed";

export interface PuzzlePlay {
  id: number;
  level: PuzzleLevel;
  status: PuzzlePlayState;
  startedAt: string;
  completedAt: string | null;
  retryAt?: string | null;
}

export interface PuzzleStatus {
  plays: PuzzlePlay[];
  completedLevels?: PuzzleLevel[];
}

export interface InterestOption {
  id: number;
  name: string;
}

export interface ProvinceOption {
  id: number;
  name: string;
}

export interface SchoolOption {
  id: number;
  name: string;
  displayName: string;
}

export interface GameOption {
  id: number;
  code: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  routePath: string;
}

export interface StudentProfile {
  name: string;
  phone: string;
  email: string;
  province: string;
  school: string;
  major: string;
  createdAt: string;
}

export interface RewardRecord {
  id: number;
  gameName: string;
  reward: string;
  receivedAt: string | null;
}

export interface WheelOption {
  id: number;
  label: string;
  isReward: boolean;
}

export interface PuzzleImageOption {
  id: number;
  name: string;
  url: string;
}

export interface PuzzleGameConfig {
  cooldownSeconds: number;
  selectedImageId: number | null;
  images: PuzzleImageOption[];
}

const PLAYER_ID_KEY = "cusc-zalo-mini-app-player-id";
const STUDENT_PROFILE_KEY = "cusc-zalo-mini-app-student-profile";
export const RECRUITMENT_OA_URL_KEY = "cusc-zalo-mini-app-recruitment-oa";
const DEFAULT_RECRUITMENT_OA_URL = "https://zalo.me/149986668034000433";
const LOCAL_DEVELOPMENT_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
]);

export function isLocalDevelopmentOrigin() {
  return (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    LOCAL_DEVELOPMENT_HOSTS.has(window.location.hostname.toLowerCase())
  );
}

export function isZaloTestMode() {
  return (
    isLocalDevelopmentOrigin() ||
    import.meta.env.VITE_ALLOW_ZALO_TEST_MODE?.trim().toLowerCase() === "true"
  );
}

export function getApiBaseUrl() {
  if (isLocalDevelopmentOrigin()) return "http://127.0.0.1:3001";
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!baseUrl) {
    throw new Error("Chưa cấu hình VITE_API_BASE_URL cho backend.");
  }
  return baseUrl;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : `Yêu cầu thất bại (${response.status}).`;
    throw new Error(message);
  }
  if (body === null) throw new Error("Máy chủ trả về dữ liệu không hợp lệ.");
  return body as T;
}

export const playerApi = {
  async register(player: TRegisterValues & { zaloUserId: string }) {
    const result = await apiRequest<{
      id: number;
      createdAt: string;
      oaUrl: string | null;
      profile: StudentProfile;
    }>(
      "/api/players",
      { method: "POST", body: JSON.stringify(player) }
    );
    localStorage.setItem(PLAYER_ID_KEY, String(result.id));
    localStorage.setItem(STUDENT_PROFILE_KEY, JSON.stringify(result.profile));
    sessionStorage.removeItem(STUDENT_PROFILE_KEY);
    localStorage.setItem(
      RECRUITMENT_OA_URL_KEY,
      result.oaUrl || DEFAULT_RECRUITMENT_OA_URL
    );
    localStorage.removeItem("cusc-zalo-mini-app-school-oa");
    return result;
  },
  async loginByPhone(phone: string) {
    const result = await apiRequest<{
      id: number;
      profile: StudentProfile;
    }>("/api/players/login-by-phone", {
      method: "POST",
      body: JSON.stringify({ phone }),
    });
    localStorage.setItem(PLAYER_ID_KEY, String(result.id));
    localStorage.setItem(STUDENT_PROFILE_KEY, JSON.stringify(result.profile));
    sessionStorage.removeItem(STUDENT_PROFILE_KEY);
    return result;
  },
};

export const publicGameApi = {
  interests() {
    return apiRequest<InterestOption[]>("/api/interests");
  },
  provinces() {
    return apiRequest<ProvinceOption[]>("/api/provinces");
  },
  schools(provinceId: number, query: string) {
    const params = new URLSearchParams({
      provinceId: String(provinceId),
      q: query,
    });
    return apiRequest<SchoolOption[]>(`/api/schools?${params}`);
  },
  games() {
    return apiRequest<GameOption[]>("/api/games");
  },
  wheel() {
    return apiRequest<WheelOption[]>("/api/game/wheel");
  },
};

function getSavedStudentProfile(): StudentProfile | null {
  const savedProfile = localStorage.getItem(STUDENT_PROFILE_KEY);
  if (savedProfile) {
    try {
      return JSON.parse(savedProfile) as StudentProfile;
    } catch {
      localStorage.removeItem(STUDENT_PROFILE_KEY);
      sessionStorage.removeItem(STUDENT_PROFILE_KEY);
      throw new Error("Thông tin cá nhân đã lưu không đúng định dạng.");
    }
  }

  const sessionProfile = sessionStorage.getItem(STUDENT_PROFILE_KEY);
  if (!sessionProfile) return null;
  try {
    localStorage.setItem(STUDENT_PROFILE_KEY, sessionProfile);
    sessionStorage.removeItem(STUDENT_PROFILE_KEY);
    return JSON.parse(sessionProfile) as StudentProfile;
  } catch {
    localStorage.removeItem(STUDENT_PROFILE_KEY);
    sessionStorage.removeItem(STUDENT_PROFILE_KEY);
    throw new Error("Thông tin cá nhân đã lưu không đúng định dạng.");
  }
}

function getPlayerId() {
  return localStorage.getItem(PLAYER_ID_KEY);
}

export const profileApi = {
  get: getSavedStudentProfile,
  async refresh() {
    const playerId = getPlayerId();
    if (!playerId) return null;
    const profile = await apiRequest<StudentProfile>(
      `/api/players/${encodeURIComponent(playerId)}/profile`
    );
    localStorage.setItem(STUDENT_PROFILE_KEY, JSON.stringify(profile));
    return profile;
  },
  clearRegistration() {
    localStorage.removeItem(PLAYER_ID_KEY);
    localStorage.removeItem(STUDENT_PROFILE_KEY);
    sessionStorage.removeItem(STUDENT_PROFILE_KEY);
  },
  hasRegistration() {
    if (!localStorage.getItem(PLAYER_ID_KEY)) return false;
    try {
      return getSavedStudentProfile() !== null;
    } catch (error) {
      console.error("Could not verify the saved student profile:", error);
      return false;
    }
  },
  rewards() {
    const playerId = localStorage.getItem(PLAYER_ID_KEY);
    if (!playerId) return Promise.resolve([] as RewardRecord[]);
    return apiRequest<RewardRecord[]>(
      `/api/players/${encodeURIComponent(playerId)}/rewards`
    );
  },
};

export const gameApi = {
  status() {
    const playerId = localStorage.getItem(PLAYER_ID_KEY);
    if (!playerId) return Promise.resolve(null);
    const params = new URLSearchParams({ playerId });
    return apiRequest<SpinStatus>(`/api/game/spins/status?${params}`);
  },
  spin() {
    const playerId = localStorage.getItem(PLAYER_ID_KEY);
    if (!playerId) {
      throw new Error("Vui lòng đăng ký tham gia trước khi quay.");
    }
    return apiRequest<SpinResult>("/api/game/spins", {
      method: "POST",
      body: JSON.stringify({ playerId }),
    });
  },
};

export const puzzleApi = {
  config() {
    return apiRequest<PuzzleGameConfig>("/api/game/puzzle/config");
  },
  status() {
    const playerId = getPlayerId();
    if (!playerId) throw new Error("Vui lòng đăng ký tham gia trước khi chơi.");
    const params = new URLSearchParams({ playerId });
    return apiRequest<PuzzleStatus>(`/api/game/puzzle/status?${params}`);
  },
  start(level: PuzzleLevel) {
    const playerId = getPlayerId();
    if (!playerId) throw new Error("Vui lòng đăng ký tham gia trước khi chơi.");
    return apiRequest<PuzzlePlay>("/api/game/puzzle/plays", {
      method: "POST",
      body: JSON.stringify({ playerId, level }),
    });
  },
  complete(level: PuzzleLevel, playId: number, solution: number[]) {
    const playerId = getPlayerId();
    if (!playerId) throw new Error("Vui lòng đăng ký tham gia trước khi chơi.");
    return apiRequest<PuzzlePlay>("/api/game/puzzle/complete", {
      method: "POST",
      body: JSON.stringify({ playerId, level, playId, solution }),
    });
  },
};

export const adminApi = {
  async exportReport(
    token: string,
    startDate: string,
    endDate: string
  ): Promise<Blob> {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    const queryString = params.toString();
    const query = queryString ? `?${queryString}` : "";
    const response = await fetch(`${getApiBaseUrl()}/api/admin/export${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      const message =
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof body.error === "string"
          ? body.error
          : `Không thể xuất báo cáo (${response.status}).`;
      throw new Error(message);
    }
    return response.blob();
  },

  stats(token: string) {
    return apiRequest<AdminStats>("/api/admin/stats", {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  oaConfig(token: string) {
    return apiRequest<RecruitmentOaConfig>("/api/admin/oa", {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  updateOaConfig(token: string, oaUrl: string) {
    return apiRequest<RecruitmentOaConfig>("/api/admin/oa", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ oaUrl }),
    });
  },
  players(token: string, page: number, query: string) {
    const params = new URLSearchParams({
      page: String(page),
      limit: "10",
      q: query,
    });
    return apiRequest<PlayerList>(`/api/admin/players?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  interests(token: string) {
    return apiRequest<InterestOption[]>("/api/admin/interests", {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  createInterest(token: string, name: string) {
    return apiRequest<InterestOption>("/api/admin/interests", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
    });
  },
  updateInterest(token: string, id: number, name: string) {
    return apiRequest<InterestOption>(`/api/admin/interests/${id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
    });
  },
  deleteInterest(token: string, id: number) {
    return apiRequest<{ deleted: boolean }>(`/api/admin/interests/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  wheel(token: string) {
    return apiRequest<WheelOption[]>("/api/admin/wheel", {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  createWheelSlot(token: string, label: string, isReward: boolean) {
    return apiRequest<WheelOption>("/api/admin/wheel", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ label, isReward }),
    });
  },
  updateWheelSlot(
    token: string,
    id: number,
    label: string,
    isReward: boolean
  ) {
    return apiRequest<WheelOption>(`/api/admin/wheel/${id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ label, isReward }),
    });
  },
  deleteWheelSlot(token: string, id: number) {
    return apiRequest<{ deleted: boolean }>(`/api/admin/wheel/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  puzzleConfig(token: string) {
    return apiRequest<PuzzleGameConfig>("/api/admin/puzzle/config", {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  updatePuzzleConfig(
    token: string,
    cooldownSeconds: number,
    selectedImageId: number | null
  ) {
    return apiRequest<PuzzleGameConfig>("/api/admin/puzzle/config", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ cooldownSeconds, selectedImageId }),
    });
  },
  uploadPuzzleImage(token: string, name: string, dataUrl: string) {
    return apiRequest<{
      id: number;
      name: string;
      url: string;
      config: PuzzleGameConfig;
    }>("/api/admin/puzzle/images", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, dataUrl }),
    });
  },
  deletePuzzleImage(token: string, id: number) {
    return apiRequest<{ deleted: boolean; config: PuzzleGameConfig }>(
      `/api/admin/puzzle/images/${id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
  },
};
