import Background from "@/components/background";
import Header from "@/components/header";
import VoucherCard from "@/components/voucher-card";
import VoucherRibbonImg from "@/static/voucher-ribbon.png";
import { RECRUITMENT_OA_URL_KEY } from "@/services/api";
import { openRecruitmentOa } from "@/services/oa";
import { useState } from "react";
import { Button, Page, useSnackbar } from "zmp-ui";

export default function VoucherPage() {
  const [rewardName] = useState(
    () => sessionStorage.getItem("zaui-lucky-wheel-latest-prize") || "Voucher may mắn"
  );
  const [recruitmentOaUrl] = useState(
    () => localStorage.getItem(RECRUITMENT_OA_URL_KEY)
  );
  const { openSnackbar } = useSnackbar();

  return (
    <Page
      hideScrollbar
      className="relative overflow-y-scroll overflow-x-hidden bg-layer-layer_background_subtle pb-24"
    >
      <Background />
      <img
        src={VoucherRibbonImg}
        alt=""
        className="absolute top-0 h-full object-cover opacity-50"
      />
      <div className="relative">
        <Header />
        <div className="mx-4 flex items-center flex-col justify-center h-full mt-20 relative z-10">
          <div className="flex flex-col gap-4 items-center mb-8">
            <div className="text-xlarge_b">CHÚC MỪNG!!</div>
            <div className="text-small whitespace-pre-line text-center">
              Bạn đã nhận được {rewardName}
            </div>
          </div>

          <VoucherCard title={rewardName} />

          <div className="flex flex-col gap-4 items-center mt-10">
            <div className="text-xlarge_b">{rewardName}</div>
            <div className="text-small whitespace-pre-line text-center">
              Phần thưởng đã được ghi nhận trong hệ thống. Vui lòng liên hệ đơn
              vị tổ chức để biết cách nhận và sử dụng.
            </div>
          </div>
          <Button
            htmlType="submit"
            className="!bg-button-primary text-white text-normal_m my-16"
            fullWidth
            disabled={!recruitmentOaUrl}
            onClick={async () => {
              if (!recruitmentOaUrl) return;
              try {
                await openRecruitmentOa(recruitmentOaUrl);
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
              }
            }}
          >
            QUAN TÂM OA CUSC
          </Button>
        </div>
        <div className="absolute inset-x-0 -bottom-16 h-full bg-white rounded-full blur-3xl z-0"></div>
      </div>
    </Page>
  );
}
