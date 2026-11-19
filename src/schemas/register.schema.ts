import * as v from "valibot";

export const registerSchema = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(2, "Tên cần có ít nhất 2 ký tự"),
    v.maxLength(100, "Tên không được vượt quá 100 ký tự")
  ),
  phone: v.pipe(
    v.string(),
    v.trim(),
    v.regex(/^(0|\+84)(3|5|7|8|9)\d{8}$/, "Số điện thoại không hợp lệ")
  ),
  email: v.pipe(
    v.string(),
    v.trim(),
    v.email("Email không hợp lệ"),
    v.maxLength(254, "Email không được vượt quá 254 ký tự")
  ),
  provinceId: v.pipe(
    v.number(),
    v.minValue(1, "Vui lòng chọn tỉnh/thành")
  ),
  schoolId: v.nullable(v.pipe(v.number(), v.minValue(1))),
  schoolOther: v.string(),
  majorId: v.pipe(
    v.number(),
    v.minValue(1, "Vui lòng chọn ngành quan tâm")
  ),
  consent: v.pipe(
    v.boolean(),
    v.check((value) => value, "Bạn cần đồng ý với việc sử dụng thông tin")
  ),
});

export type TRegisterValues = v.InferOutput<typeof registerSchema>;

export const registrationSchoolSchema = v.pipe(
  registerSchema,
  v.check(
    (value) =>
      (value.schoolId !== null && value.schoolOther.trim() === "") ||
      (value.schoolId === null &&
        value.schoolOther.trim().length >= 3 &&
        value.schoolOther.trim().length <= 150),
    "Hãy chọn trường trong danh sách hoặc nhập tên trường khác"
  )
);
