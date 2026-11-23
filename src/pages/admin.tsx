import Background from "@/components/background";
import Header from "@/components/header";
import { PATHS } from "@/constants/path";
import {
  adminApi,
  type AdminStats,
  type InterestOption,
  type PlayerRecord,
  type WheelOption,
  type PuzzleGameConfig,
  getApiBaseUrl,
} from "@/services/api";
import { useEffect, useState } from "react";
import { downloadFile } from "zmp-sdk/apis";
import { Page, useNavigate } from "zmp-ui";

const ADMIN_TOKEN_KEY = "cusc-zalo-mini-app-admin-token";
const MAX_ZMP_DOWNLOAD_BASE64_LENGTH = 7_000_000;
type AdminTab = "reports" | "settings";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Không thể đọc nội dung file Excel."));
        return;
      }
      const separatorIndex = reader.result.indexOf(",");
      if (separatorIndex === -1) {
        reject(new Error("Dữ liệu file Excel không đúng định dạng."));
        return;
      }
      resolve(reader.result.slice(separatorIndex + 1));
    };
    reader.onerror = () =>
      reject(reader.error || new Error("Không thể đọc nội dung file Excel."));
    reader.readAsDataURL(blob);
  });
}

function formatDate(value: string | null) {
  if (!value) return "Chưa chơi";
  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateInput(value: string) {
  if (!value) return "Chọn ngày";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>("reports");
  const [token, setToken] = useState("");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [error, setError] = useState("");
  const [oaUrl, setOaUrl] = useState("");
  const [savingOa, setSavingOa] = useState(false);
  const [oaSaveMessage, setOaSaveMessage] = useState("");
  const [interests, setInterests] = useState<InterestOption[]>([]);
  const [wheelSlots, setWheelSlots] = useState<WheelOption[]>([]);
  const [newInterest, setNewInterest] = useState("");
  const [editingInterestId, setEditingInterestId] = useState<number | null>(
    null
  );
  const [editingInterestName, setEditingInterestName] = useState("");
  const [newWheelLabel, setNewWheelLabel] = useState("");
  const [newWheelIsReward, setNewWheelIsReward] = useState(true);
  const [editingWheelId, setEditingWheelId] = useState<number | null>(null);
  const [editingWheelLabel, setEditingWheelLabel] = useState("");
  const [editingWheelIsReward, setEditingWheelIsReward] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<{
    type: "interest" | "wheel";
    id: number;
  } | null>(null);
  const [puzzleConfig, setPuzzleConfig] = useState<PuzzleGameConfig | null>(null);
  const [puzzleCooldown, setPuzzleCooldown] = useState(600);
  const [puzzleSelectedImageId, setPuzzleSelectedImageId] = useState<number | null>(null);
  const [puzzleImageName, setPuzzleImageName] = useState("");
  const [puzzleImageDataUrl, setPuzzleImageDataUrl] = useState("");
  const [savingPuzzle, setSavingPuzzle] = useState(false);

  async function loadAdminData(
    adminToken: string,
    requestedPage: number,
    search: string
  ) {
    setLoading(true);
    setError("");
    try {
      const [nextStats, result, nextInterests, nextWheel, oaConfig, nextPuzzle] = await Promise.all([
        adminApi.stats(adminToken),
        adminApi.players(adminToken, requestedPage, search),
        adminApi.interests(adminToken),
        adminApi.wheel(adminToken),
        adminApi.oaConfig(adminToken),
        adminApi.puzzleConfig(adminToken),
      ]);
      setStats(nextStats);
      setPlayers(result.players);
      setTotal(result.total);
      setPage(result.page);
      setInterests(nextInterests);
      setWheelSlots(nextWheel);
      setOaUrl(oaConfig.oaUrl || "");
      setPuzzleConfig(nextPuzzle);
      setPuzzleCooldown(nextPuzzle.cooldownSeconds);
      setPuzzleSelectedImageId(nextPuzzle.selectedImageId);
      sessionStorage.setItem(ADMIN_TOKEN_KEY, adminToken);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không thể tải dữ liệu quản trị."
      );
      if (
        requestError instanceof Error &&
        requestError.message === "Admin authentication required."
      ) {
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        setStats(null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const savedToken = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (savedToken) {
      setToken(savedToken);
      void loadAdminData(savedToken, 1, "");
    }
  }, []);

  function handleConnect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadAdminData(token.trim(), 1, query);
  }

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadAdminData(token, 1, query.trim());
  }

  function disconnect() {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken("");
    setStats(null);
    setPlayers([]);
    setTotal(0);
    setInterests([]);
    setWheelSlots([]);
    setOaUrl("");
    setOaSaveMessage("");
    setError("");
  }

  async function saveOaConfig(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingOa(true);
    setError("");
    setOaSaveMessage("");
    try {
      const result = await adminApi.updateOaConfig(token, oaUrl.trim());
      setOaUrl(result.oaUrl || "");
      setOaSaveMessage("Đã lưu OA tuyển sinh dùng chung.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không thể lưu OA tuyển sinh."
      );
    } finally {
      setSavingOa(false);
    }
  }

  async function exportReport() {
    if (exportStartDate && exportEndDate && exportStartDate > exportEndDate) {
      setError("Ngày bắt đầu không được sau ngày kết thúc.");
      return;
    }
    setExporting(true);
    setError("");
    setExportMessage("");
    let requestingDeviceDownload = false;
    try {
      const report = await adminApi.exportReport(
        token,
        exportStartDate,
        exportEndDate
      );
      if (/zalo/i.test(navigator.userAgent)) {
        const fileBase64Data = await blobToBase64(report);
        if (fileBase64Data.length > MAX_ZMP_DOWNLOAD_BASE64_LENGTH) {
          throw new Error(
            "File Excel quá lớn để tải trong Zalo Mini App. Vui lòng xuất file trên trình duyệt máy tính."
          );
        }
        requestingDeviceDownload = true;
        await downloadFile({ fileBase64Data });
      } else {
        const url = URL.createObjectURL(report);
        const link = document.createElement("a");
        link.href = url;
        const range = exportStartDate || exportEndDate
          ? `${exportStartDate || "tat-ca"}-${exportEndDate || "hien-tai"}`
          : new Date().toISOString().slice(0, 10);
        link.download = `cusc-bao-cao-${range}.xlsx`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
      setExportMessage("Đã tạo file Excel. Kiểm tra thư mục Tệp đã tải xuống trên thiết bị.");
    } catch (requestError) {
      const requestMessage =
        requestError instanceof Error
          ? requestError.message
          : "Không thể xuất báo cáo Excel.";
      setError(
        requestingDeviceDownload
          ? "Zalo không lưu được file. Chủ Mini App cần bật quyền downloadFile trong trang Quản lý ứng dụng Zalo, rồi mở lại Mini App."
          : requestMessage
      );
    } finally {
      setExporting(false);
    }
  }

  async function saveInterest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (editingInterestId === null) {
        await adminApi.createInterest(token, newInterest.trim());
        setNewInterest("");
      } else {
        await adminApi.updateInterest(
          token,
          editingInterestId,
          editingInterestName.trim()
        );
        setEditingInterestId(null);
      }
      await loadAdminData(token, page, query);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không thể lưu ngành quan tâm."
      );
    }
  }

  async function saveWheelSlot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (editingWheelId === null) {
        await adminApi.createWheelSlot(
          token,
          newWheelLabel.trim(),
          newWheelIsReward
        );
        setNewWheelLabel("");
      } else {
        await adminApi.updateWheelSlot(
          token,
          editingWheelId,
          editingWheelLabel.trim(),
          editingWheelIsReward
        );
        setEditingWheelId(null);
      }
      await loadAdminData(token, page, query);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không thể lưu ô vòng quay."
      );
    }
  }

  async function savePuzzleConfig(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPuzzle(true);
    setError("");
    try {
      const nextConfig = await adminApi.updatePuzzleConfig(
        token,
        puzzleCooldown,
        puzzleSelectedImageId
      );
      setPuzzleConfig(nextConfig);
      setPuzzleCooldown(nextConfig.cooldownSeconds);
      setPuzzleSelectedImageId(nextConfig.selectedImageId);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không thể lưu cấu hình trò chơi xếp hình."
      );
    } finally {
      setSavingPuzzle(false);
    }
  }

  function handlePuzzleImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Dung lượng ảnh gốc tối đa 10 MB.");
      event.target.value = "";
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 720;
      canvas.height = 960;
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        setError("Không thể xử lý ảnh trên thiết bị.");
        return;
      }
      const sourceRatio = image.naturalWidth / image.naturalHeight;
      const targetRatio = canvas.width / canvas.height;
      let sourceWidth = image.naturalWidth;
      let sourceHeight = image.naturalHeight;
      let sourceX = 0;
      let sourceY = 0;
      if (sourceRatio > targetRatio) {
        sourceWidth = image.naturalHeight * targetRatio;
        sourceX = (image.naturalWidth - sourceWidth) / 2;
      } else {
        sourceHeight = image.naturalWidth / targetRatio;
        sourceY = (image.naturalHeight - sourceHeight) / 2;
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        canvas.width,
        canvas.height
      );
      const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
      setPuzzleImageName((current) => current || file.name.replace(/\.[^.]+$/, ""));
      setPuzzleImageDataUrl(dataUrl);
      setError("");
      URL.revokeObjectURL(objectUrl);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setError("File không phải là ảnh hợp lệ.");
    };
    image.src = objectUrl;
  }

  async function uploadPuzzleImage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!puzzleImageDataUrl) {
      setError("Vui lòng chọn ảnh mới.");
      return;
    }
    setSavingPuzzle(true);
    setError("");
    try {
      const result = await adminApi.uploadPuzzleImage(
        token,
        puzzleImageName.trim(),
        puzzleImageDataUrl
      );
      setPuzzleConfig(result.config);
      setPuzzleCooldown(result.config.cooldownSeconds);
      setPuzzleSelectedImageId(result.config.selectedImageId);
      setPuzzleImageName("");
      setPuzzleImageDataUrl("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không thể tải ảnh lên."
      );
    } finally {
      setSavingPuzzle(false);
    }
  }

  async function deletePuzzleImage(id: number) {
    setSavingPuzzle(true);
    setError("");
    try {
      const result = await adminApi.deletePuzzleImage(token, id);
      setPuzzleConfig(result.config);
      setPuzzleCooldown(result.config.cooldownSeconds);
      setPuzzleSelectedImageId(result.config.selectedImageId);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không thể xóa ảnh."
      );
    } finally {
      setSavingPuzzle(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      if (pendingDelete.type === "interest") {
        await adminApi.deleteInterest(token, pendingDelete.id);
      } else {
        await adminApi.deleteWheelSlot(token, pendingDelete.id);
      }
      setPendingDelete(null);
      await loadAdminData(token, page, query);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không thể xóa mục đã chọn."
      );
    }
  }

  return (
    <Page
      hideScrollbar
      className="relative overflow-y-scroll overflow-x-hidden bg-layer-layer_background_subtle pb-24"
    >
      <Background />
      <div className="relative admin-page">
        <Header />
        <main className="mx-4 pb-8">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-small text-gray-500">TỔNG QUAN</p>
              <h1 className="mt-1 text-2xl font-bold text-gray-900">
                Quản trị chiến dịch
              </h1>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="rounded-full bg-[#EAF3FF] px-3 py-1 text-xs font-semibold text-[#0068FF]">
                {stats ? "Đã xác thực" : "Chưa kết nối"}
              </span>
              {stats && (
                <button
                  type="button"
                  onClick={disconnect}
                  className="text-xs font-medium text-[#0068FF]"
                >
                  Đăng xuất
                </button>
              )}
            </div>
          </div>

          {!stats && (
            <form
              onSubmit={handleConnect}
              className="mb-5 rounded-2xl bg-white p-4 shadow-sm"
            >
              <label
                htmlFor="admin-token"
                className="mb-2 block text-sm font-semibold text-gray-800"
              >
                Mật khẩu quản trị
              </label>
              <input
                id="admin-token"
                type="password"
                autoComplete="current-password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="Nhập mật khẩu quản trị"
                className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-[#0068FF]"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="mt-3 w-full rounded-xl bg-[#0068FF] px-4 py-3 font-semibold text-white disabled:opacity-60"
              >
                {loading ? "Đang xác thực..." : "Đăng nhập quản trị"}
              </button>
              <p className="mt-2 text-xs leading-5 text-gray-500">
                Mã được lưu trong phiên hiện tại và xóa khi đăng xuất.
              </p>
            </form>
          )}

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {exportMessage && activeTab === "reports" && (
            <p role="status" className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-700">
              {exportMessage}
            </p>
          )}

          {stats && (
            <div
              className="mb-5 grid grid-cols-2 rounded-xl bg-gray-100 p-1"
              role="tablist"
              aria-label="Các mục quản trị"
            >
              <button
                id="admin-tab-reports"
                type="button"
                role="tab"
                aria-selected={activeTab === "reports"}
                onClick={() => setActiveTab("reports")}
                className={`rounded-lg px-2 py-3 text-sm font-semibold transition ${
                  activeTab === "reports"
                    ? "bg-white text-[#0068FF] shadow-sm"
                    : "text-gray-600"
                }`}
              >
                Báo cáo & sinh viên
              </button>
              <button
                id="admin-tab-settings"
                type="button"
                role="tab"
                aria-selected={activeTab === "settings"}
                onClick={() => setActiveTab("settings")}
                className={`rounded-lg px-2 py-3 text-sm font-semibold transition ${
                  activeTab === "settings"
                    ? "bg-white text-[#0068FF] shadow-sm"
                    : "text-gray-600"
                }`}
              >
                Cấu hình OA & trò chơi
              </button>
            </div>
          )}

          {stats && (
            <>
              {activeTab === "reports" && (
                <div
                  id="admin-panel-reports"
                  role="tabpanel"
                  aria-labelledby="admin-tab-reports"
                >
              <section className="mb-5 grid grid-cols-3 gap-2">
                {[
                  { label: "Học sinh", value: stats.playerCount },
                  { label: "Lượt quay", value: stats.spinCount },
                  { label: "Giải thưởng", value: stats.rewardCount },
                ].map((stat) => (
                  <article
                    key={stat.label}
                    className="rounded-2xl bg-white p-3 shadow-sm"
                  >
                    <p className="text-xl font-bold text-[#0068FF]">
                      {stat.value.toLocaleString("vi-VN")}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">{stat.label}</p>
                  </article>
                ))}
              </section>

              <section className="mb-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">
                      Khoảng thời gian
                    </h2>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {exportStartDate || exportEndDate
                        ? `${exportStartDate ? formatDateInput(exportStartDate) : "Không giới hạn"} – ${exportEndDate ? formatDateInput(exportEndDate) : "Không giới hạn"}`
                        : "Tất cả dữ liệu"}
                    </p>
                  </div>
                  {(exportStartDate || exportEndDate) && (
                    <button
                      type="button"
                      onClick={() => {
                        setExportStartDate("");
                        setExportEndDate("");
                      }}
                      className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-[#0068FF]"
                    >
                      Xóa lọc
                    </button>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="min-w-0 text-xs font-medium text-gray-600">
                    Từ ngày
                    <span className="relative mt-1 flex h-11 items-center gap-2 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 px-3 text-[13px] font-normal text-gray-800 transition-colors focus-within:border-[#0068FF] focus-within:bg-white">
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-4 w-4 shrink-0 text-[#0068FF]"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
                        <path d="M7.5 3.5v3M16.5 3.5v3M3.5 9.5h17" />
                      </svg>
                      <span className={exportStartDate ? "" : "text-gray-400"}>
                        {formatDateInput(exportStartDate)}
                      </span>
                      <input
                        aria-label="Chọn ngày bắt đầu"
                        type="date"
                        value={exportStartDate}
                        max={exportEndDate || undefined}
                        onChange={(event) =>
                          setExportStartDate(event.target.value)
                        }
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      />
                    </span>
                  </label>
                  <label className="min-w-0 text-xs font-medium text-gray-600">
                    Đến ngày
                    <span className="relative mt-1 flex h-11 items-center gap-2 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 px-3 text-[13px] font-normal text-gray-800 transition-colors focus-within:border-[#0068FF] focus-within:bg-white">
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-4 w-4 shrink-0 text-[#0068FF]"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
                        <path d="M7.5 3.5v3M16.5 3.5v3M3.5 9.5h17" />
                      </svg>
                      <span className={exportEndDate ? "" : "text-gray-400"}>
                        {formatDateInput(exportEndDate)}
                      </span>
                      <input
                        aria-label="Chọn ngày kết thúc"
                        type="date"
                        value={exportEndDate}
                        min={exportStartDate || undefined}
                        onChange={(event) =>
                          setExportEndDate(event.target.value)
                        }
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      />
                    </span>
                  </label>
                </div>
                <p className="mt-2 text-[11px] leading-4 text-gray-500">
                  Học sinh theo ngày đăng ký · lượt chơi theo ngày chơi.
                </p>
              </section>
              <button
                type="button"
                onClick={() => void exportReport()}
                disabled={exporting || loading}
                className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0068FF] px-4 py-3 font-semibold text-white disabled:opacity-60"
              >
                <span aria-hidden="true">↓</span>
                {exporting ? "Đang tạo file Excel..." : "Xuất Excel học sinh & tổng kết"}
              </button>
                </div>
              )}

              {activeTab === "settings" && (
                <div
                  id="admin-panel-settings"
                  role="tabpanel"
                  aria-labelledby="admin-tab-settings"
                >
              <section className="mb-5 rounded-2xl bg-white p-4 shadow-sm">
                <h2 className="font-semibold text-gray-900">
                  OA tuyển sinh CUSC
                </h2>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  OA này được dùng chung cho tất cả học sinh sau khi đăng ký.
                </p>
                <form onSubmit={saveOaConfig} className="mt-3">
                  <label
                    htmlFor="recruitment-oa-url"
                    className="mb-1 block text-xs font-medium text-gray-600"
                  >
                    Đường dẫn OA
                  </label>
                  <input
                    id="recruitment-oa-url"
                    type="url"
                    value={oaUrl}
                    onChange={(event) => {
                      setOaUrl(event.target.value);
                      setOaSaveMessage("");
                    }}
                    placeholder="https://zalo.me/..."
                    className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-[#0068FF]"
                    required
                  />
                  <button
                    type="submit"
                    disabled={savingOa || loading}
                    className="mt-3 w-full rounded-xl bg-[#0068FF] px-4 py-3 font-semibold text-white disabled:opacity-60"
                  >
                    {savingOa ? "Đang lưu..." : "Lưu OA tuyển sinh"}
                  </button>
                </form>
                {oaSaveMessage && (
                  <p role="status" className="mt-2 text-xs text-green-700">
                    {oaSaveMessage}
                  </p>
                )}
              </section>

              <section className="mb-5 rounded-2xl bg-white p-4 shadow-sm">
                <h2 className="font-semibold text-gray-900">
                  Quản lý ngành quan tâm
                </h2>
                <form onSubmit={saveInterest} className="mt-3 flex gap-2">
                  <input
                    value={
                      editingInterestId === null
                        ? newInterest
                        : editingInterestName
                    }
                    onChange={(event) =>
                      editingInterestId === null
                        ? setNewInterest(event.target.value)
                        : setEditingInterestName(event.target.value)
                    }
                    maxLength={100}
                    placeholder="Ví dụ: Lập trình viên quốc tế"
                    className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#0068FF]"
                    required
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-[#0068FF] px-4 text-sm font-semibold text-white"
                  >
                    {editingInterestId === null ? "Thêm" : "Lưu"}
                  </button>
                </form>
                {editingInterestId !== null && (
                  <button
                    type="button"
                    onClick={() => setEditingInterestId(null)}
                    className="mt-2 text-xs text-gray-500"
                  >
                    Hủy sửa
                  </button>
                )}
                <div className="mt-3 divide-y divide-gray-100">
                  {interests.map((interest) => (
                    <div
                      key={interest.id}
                      className="flex items-center justify-between gap-2 py-3"
                    >
                      <span className="min-w-0 break-words text-sm text-gray-800">
                        {interest.name}
                      </span>
                      <span className="flex shrink-0 gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingInterestId(interest.id);
                            setEditingInterestName(interest.name);
                          }}
                          className="text-sm font-medium text-[#0068FF]"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingDelete({
                              type: "interest",
                              id: interest.id,
                            })
                          }
                          className="text-sm font-medium text-red-600"
                        >
                          Xóa
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mb-5 rounded-2xl bg-white p-4 shadow-sm">
                <h2 className="font-semibold text-gray-900">
                  Cấu hình vòng quay
                </h2>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  Các ô có xác suất như nhau, tối đa 12 ô và cần giữ ít nhất 2
                  ô. Sửa tên quà mẫu trước khi tổ chức chương trình.
                </p>
                <form onSubmit={saveWheelSlot} className="mt-3 space-y-3">
                  <input
                    value={
                      editingWheelId === null
                        ? newWheelLabel
                        : editingWheelLabel
                    }
                    onChange={(event) =>
                      editingWheelId === null
                        ? setNewWheelLabel(event.target.value)
                        : setEditingWheelLabel(event.target.value)
                    }
                    maxLength={80}
                    placeholder="Tên ô / phần thưởng"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#0068FF]"
                    required
                  />
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={
                        editingWheelId === null
                          ? newWheelIsReward
                          : editingWheelIsReward
                      }
                      onChange={(event) =>
                        editingWheelId === null
                          ? setNewWheelIsReward(event.target.checked)
                          : setEditingWheelIsReward(event.target.checked)
                      }
                      className="h-4 w-4 accent-[#0068FF]"
                    />
                    Đây là ô trúng thưởng
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={
                        editingWheelId === null && wheelSlots.length >= 12
                      }
                      className="rounded-xl bg-[#0068FF] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {editingWheelId === null ? "Thêm ô" : "Lưu ô"}
                    </button>
                    {editingWheelId !== null && (
                      <button
                        type="button"
                        onClick={() => setEditingWheelId(null)}
                        className="px-3 text-sm text-gray-500"
                      >
                        Hủy sửa
                      </button>
                    )}
                  </div>
                </form>
                <div className="mt-3 divide-y divide-gray-100">
                  {wheelSlots.map((slot, index) => (
                    <div key={slot.id} className="py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            Ô {index + 1}: {slot.label}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {slot.isReward ? "Có thưởng" : "Không trúng thưởng"}
                          </p>
                        </div>
                        <span className="flex shrink-0 gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingWheelId(slot.id);
                              setEditingWheelLabel(slot.label);
                              setEditingWheelIsReward(slot.isReward);
                            }}
                            className="text-sm font-medium text-[#0068FF]"
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            disabled={wheelSlots.length <= 2}
                            onClick={() =>
                              setPendingDelete({ type: "wheel", id: slot.id })
                            }
                            className="text-sm font-medium text-red-600 disabled:text-gray-300"
                          >
                            Xóa
                          </button>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mb-5 rounded-2xl bg-white p-4 shadow-sm">
                <h2 className="font-semibold text-gray-900">
                  Cấu hình trò chơi xếp hình
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Cấp 1: ghép 3 × 3 trong 30 giây. Cấp 2: ghép 3 × 4 trong 45
                  giây và chỉ mở sau khi hoàn thành cấp 1.
                </p>
                <form onSubmit={savePuzzleConfig} className="mt-4 space-y-3">
                  <label className="block text-xs font-medium text-gray-600">
                    Thời gian chờ để chơi lại
                    <select
                      value={puzzleCooldown}
                      onChange={(event) =>
                        setPuzzleCooldown(Number(event.target.value))
                      }
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm text-gray-900 outline-none focus:border-[#0068FF]"
                    >
                      <option value={0}>Không khóa thời gian</option>
                      <option value={300}>5 phút</option>
                      <option value={600}>10 phút</option>
                      <option value={900}>15 phút</option>
                      <option value={1800}>30 phút</option>
                      <option value={3600}>1 giờ</option>
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-gray-600">
                    Ảnh mặc định
                    <select
                      value={puzzleSelectedImageId ?? ""}
                      onChange={(event) =>
                        setPuzzleSelectedImageId(
                          event.target.value ? Number(event.target.value) : null
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm text-gray-900 outline-none focus:border-[#0068FF]"
                      disabled={!puzzleConfig?.images.length}
                    >
                      <option value="">Ảnh mẫu ngẫu nhiên</option>
                      {puzzleConfig?.images.map((image) => (
                        <option key={image.id} value={image.id}>
                          {image.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="submit"
                    disabled={savingPuzzle || loading}
                    className="w-full rounded-xl bg-[#0068FF] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {savingPuzzle ? "Đang lưu..." : "Lưu cấu hình xếp hình"}
                  </button>
                </form>

                <form onSubmit={uploadPuzzleImage} className="mt-5 rounded-xl border border-gray-100 p-3">
                  <p className="text-sm font-semibold text-gray-800">Thêm ảnh mới</p>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handlePuzzleImage}
                    className="mt-2 block w-full text-xs text-gray-600"
                  />
                  {puzzleImageDataUrl && (
                    <img
                      src={puzzleImageDataUrl}
                      alt="Xem trước ảnh ghép hình"
                      className="mt-3 aspect-[3/4] w-full rounded-lg object-cover"
                    />
                  )}
                  <input
                    value={puzzleImageName}
                    onChange={(event) => setPuzzleImageName(event.target.value)}
                    maxLength={100}
                    placeholder="Tên ảnh"
                    className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#0068FF]"
                    required
                  />
                  <button
                    type="submit"
                    disabled={savingPuzzle || !puzzleImageDataUrl}
                    className="mt-3 w-full rounded-xl border border-[#0068FF] px-4 py-2 text-sm font-semibold text-[#0068FF] disabled:opacity-50"
                  >
                    Thêm ảnh
                  </button>
                </form>

                {puzzleConfig?.images.length ? (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {puzzleConfig.images.map((image) => (
                      <div key={image.id} className="overflow-hidden rounded-xl border border-gray-100">
                        <img
                          src={`${getApiBaseUrl()}${image.url}`}
                          alt={image.name}
                          className="aspect-[3/4] w-full object-cover"
                        />
                        <div className="p-2">
                          <p className="truncate text-xs font-medium text-gray-800">
                            {image.name}
                          </p>
                          <button
                            type="button"
                            disabled={savingPuzzle}
                            onClick={() => void deletePuzzleImage(image.id)}
                            className="mt-1 text-xs font-medium text-red-600 disabled:text-gray-300"
                          >
                            Xóa ảnh
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-gray-500">
                    Chưa có ảnh tùy chỉnh. Trò chơi đang dùng 4 ảnh mẫu có sẵn.
                  </p>
                )}
              </section>

              {pendingDelete && (
                <section
                  role="alertdialog"
                  aria-label="Xác nhận xóa"
                  className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4"
                >
                  <p className="text-sm text-red-800">
                    Xác nhận xóa{" "}
                    {pendingDelete.type === "interest"
                      ? "ngành quan tâm"
                      : "ô vòng quay"}
                    ? Dữ liệu ngành đã lưu ở hồ sơ học sinh sẽ được giữ nguyên.
                  </p>
                  <div className="mt-3 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setPendingDelete(null)}
                      className="text-sm text-gray-600"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={() => void confirmDelete()}
                      className="text-sm font-semibold text-red-700"
                    >
                      Xác nhận xóa
                    </button>
                  </div>
                </section>
              )}

              <button
                type="button"
                onClick={() => navigate(PATHS.WHEEL)}
                className="mb-5 flex w-full items-center justify-between rounded-2xl bg-[#EAF3FF] p-4 text-left"
              >
                <span>
                  <span className="block font-medium text-gray-900">
                    Xem vòng quay
                  </span>
                  <span className="text-xs text-gray-500">
                    Kiểm tra trải nghiệm trò chơi
                  </span>
                </span>
                <span aria-hidden="true" className="text-gray-400">
                  ›
                </span>
              </button>
                </div>
              )}

              {activeTab === "reports" && (
                <div
                  id="admin-panel-students"
                  role="tabpanel"
                  aria-labelledby="admin-tab-reports"
                >
              <section className="mb-5 overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="border-b border-gray-100 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="font-semibold text-gray-900">
                        Danh sách học sinh
                      </h2>
                      <p className="mt-1 text-sm text-gray-500">
                        {total.toLocaleString("vi-VN")} học sinh
                      </p>
                    </div>
                  </div>
                  <form onSubmit={handleSearch} className="mt-3 flex gap-2">
                    <input
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Tìm tên hoặc số điện thoại"
                      className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#0068FF]"
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="rounded-xl bg-[#EAF3FF] px-4 text-sm font-semibold text-[#0068FF]"
                    >
                      Tìm
                    </button>
                  </form>
                </div>

                {players.length ? (
                  <div className="divide-y divide-gray-100">
                    {players.map((player) => (
                      <article key={player.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate font-semibold text-gray-900">
                              {player.name}
                            </h3>
                            <a
                              className="mt-1 block text-sm text-[#0068FF]"
                              href={`tel:${player.phone}`}
                            >
                              {player.phone}
                            </a>
                          </div>
                          <time className="shrink-0 text-right text-xs text-gray-500">
                            Đăng ký
                            <br />
                            {formatDate(player.createdAt)}
                          </time>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                          <p className="col-span-2 break-all text-gray-600">
                            Email:{" "}
                            <a
                              className="text-[#0068FF]"
                              href={`mailto:${player.email}`}
                            >
                              {player.email}
                            </a>
                          </p>
                          <p className="col-span-2 text-gray-600">
                            Tỉnh/thành: {player.province || "Chưa cập nhật"}
                          </p>
                          <p className="col-span-2 text-gray-600">
                            Trường: {player.school || "Chưa cập nhật"}
                          </p>
                          <p className="col-span-2 text-gray-600">
                            OA:{" "}
                            {player.isFollowingOa
                              ? "Đã xác minh quan tâm"
                              : "Chưa xác minh"}
                          </p>
                          <p className="text-gray-600">
                            Lượt chơi:{" "}
                            <strong className="text-gray-900">
                              {player.spinCount}
                            </strong>
                          </p>
                          <p className="text-gray-600">
                            Giải thưởng:{" "}
                            <strong className="text-gray-900">
                              {player.rewardCount}
                            </strong>
                          </p>
                          <p className="col-span-2 text-gray-600">
                            Phần thưởng gần nhất:{" "}
                            <strong className="text-gray-900">
                              {player.latestReward || "Chưa trúng"}
                            </strong>
                          </p>
                          <p className="col-span-2 text-xs text-gray-500">
                            Lần chơi gần nhất: {formatDate(player.lastPlayedAt)}
                          </p>
                          <p className="col-span-2 text-xs text-gray-500">
                            Ngành quan tâm:{" "}
                            {player.major || player.interest || "Chưa cập nhật"}
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="px-4 py-8 text-center text-sm text-gray-500">
                    {loading
                      ? "Đang tải học sinh..."
                      : "Không tìm thấy học sinh."}
                  </p>
                )}
                <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm">
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() => void loadAdminData(token, page - 1, query)}
                    className="font-medium text-[#0068FF] disabled:text-gray-300"
                  >
                    Trang trước
                  </button>
                  <span className="text-gray-500">Trang {page}</span>
                  <button
                    type="button"
                    disabled={page * 20 >= total || loading}
                    onClick={() => void loadAdminData(token, page + 1, query)}
                    className="font-medium text-[#0068FF] disabled:text-gray-300"
                  >
                    Trang sau
                  </button>
                </div>
              </section>
                </div>
              )}

              <p className="mt-4 px-2 text-center text-xs leading-5 text-gray-500">
                Chỉ chia sẻ mã quản trị với người được phép xem dữ liệu tuyển
                sinh. Dùng HTTPS khi triển khai công khai.
              </p>
            </>
          )}
        </main>
      </div>
    </Page>
  );
}
