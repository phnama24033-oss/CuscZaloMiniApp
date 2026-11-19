import { getAccessToken, getPhoneNumber, getUserInfo } from "zmp-sdk/apis";
import { apiRequest } from "@/services/api";

export const userService = {
  async getUserName() {
    return (await getUserInfo()).userInfo.name;
  },

  async getZaloUserId() {
    return (await getUserInfo()).userInfo.id;
  },

  // Zalo Mini App – Get Phone Number
  // Docs: https://miniapp.zaloplatforms.com/documents/api/getPhoneNumber/
  async getPhoneNumber() {
    const [accessToken, phoneCode] = await Promise.all([
      getAccessToken(),
      getPhoneNumber(),
    ]);
    if (!phoneCode.token) {
      throw new Error("Zalo không trả về mã xác minh số điện thoại.");
    }
    const result = await apiRequest<{ phone: string }>("/api/zalo/phone", {
      method: "POST",
      body: JSON.stringify({ accessToken, code: phoneCode.token }),
    });
    return result.phone.replace(/^\+84/, "0");
  },
};
