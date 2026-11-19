import Background from "@/components/background";
import Header from "@/components/header";
import { PATHS } from "@/constants/path";
import { RECRUITMENT_OA_URL_KEY } from "@/services/api";
import rewardImg from "@/static/reward.png";
import { openRecruitmentOa } from "@/services/oa";
import { useState } from "react";
import { Button, Page, useNavigate, useSnackbar } from "zmp-ui";

const OA_RETURNED_KEY = "cusc-zalo-mini-app-oa-returned";

export default function RewardPage() {
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const [oaUrl] = useState(() =>
    localStorage.getItem(RECRUITMENT_OA_URL_KEY)
  );
  const [hasReturnedFromOa, setHasReturnedFromOa] = useState(
    () => sessionStorage.getItem(OA_RETURNED_KEY) === "1"
  );
  const [openingOa, setOpeningOa] = useState(false);

  const handleOpenOa = async () => {
    if (!oaUrl) return;
    setOpeningOa(true);
    try {
      await openRecruitmentOa(oaUrl);
      sessionStorage.setItem(OA_RETURNED_KEY, "1");
      setHasReturnedFromOa(true);
    } catch (error) {
      openSnackbar({
        icon: true,
        type: "error",
        text:
          error instanceof Error
            ? `Không mở được OA CUSC: ${error.message}`
            : "Không mở được OA CUSC. Vui lòng thử lại.",
        duration: 5000,
      });
    } finally {
      setOpeningOa(false);
    }
  };

  return (
    <Page
      hideScrollbar
      className="relative overflow-y-scroll overflow-x-hidden bg-layer-layer_background_subtle pb-24"
    >
      <Background />
      <div className="relative">
        <Header />
        <main className="mx-4 mt-12 flex flex-col items-center gap-4 text-center">
          <img src={rewardImg} alt="" />
          <h1 className="text-xlarge_b">Đăng ký thành công</h1>
          <p className="text-small">
            Hãy quan tâm OA tuyển sinh CUSC. Sau khi quay lại Mini App, bạn có
            thể vào menu trò chơi.
          </p>
          {oaUrl ? (
            <Button
              className="!bg-button-primary !text-white"
              fullWidth
              disabled={openingOa}
              onClick={() => void handleOpenOa()}
            >
              {openingOa
                ? "Đang mở OA..."
                : hasReturnedFromOa
                  ? "MỞ LẠI OA CUSC"
                  : "QUAN TÂM OA CUSC"}
            </Button>
          ) : (
            <p className="rounded-xl bg-amber-50 p-4 text-left text-small text-amber-900">
              OA tuyển sinh CUSC chưa được cấu hình. Đăng ký đã được lưu; vui
              lòng liên hệ quản trị viên để cập nhật OA.
            </p>
          )}
          {hasReturnedFromOa && (
            <Button
              className="!bg-button-primary !text-white"
              fullWidth
              onClick={() => navigate(PATHS.HOME)}
            >
              ĐẾN MENU MINI GAME
            </Button>
          )}
        </main>
      </div>
    </Page>
  );
}
