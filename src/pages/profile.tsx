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

export default function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [rewards, setRewards] = useState<RewardRecord[]>([]);
  const [loadingRewards, setLoadingRewards] = useState(true);
  const [rewardsError, setRewardsError] = useState("");
  const [rewardsRetry, setRewardsRetry] = useState(0);

  useEffect(() => {
    try {
      setProfile(profileApi.get());
    } catch (error) {
      console.error("Could not read the saved student profile:", error);
    }
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
        <main className="mx-4 mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <h1 className="text-xlarge_b text-text-primary">Thông tin cá nhân</h1>
          {profile ? (
            <dl className="mt-4 divide-y divide-gray-100">
              {[
                ["Họ và tên", profile.name],
                ["Số điện thoại", profile.phone],
                ["Email", profile.email],
                ["Tỉnh/thành", profile.province],
                ["Trường", profile.school],
                ["Ngành quan tâm", profile.major],
              ].map(([label, value]) => (
                <div key={label} className="py-3">
                  <dt className="text-small text-gray-500">{label}</dt>
                  <dd className="mt-1 break-words text-normal_m text-gray-900">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="mt-4">
              <p className="text-small text-gray-600">
                Bạn chưa đăng ký trên thiết bị này.
              </p>
              <Button
                className="mt-4 !bg-button-primary !text-white"
                onClick={() => navigate(PATHS.HOME)}
              >
                Đăng ký ngay
              </Button>
            </div>
          )}
        </main>
        {profile && (
          <section className="mx-4 mt-4 rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              Phần thưởng đã nhận
            </h2>
            {loadingRewards ? (
              <p className="mt-3 text-sm text-gray-500">
                Đang tải danh sách phần thưởng...
              </p>
            ) : rewardsError ? (
              <div className="mt-3 text-sm text-red-700">
                <p role="alert">{rewardsError}</p>
                <button
                  type="button"
                  onClick={() => setRewardsRetry((value) => value + 1)}
                  className="mt-2 font-semibold underline"
                >
                  Thử tải lại
                </button>
              </div>
            ) : rewards.length ? (
              <ul className="mt-2 divide-y divide-gray-100">
                {rewards.map((item) => (
                  <li key={item.id} className="py-3">
                    <p className="font-semibold text-[#0068FF]">{item.reward}</p>
                    <p className="mt-1 text-sm text-gray-700">
                      {item.gameName}
                    </p>
                    {item.receivedAt && (
                      <p className="mt-1 text-xs text-gray-500">
                        {formatRewardDate(item.receivedAt)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-gray-500">
                Bạn chưa nhận được phần thưởng nào.
              </p>
            )}
          </section>
        )}
      </div>
    </Page>
  );
}
