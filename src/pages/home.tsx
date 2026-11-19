import Background from "@/components/background";
import Header from "@/components/header";
import { Page, Swiper } from "zmp-ui";

import RegisterForm from "@/components/register-form";
import GamesPage from "@/pages/games";
import { profileApi } from "@/services/api";
import courseScheduleImg from "@/static/cusc-course-schedule.png";
import trainingBannerImg from "@/static/cusc-training-banner.png";
import { usePermissionStore } from "@/stores/permission";
import { useEffect } from "react";

export default function HomePage() {
  const { check: checkPermission } = usePermissionStore();

  useEffect(() => {
    checkPermission();
  }, []);

  if (profileApi.hasRegistration()) {
    return <GamesPage />;
  }

  return (
    <Page
      hideScrollbar
      className="relative overflow-y-scroll overflow-x-hidden bg-layer-layer_background_subtle pb-24"
    >
      <Background />
      <div className="relative">
        <Header />
        <div className="mx-4 flex flex-col gap-3">
          <Swiper autoplay loop className="overflow-hidden rounded-2xl">
            <Swiper.Slide>
              <img
                src={courseScheduleImg}
                alt="Lịch khai giảng các khóa học ngắn hạn tại CUSC"
                className="block h-auto w-full rounded-2xl"
              />
            </Swiper.Slide>
            <Swiper.Slide>
              <img
                src={trainingBannerImg}
                alt="Chương trình đào tạo lập trình và Arena Multimedia tại CUSC"
                className="block h-auto w-full rounded-2xl"
              />
            </Swiper.Slide>
          </Swiper>
        </div>
        <RegisterForm />
      </div>
    </Page>
  );
}
