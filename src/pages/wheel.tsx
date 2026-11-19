import SlotMachine from "@/components/slot-machine";
import { PATHS } from "@/constants/path";
import { profileApi } from "@/services/api";
import { useEffect } from "react";
import { Page, useNavigate } from "zmp-ui";

export default function WheelPage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!profileApi.hasRegistration()) {
      navigate(PATHS.HOME, { replace: true });
    }
  }, []);

  return (
    <Page
      hideScrollbar
      className="relative overflow-y-scroll overflow-x-hidden bg-gradient-to-b from-[#EAF3FF] to-white pb-24"
    >
      <main className="relative mx-auto max-w-lg px-4 pb-8">
        <button
          type="button"
          aria-label="Quay lại trang chủ"
          className="mt-10 flex h-11 w-11 items-center justify-start text-[#0068FF]"
          onClick={() => navigate(PATHS.HOME)}
        >
          <svg
            aria-hidden="true"
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="m15 18-6-6 6-6"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
            />
          </svg>
        </button>
        <TitleSection />
        <SlotMachine />
        <RuleNoteSection />
      </main>
    </Page>
  );
}

function TitleSection() {
  return (
    <header className="flex flex-col items-center pt-10 text-center">
      <div className="font-black italic text-xl text-[#0068FF]">CUSC</div>
      <h1 className="mt-1 text-3xl font-black text-[#0755B8]">
        VÒNG QUAY MAY MẮN
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        Chạm để quay và khám phá phần quà của bạn
      </p>
    </header>
  );
}

function RuleNoteSection() {
  return (
    <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="font-bold text-[#0755B8]">Thể lệ tham gia</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-5 text-gray-600">
        <li>
          Vòng quay có các ô được đánh số theo thứ tự và chia xác suất ngang
          nhau.
        </li>
        <li>Kết quả được máy chủ xác định và lưu sau mỗi lượt quay.</li>
        <li>Thông tin phần thưởng do quản trị viên cấu hình.</li>
      </ul>
    </section>
  );
}
