import Background from "@/components/background";
import Header from "@/components/header";
import { PATHS } from "@/constants/path";
import {
  profileApi,
  type RewardRecord,
  type StudentProfile,
} from "@/services/api";
import { useEffect, useState } from "react";
import { Button, Page, useNavigate } from "zmp-ui";

function formatRewardDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function ProfileIcon({
  name,
  className = "h-5 w-5",
}: {
  name: "phone" | "mail" | "location" | "school" | "book" | "gift" | "logout";
  className?: string;
}) {
  const paths = {
    phone: "M8 3H5a2 2 0 0 0-2 2c0 7.732 6.268 14 14 14a2 2 0 0 0 2-2v-3l-4-1-1.5 2.5a12 12 0 0 1-6-6L10 8z",
    mail: "M3 5h18v14H3zM3 7l9 7 9-7",
    location: "M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    school: "M2 9l10-5 10 5-10 5zM6 11v5c3 3 9 3 12 0v-5M22 9v7",
    book: "M4 5a3 3 0 0 1 3-3h5v16H7a3 3 0 0 0-3 3zm16 0a3 3 0 0 0-3-3h-5v16h5a3 3 0 0 1 3 3z",
    gift: "M20 12v9H4v-9M2 7h20v5H2zm10 0v14M12 7H7.5a2.5 2.5 0 1 1 2.5-2.5C10 6 12 7 12 7zm0 0h4.5A2.5 2.5 0 1 0 14 4.5C14 6 12 7 12 7z",
    logout: "M10 4H4v16h6M14 8l4 4-4 4M18 12H8",
  }[name];

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d={paths} />
    </svg>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [rewards, setRewards] = useState<RewardRecord[]>([]);
  const [loadingRewards, setLoadingRewards] = useState(true);
  const [rewardsError, setRewardsError] = useState("");
  const [rewardsRetry, setRewardsRetry] = useState(0);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    profileApi.clearRegistration();
    setProfile(null);
    setRewards([]);
    setShowLogoutConfirm(false);
    navigate(PATHS.HOME);
  };

  const initials = profile?.name
    ? profile.name
        .trim()
        .split(/\s+/)
        .slice(-2)
        .map((part) => part.charAt(0))
        .join("")
        .toUpperCase()
    : "HS";

  useEffect(() => {
    try {
      setProfile(profileApi.get());
    } catch (error) {
      console.error("Could not read the saved student profile:", error);
    }
  }, []);

  useEffect(() => {
    let active = true;
    profileApi
      .refresh()
      .then((freshProfile) => {
        if (active && freshProfile) setProfile(freshProfile);
      })
      .catch((error) => {
        console.error("Could not refresh the saved student profile:", error);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!profile) {
      setRewards([]);
      setRewardsError("");
      setLoadingRewards(false);
      return;
    }

    let active = true;
    setLoadingRewards(true);
    setRewardsError("");
    profileApi
      .rewards()
      .then((result) => {
        if (active) setRewards(result);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setRewardsError(
          error instanceof Error
            ? error.message
            : "Không thể tải phần thưởng đã nhận."
        );
      })
      .finally(() => {
        if (active) setLoadingRewards(false);
      });

    return () => {
      active = false;
    };
  }, [profile, rewardsRetry]);

  return (
    <Page
      hideScrollbar
      className="relative overflow-y-scroll overflow-x-hidden bg-layer-layer_background_subtle pb-24"
    >
      <Background />
      <div className="relative">
        <Header />
        <main className="mx-4 space-y-4">
          {profile ? (
            <>
              <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0068FF] to-[#2F80ED] px-5 pb-5 pt-6 text-white shadow-lg">
                <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/10" />
                <div className="relative flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-white/30 bg-white text-xl font-bold text-[#0068FF] shadow-md">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-blue-100">Hồ sơ cá nhân</p>
                    <h1 className="mt-1 break-words text-xl font-bold">{profile.name}</h1>
                    <p className="mt-1 text-sm text-blue-50">{profile.school}</p>
                  </div>
                </div>
              </section>

              <section className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#0068FF]">
                    <ProfileIcon name="gift" />
                  </div>
                  <p className="mt-3 text-2xl font-bold text-gray-900">{rewards.length}</p>
                  <p className="mt-0.5 text-xs text-gray-500">Phần thưởng</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                    <ProfileIcon name="school" />
                  </div>
                  <p className="mt-3 truncate text-sm font-bold text-gray-900">{profile.major}</p>
                  <p className="mt-0.5 text-xs text-gray-500">Ngành quan tâm</p>
                </div>
              </section>

              <section className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-bold text-gray-900">Thông tin liên hệ</h2>
                  <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">Đã đăng ký</span>
                </div>
                <dl className="divide-y divide-gray-100">
                  {[
                    ["phone", "Số điện thoại", profile.phone],
                    ["mail", "Email", profile.email],
                    ["location", "Tỉnh/thành", profile.province || "Chưa cập nhật"],
                    ["school", "Trường", profile.school],
                    ["book", "Ngành quan tâm", profile.major],
                  ].map(([icon, label, value]) => (
                    <div key={label} className="flex items-start gap-3 py-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500">
                        <ProfileIcon name={icon as "phone" | "mail" | "location" | "school" | "book"} className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs text-gray-500">{label}</dt>
                        <dd className="mt-0.5 break-words text-sm font-medium text-gray-900">{value}</dd>
                      </div>
                    </div>
                  ))}
                </dl>
              </section>

              <section className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-gray-900">Phần thưởng đã nhận</h2>
                  {rewards.length > 0 && (
                    <span className="rounded-full bg-[#EAF2FF] px-2.5 py-1 text-xs font-bold text-[#0068FF]">{rewards.length}</span>
                  )}
                </div>
                {loadingRewards ? (
                  <p className="mt-4 text-sm text-gray-500">Đang tải danh sách...</p>
                ) : rewardsError ? (
                  <div className="mt-4 text-sm text-red-700">
                    <p role="alert">{rewardsError}</p>
                    <button type="button" onClick={() => setRewardsRetry((value) => value + 1)} className="mt-2 font-semibold underline">
                      Thử tải lại
                    </button>
                  </div>
                ) : rewards.length ? (
                  <ul className="mt-2 divide-y divide-gray-100">
                    {rewards.map((item) => (
                      <li key={item.id} className="flex gap-3 py-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                          <ProfileIcon name="gift" className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[#0068FF]">{item.reward}</p>
                          <p className="mt-0.5 text-sm text-gray-700">{item.gameName}</p>
                          {item.receivedAt && (
                            <p className="mt-1 text-xs text-gray-500">{formatRewardDate(item.receivedAt)}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-4 rounded-xl bg-gray-50 px-4 py-5 text-center">
                    <p className="text-sm text-gray-500">Bạn chưa nhận được phần thưởng nào.</p>
                  </div>
                )}
              </section>

              <Button
                className="!h-12 w-full !rounded-xl !border !border-red-200 !bg-red-50 !text-red-600"
                onClick={() => setShowLogoutConfirm(true)}
              >
                <span className="flex items-center justify-center gap-2">
                  <ProfileIcon name="logout" className="h-5 w-5" />
                  Đăng xuất
                </span>
              </Button>
            </>
          ) : (
            <section className="mt-2 rounded-3xl bg-white px-6 py-10 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-[#0068FF]">
                <ProfileIcon name="school" className="h-8 w-8" />
              </div>
              <h1 className="mt-4 text-lg font-bold text-gray-900">Chưa có hồ sơ cá nhân</h1>
              <p className="mx-auto mt-2 max-w-xs text-sm text-gray-500">
                Đăng ký để lưu thông tin và nhận phần thưởng từ các trò chơi.
              </p>
              <Button
                className="mt-5 w-full !rounded-xl !bg-button-primary !text-white"
                onClick={() => navigate(PATHS.HOME)}
              >
                Đăng ký ngay
              </Button>
            </section>
          )}
        </main>

        {showLogoutConfirm && (
          <div className="absolute inset-0 z-50 flex items-end bg-black/40 px-4 pb-24" role="dialog" aria-modal="true" aria-label="Xác nhận đăng xuất">
            <div className="w-full rounded-2xl bg-white p-5 shadow-xl">
              <h2 className="text-center text-lg font-bold text-gray-900">Đăng xuất tài khoản?</h2>
              <p className="mt-2 text-center text-sm text-gray-500">
                Thông tin đăng ký trên thiết bị này sẽ được xóa.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Button className="!h-11 !rounded-xl !border !border-gray-200 !bg-white !text-gray-700" onClick={() => setShowLogoutConfirm(false)}>
                  Hủy
                </Button>
                <Button className="!h-11 !rounded-xl !bg-red-500 !text-white" onClick={handleLogout}>
                  Đăng xuất
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}
