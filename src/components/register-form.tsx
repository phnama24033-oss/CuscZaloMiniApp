import { PATHS } from "@/constants/path";
import {
  registerSchema,
  registrationSchoolSchema,
  type TRegisterValues,
} from "@/schemas/register.schema";
import {
  playerApi,
  publicGameApi,
  isZaloTestMode,
  type InterestOption,
  type ProvinceOption,
  type SchoolOption,
} from "@/services/api";
import * as v from "valibot";
import { userService } from "@/services/user.services";
import { usePermissionStore } from "@/stores/permission";
import { useForm, useStore } from "@tanstack/react-form";
import { useEffect, useState } from "react";
import { Button, Input, Select, useNavigate, useSnackbar } from "zmp-ui";
import Divider from "./divider";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = error.message;
    if (typeof message === "string" && message.trim()) return message;
    if (Array.isArray(message)) {
      const messages = message.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0
      );
      if (messages.length) return messages.join(" ");
    }
  }
  return "Lỗi không xác định. Vui lòng thử lại.";
}

export default function RegisterForm() {
  const navigate = useNavigate();
  const { hasUserInfo, hasUserPhoneNumber, isRequested, request } =
    usePermissionStore();
  const { openSnackbar } = useSnackbar();
  const isLocalTestMode = isZaloTestMode();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [interests, setInterests] = useState<InterestOption[]>([]);
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [optionsError, setOptionsError] = useState("");
  const [schoolsError, setSchoolsError] = useState("");
  const [optionsRetry, setOptionsRetry] = useState(0);
  const [schoolsRetry, setSchoolsRetry] = useState(0);
  const [schoolInput, setSchoolInput] = useState("");
  const [selectedSchool, setSelectedSchool] = useState<SchoolOption | null>(
    null
  );
  const [isOtherSchool, setIsOtherSchool] = useState(false);
  const [showSchoolOptions, setShowSchoolOptions] = useState(false);
  const [schoolError, setSchoolError] = useState("");

  const form = useForm({
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      provinceId: 0,
      schoolId: null,
      schoolOther: "",
      majorId: 0,
      consent: false,
    } as TRegisterValues,
    validators: {
      onChange: registerSchema,
      onSubmit: registerSchema,
    },
    onSubmit: async ({ value }) => {
      const registration = {
        ...value,
        schoolId: isOtherSchool ? null : selectedSchool?.id ?? null,
        schoolOther: isOtherSchool ? value.schoolOther.trim() : "",
      };
      const parsed = v.safeParse(registrationSchoolSchema, registration);
      if (!parsed.success) {
        setSchoolError(
          parsed.issues[0]?.message ??
            "Hãy chọn trường hoặc nhập tên trường khác."
        );
        return;
      }

      setSchoolError("");
      setIsSubmitting(true);
      try {
        let zaloUserId: string;
        if (isLocalTestMode) {
          zaloUserId = `local-dev:${parsed.output.phone}`;
        } else {
          if (!usePermissionStore.getState().hasUserInfo) {
            await request();
            if (!usePermissionStore.getState().hasUserInfo) {
              throw new Error(
                "Vui lòng cấp quyền thông tin tài khoản Zalo để hoàn tất đăng ký."
              );
            }
          }
          zaloUserId = await userService.getZaloUserId();
        }
        await playerApi.register({ ...parsed.output, zaloUserId });
        navigate(PATHS.REWARD);
      } catch (error) {
        openSnackbar({
          icon: true,
          type: "error",
          text: `Không thể lưu thông tin đăng ký: ${getErrorMessage(error)}`,
          duration: 5000,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  const handleAutoFillRequest = async () => {
    if (isLocalTestMode) return;
    if (isRequested || (hasUserInfo && hasUserPhoneNumber)) return;
    document.activeElement instanceof HTMLElement &&
      document.activeElement.blur();
    await request();
  };

  useEffect(() => {
    let active = true;
    setLoadingOptions(true);
    setOptionsError("");
    (async () => {
      try {
        const [nextInterests, nextProvinces] = await Promise.all([
          publicGameApi.interests(),
          publicGameApi.provinces(),
        ]);
        if (!active) return;
        setInterests(nextInterests);
        setProvinces(nextProvinces);
      } catch (error) {
        if (!active) return;
        setOptionsError(
          error instanceof Error
            ? error.message
            : "Không thể kết nối để tải danh mục."
        );
        openSnackbar({
          icon: true,
          type: "error",
          text:
            error instanceof Error
              ? error.message
              : "Không thể tải danh sách tỉnh và ngành học.",
          duration: 5000,
        });
      } finally {
        if (active) setLoadingOptions(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [optionsRetry]);

  const provinceId = useStore(form.store, (state) => state.values.provinceId);
  useEffect(() => {
    if (provinceId < 1) {
      setSchools([]);
      setSchoolsError("");
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      (async () => {
        setLoadingSchools(true);
        setSchoolsError("");
        try {
          const options = await publicGameApi.schools(
            provinceId,
            schoolInput.trim()
          );
          if (active) setSchools(options);
        } catch (error) {
          if (!active) return;
          setSchoolsError(
            error instanceof Error
              ? error.message
              : "Không thể tải danh sách trường."
          );
          openSnackbar({
            icon: true,
            type: "error",
            text:
              error instanceof Error
                ? error.message
                : "Không thể tải danh sách trường.",
            duration: 5000,
          });
        } finally {
          if (active) setLoadingSchools(false);
        }
      })();
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [provinceId, schoolInput, schoolsRetry]);

  useEffect(() => {
    if (!hasUserPhoneNumber) return;
    userService
      .getPhoneNumber()
      .then((phone) => form.setFieldValue("phone", phone))
      .catch((error: unknown) => {
        openSnackbar({
          icon: true,
          type: "warning",
          text:
            error instanceof Error
              ? `${error.message} Bạn có thể nhập số điện thoại thủ công.`
              : "Không thể tự điền số điện thoại. Vui lòng nhập thủ công.",
          duration: 5000,
        });
      });
  }, [hasUserPhoneNumber]);

  useEffect(() => {
    if (!hasUserInfo) return;
    userService
      .getUserName()
      .then((name) => form.setFieldValue("name", name))
      .catch((error: unknown) => {
        openSnackbar({
          icon: true,
          type: "warning",
          text:
            error instanceof Error
              ? `Không thể lấy tên từ Zalo: ${error.message}`
              : "Không thể lấy tên từ Zalo. Bạn có thể nhập thủ công.",
          duration: 5000,
        });
      });
  }, [hasUserInfo]);

  const renderError = (errors: Array<{ message?: string } | undefined>) => {
    if (!showValidationErrors) return null;
    const messages = errors.map((error) => error?.message).filter(Boolean);
    if (messages.length === 0) return null;
    return (
      <p className="text-small text-text-dangerous">{messages.join(", ")}</p>
    );
  };

  const renderRequiredLabel = (label: string) => (
    <div className="text-small">
      {label} <span className="text-text-dangerous">*</span>
    </div>
  );

  const selectProvince = (
    value?: string | number | Array<string | number>
  ) => {
    if (typeof value !== "string" && typeof value !== "number") return;
    const nextProvinceId = Number(value);
    if (!Number.isSafeInteger(nextProvinceId) || nextProvinceId < 1) return;

    form.setFieldValue("provinceId", nextProvinceId);
    setSchoolInput("");
    setSelectedSchool(null);
    setSchools([]);
    setShowSchoolOptions(false);
    setIsOtherSchool(false);
    form.setFieldValue("schoolId", null);
    form.setFieldValue("schoolOther", "");
    setSchoolError("");
  };

  const selectSchool = (school: SchoolOption) => {
    setSelectedSchool(school);
    setSchoolInput(school.displayName);
    setIsOtherSchool(false);
    setShowSchoolOptions(false);
    form.setFieldValue("schoolId", school.id);
    form.setFieldValue("schoolOther", "");
    setSchoolError("");
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setShowValidationErrors(true);
        void form.handleSubmit();
      }}
      className="flex flex-col gap-2 p-4"
    >
      <section className="flex flex-col gap-3 rounded-lg bg-white p-4">
        <h2 className="text-sub_title text-text-primary">Thông tin cá nhân</h2>
        <Divider />
        <form.Field name="name">
          {(field) => (
            <div>
              <Input
                size="medium"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                label={renderRequiredLabel("Họ và tên")}
                onClick={() => void handleAutoFillRequest()}
              />
              {renderError(field.state.meta.errors)}
            </div>
          )}
        </form.Field>
        <form.Field name="phone">
          {(field) => (
            <div>
              <Input
                size="medium"
                type="text"
                inputMode="tel"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                label={renderRequiredLabel("Số điện thoại")}
                onClick={() => void handleAutoFillRequest()}
              />
              {renderError(field.state.meta.errors)}
            </div>
          )}
        </form.Field>
        <form.Field name="email">
          {(field) => (
            <div>
              <Input
                size="medium"
                type="text"
                inputMode="email"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                label={renderRequiredLabel("Email")}
              />
              {renderError(field.state.meta.errors)}
            </div>
          )}
        </form.Field>
        {optionsError && (
          <div
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-small text-text-dangerous"
          >
            <p>
              Không tải được danh mục tỉnh/ngành. Hãy kiểm tra API và kết nối
              MySQL rồi thử lại.
            </p>
            <button
              type="button"
              className="mt-2 font-semibold underline"
              onClick={() => setOptionsRetry((attempt) => attempt + 1)}
            >
              Thử tải lại
            </button>
          </div>
        )}
        <form.Field name="provinceId">
          {(field) => (
            <div>
              <Select
                value={field.state.value || ""}
                onChange={selectProvince}
                closeOnSelect
                label={renderRequiredLabel("Tỉnh/thành sau sáp nhập")}
                disabled={loadingOptions}
              >
                {provinces.map((province) => (
                  <Select.Option
                    key={province.id}
                    title={province.name}
                    value={province.id}
                  />
                ))}
              </Select>
              {renderError(field.state.meta.errors)}
              {!loadingOptions && !optionsError && provinces.length === 0 && (
                <p className="mt-1 text-small text-text-dangerous">
                  Chưa có tỉnh/thành trong cơ sở dữ liệu.
                </p>
              )}
            </div>
          )}
        </form.Field>
        <div className="relative">
          <Input
            size="medium"
            value={schoolInput}
            disabled={provinceId < 1 || isOtherSchool}
            onFocus={() => setShowSchoolOptions(true)}
            onChange={(event) => {
              const value = event.target.value;
              setSchoolInput(value);
              setSelectedSchool(null);
              setShowSchoolOptions(true);
              form.setFieldValue("schoolId", null);
              setSchoolError("");
            }}
            label={renderRequiredLabel("Trường")}
            placeholder={
              provinceId < 1 ? "Chọn tỉnh/thành trước" : "Gõ để tìm trường"
            }
          />
          {showSchoolOptions && provinceId > 0 && !isOtherSchool && (
            <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {loadingSchools && (
                <p className="px-3 py-2 text-small text-gray-500">
                  Đang tìm trường...
                </p>
              )}
              {!loadingSchools &&
                schools.map((school) => (
                  <button
                    key={school.id}
                    type="button"
                    className="block w-full px-3 py-2 text-left text-small hover:bg-blue-50"
                    onClick={() => selectSchool(school)}
                  >
                    {school.displayName}
                  </button>
                ))}
              {!loadingSchools && schools.length === 0 && (
                <p className="px-3 py-2 text-small text-gray-500">
                  {schoolsError
                    ? "Không tải được danh sách trường."
                    : "Không tìm thấy trường phù hợp."}
                </p>
              )}
            </div>
          )}
          {schoolsError && provinceId > 0 && !isOtherSchool && (
            <button
              type="button"
              className="mt-1 text-small font-semibold text-blue-700 underline"
              onClick={() => setSchoolsRetry((attempt) => attempt + 1)}
            >
              Thử tải danh sách trường lại
            </button>
          )}
          {provinceId > 0 && (
            <button
              type="button"
              className="mt-1 text-small text-blue-700"
              onClick={() => {
                if (isOtherSchool) {
                  setIsOtherSchool(false);
                  setSchoolInput("");
                  setShowSchoolOptions(true);
                  form.setFieldValue("schoolOther", "");
                  return;
                }
                const otherName = selectedSchool ? "" : schoolInput;
                setSelectedSchool(null);
                setSchoolInput(otherName);
                setIsOtherSchool(true);
                setShowSchoolOptions(false);
                form.setFieldValue("schoolId", null);
                form.setFieldValue("schoolOther", otherName);
              }}
            >
              {isOtherSchool
                ? "Quay lại chọn trường trong danh sách"
                : "Không thấy trường? Nhập tên trường"}
            </button>
          )}
          {isOtherSchool && (
            <form.Field name="schoolOther">
              {(field) => (
                <div className="mt-2">
                  <Input
                    size="medium"
                    value={field.state.value}
                    maxLength={150}
                    onChange={(event) =>
                      field.handleChange(event.target.value)
                    }
                    label={renderRequiredLabel("Tên trường")}
                  />
                  {renderError(field.state.meta.errors)}
                </div>
              )}
            </form.Field>
          )}
          {schoolError && (
            <p className="text-small text-text-dangerous">{schoolError}</p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-lg bg-white p-4">
        <h2 className="text-sub_title text-text-primary">Ngành quan tâm</h2>
        <Divider />
        <form.Field name="majorId">
          {(field) => (
            <div>
              <Select
                value={field.state.value || ""}
                onChange={(value) => field.handleChange(Number(value))}
                closeOnSelect
                label={renderRequiredLabel("Ngành bạn quan tâm")}
                disabled={loadingOptions || interests.length === 0}
              >
                {interests.map((interest) => (
                  <Select.Option
                    key={interest.id}
                    title={interest.name}
                    value={interest.id}
                  />
                ))}
              </Select>
              {loadingOptions && (
                <p className="mt-1 text-small text-gray-500">
                  Đang tải danh sách ngành...
                </p>
              )}
              {!loadingOptions && !optionsError && interests.length === 0 && (
                <p className="mt-1 text-small text-text-dangerous">
                  Chưa có ngành quan tâm khả dụng.
                </p>
              )}
              {renderError(field.state.meta.errors)}
            </div>
          )}
        </form.Field>
      </section>

      <section className="flex flex-col gap-3 rounded-lg bg-white p-4">
        <label className="flex items-start gap-2 text-small text-gray-700">
          <form.Field name="consent">
            {(field) => (
              <input
                className="mt-1"
                type="checkbox"
                checked={field.state.value}
                onChange={(event) => field.handleChange(event.target.checked)}
              />
            )}
          </form.Field>
          <span>
            Tôi đồng ý để đơn vị tuyển sinh lưu và sử dụng thông tin trên nhằm
            tư vấn tuyển sinh.
          </span>
        </label>
        <form.Field name="consent">
          {(field) => renderError(field.state.meta.errors)}
        </form.Field>
      </section>

      <Button
        htmlType="submit"
        disabled={isSubmitting || loadingOptions || interests.length === 0}
        className="!bg-button-primary !text-white text-normal_m"
      >
        {isSubmitting ? "Đang lưu..." : "Đăng ký"}
      </Button>
    </form>
  );
}
