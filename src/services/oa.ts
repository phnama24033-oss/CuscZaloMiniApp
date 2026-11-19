import { openWebview } from "zmp-sdk/apis";

export async function openRecruitmentOa(url: string) {
  const parsedUrl = new URL(url);
  if (
    parsedUrl.protocol !== "https:" ||
    !["zalo.me", "oa.zalo.me"].includes(parsedUrl.hostname)
  ) {
    throw new Error("Đường dẫn OA CUSC chưa hợp lệ.");
  }

  if (!/zalo/i.test(navigator.userAgent)) {
    window.location.assign(parsedUrl.toString());
    return;
  }

  await openWebview({
    url: parsedUrl.toString(),
    config: { style: "normal" },
  });
}
