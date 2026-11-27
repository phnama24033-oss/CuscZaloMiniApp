# CUSC Zalo Mini App – Student Recruitment

CUSC Zalo Mini App là ứng dụng Mini App trên nền tảng Zalo được phát triển nhằm hỗ trợ các hoạt động tuyển sinh của Trung tâm Công nghệ Phần mềm Cần Thơ (CUSC). Ứng dụng cung cấp nền tảng tương tác trực tuyến giúp học sinh, sinh viên và những người quan tâm dễ dàng tìm hiểu thông tin tuyển sinh, đăng ký tư vấn và tiếp cận các chương trình đào tạo của CUSC.

Ứng dụng tích hợp các luồng nghiệp vụ chính: Landing Page giới thiệu chương trình tuyển sinh, Form đăng ký thông tin cá nhân, Mini Game tương tác nhằm thu hút người dùng, hệ thống quản lý thông tin đăng ký và tính năng kết nối Zalo Official Account (OA) để hỗ trợ tư vấn và chăm sóc người quan tâm.

# Demo

<video src="./docs/demo.mp4" controls preload="metadata" width="540">
  Your browser does not support video playback.
</video>

## Tính năng chính

- **Landing Page tuyển sinh**: Giới thiệu CUSC, các chương trình đào tạo, thông tin ngành học, hình ảnh hoạt động và các nội dung liên quan đến tuyển sinh.
- **Form đăng ký thông tin**: Cho phép người dùng đăng ký thông tin cá nhân như họ tên, số điện thoại, email, ngành học quan tâm và nhu cầu tư vấn.
- **Xin quyền & Tự động điền (Prefill)**: Hỗ trợ xin quyền truy cập thông tin người dùng và số điện thoại Zalo để tự động điền vào biểu mẫu đăng ký, giúp đơn giản hóa quá trình cung cấp thông tin.
- **Mini Game tương tác (Vòng quay may mắn)**: Tích hợp trò chơi vòng quay may mắn nhằm tạo sự hứng thú, tăng mức độ tương tác và thu hút người dùng tham gia các chiến dịch tuyển sinh.
- **Mini Game tương tác (Ghép hình)**: Tích hợp trò chơi ghép nhằm tạo sự hứng thú, tăng mức độ tương tác và thu hút người dùng tham gia các chiến dịch tuyển sinh.
- **Quản lý thông tin đăng ký**: Lưu trữ thông tin người quan tâm, hỗ trợ quản trị viên theo dõi danh sách đăng ký, thống kê dữ liệu và xuất báo cáo Excel phục vụ công tác tuyển sinh.
- **Kết nối Zalo OA**: Tích hợp tính năng quan tâm Official Account giúp người dùng dễ dàng kết nối với CUSC để nhận thông tin tuyển sinh, chương trình đào tạo và hỗ trợ tư vấn.

## Tech stack

<p style="display: flex; flex-wrap: wrap; gap: 4px;">
  <img alt="react" src="https://img.shields.io/badge/React-%5E18.3.1-61dafb?logo=react&logoColor=white" />
  <img alt="vite" src="https://img.shields.io/badge/Vite-%5E5.2.13-646cff?logo=vite&logoColor=white" />
  <img alt="zmp-ui" src="https://img.shields.io/badge/ZMP%20UI-latest-1f6fff?logo=zalando&logoColor=white" />
  <img alt="zmp-sdk" src="https://img.shields.io/badge/ZMP%20SDK-latest-0a84ff?logo=android&logoColor=white" />
  <img alt="tailwindcss" src="https://img.shields.io/badge/Tailwind%20CSS-%5E3.4.3-38bdf8?logo=tailwindcss&logoColor=white" />
  <img alt="tanstack-react-form" src="https://img.shields.io/badge/TanStack%20React%20Form-%5E1.27.7-f97316?logo=reacthookform&logoColor=white" />
  <img alt="valibot" src="https://img.shields.io/badge/Valibot-%5E1.2.0-0ea5e9?logo=vercel&logoColor=white" />
  <img alt="zustand" src="https://img.shields.io/badge/Zustand-%5E5.0.9-3b3b3b?logo=zustand&logoColor=white" />
  <img alt="nodejs" src="https://img.shields.io/badge/Node.js-22.x-339933?logo=nodedotjs&logoColor=white" />
</p>

Dự án sử dụng các công nghệ:

- **Core**: React, ZMP SDK, ZMP UI.
- **Form & Validation**: TanStack React Form kết hợp Valibot để xử lý và kiểm tra dữ liệu đăng ký.
- **State Management**: Zustand để quản lý trạng thái và thông tin người dùng.
- **Styling**: TailwindCSS.
- **Build Tool**: Vite 5.x.
- **Backend**: Node.js để xây dựng API, xử lý dữ liệu đăng ký và quản lý thông tin người quan tâm.
- **Database**: MySQL 8.0.16+ theo schema tuyển sinh, có khóa ngoại và ràng buộc dữ liệu.

## Hướng dẫn cài đặt và sử dụng

### Backend lưu thông tin đăng ký

Backend sử dụng Node.js `22.9` trở lên và MySQL `8.0.16` trở lên. API không tự tạo bảng; cần nạp schema và dữ liệu nền trước khi chạy.

1. Chạy lần lượt file `01_schema.sql`, `02_seed_data.sql` bạn cung cấp, sau đó chạy các migration `server/migrations/001_school_oa_url.sql`, `server/migrations/002_recruitment_oa_setting.sql`, `server/migrations/003_puzzle_game.sql` và `server/migrations/004_puzzle_replay_cooldown.sql`. Migration thứ hai tạo cấu hình OA dùng chung và khởi tạo OA CUSC; migration thứ ba tạo bảng lưu lượt chơi xếp hình; migration thứ tư cho phép lưu nhiều lượt chơi để áp dụng thời gian chờ chơi lại 10 phút. Chạy các migration theo thứ tự trên mỗi database.

2. Sao chép các biến cần thiết trong `.env.example` vào `.env` (nếu `.env` đã có thì chỉ bổ sung biến, không ghi đè các thiết lập Mini App hiện có). Cấu hình `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` và `DB_NAME` để trỏ đến MySQL.

3. Tạo mật khẩu quản trị dài ít nhất 8 ký tự. Nên dùng mật khẩu dài và khó đoán để bảo vệ dữ liệu người đăng ký:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Gán mật khẩu vào `API_ADMIN_TOKEN` trong `.env`. Không đưa mật khẩu vào code `VITE_*`, Git hoặc chia sẻ với người dùng.

4. Đặt `VITE_API_BASE_URL` thành địa chỉ backend mà Mini App có thể truy cập. `CORS_ORIGINS=*` cho phép trình duyệt từ mọi origin gọi API; để giới hạn, hãy liệt kê origin cách nhau bằng dấu phẩy. CORS chỉ điều khiển trình duyệt, không mở quyền truy cập trực tiếp MySQL; API quản trị vẫn cần `API_ADMIN_TOKEN`. Khi thử nghiệm trên điện thoại, không sử dụng `localhost`; cần một địa chỉ HTTPS có thể truy cập từ thiết bị.

5. Chạy API:

   ```bash
   npm run api
   ```

   Chạy Mini App trong một terminal khác bằng lệnh `npm run start`. Khởi động lại API sau khi cập nhật `server/index.cjs` và khởi động lại Vite sau khi thay đổi biến `VITE_*`.

API lưu hồ sơ học sinh và lịch sử mini game vào MySQL. Bảng `students` ràng buộc duy nhất cả `zalo_user_id` và `phone`; khóa ngoại kép bảo đảm trường thuộc đúng tỉnh đã chọn. Email được chuẩn hóa chữ thường, hồ sơ mới yêu cầu đồng ý thu thập dữ liệu. Admin mở tab **Quản trị**, nhập mật khẩu đã cấu hình trong `API_ADMIN_TOKEN` để xem thống kê, danh sách và xuất Excel.

Khi chạy development trên `localhost`, form dùng ID `local-dev:<số điện thoại>` để kiểm thử ghi dữ liệu mà không cần đăng nhập Zalo; các API local được gọi tại `http://127.0.0.1:3001`. Để kiểm thử trên Mini App của điện thoại, bật `VITE_ALLOW_ZALO_TEST_MODE=true` ở frontend và `ALLOW_ZALO_TEST_REGISTRATIONS=true` ở API, đồng thời dùng một API HTTPS mà điện thoại truy cập được. Khi cờ API này bật, ID test được chấp nhận từ mọi origin; chỉ bật cho môi trường kiểm thử vì hồ sơ không được xác thực bằng Zalo. Khởi động lại frontend/backend sau khi đổi cấu hình. Hãy dùng dữ liệu/số điện thoại thử vì các hồ sơ này vẫn được ghi vào bảng `students` và số điện thoại bị ràng buộc duy nhất. Tắt hai cờ sau khi kiểm thử; luồng Mini App thực tế vẫn yêu cầu App ID đã kích hoạt và quyền `scope.userInfo`.

Dữ liệu SQLite cũ (nếu có) không bị xóa nhưng cũng không được tự động chuyển sang schema mới, vì hồ sơ mới cần thêm email, tỉnh, trường, ngành và Zalo ID. Cần lập quy tắc ánh xạ các trường này trước khi nhập dữ liệu cũ vào MySQL.

Các chức năng quản trị hỗ trợ theo dõi dữ liệu tuyển sinh, quản lý danh sách người đăng ký và xuất báo cáo Excel phục vụ công tác thống kê, phân loại và chăm sóc người quan tâm.

Báo cáo Excel có các sheet **Tổng kết**, **Học sinh** và **Lượt chơi**, hỗ trợ lọc theo ngày đăng ký. Khi xuất Excel trong Zalo trên điện thoại, chủ Mini App cần bật quyền API `downloadFile` cho đúng Mini App ID trong trang Quản lý ứng dụng Zalo rồi tải lại Mini App. Đây là quyền cấu hình trong trang quản lý, không thể tự cấp từ giao diện hoặc `app-config.json`.

### Cấu hình OA tuyển sinh CUSC

Đăng nhập tab **Quản trị** và lưu đường dẫn OA tuyển sinh CUSC tại mục **OA tuyển sinh CUSC**. Mặc định là `https://zalo.me/149986668034000433`; OA chung này được sử dụng sau khi học sinh đăng ký, không phụ thuộc trường THPT mà học sinh chọn. Trường `schools.oa_url` không được dùng trong luồng này.

Chỉ URL HTTPS thuộc `zalo.me` hoặc `oa.zalo.me` được chấp nhận. Luồng hiện tại chỉ mở OA và cho tiếp tục khi Mini App nhận lại quyền điều khiển; nó **không xác minh** trạng thái Quan tâm và không cập nhật `students.is_following_oa`. Muốn xác minh thật cần tích hợp sự kiện/webhook OA ở backend.

Trước khi phát hành, cần triển khai HTTPS, giới hạn `CORS_ORIGINS`, bảo vệ thông tin kết nối MySQL và thay cơ chế mật khẩu admin dùng chung bằng đăng nhập quản trị phù hợp.

### Sử dụng Zalo Mini App Extension

1. Cài đặt [Visual Studio Code](https://code.visualstudio.com/download) và [Zalo Mini App Extension](https://mini.zalo.me/docs/dev-tools).
2. Nhấp vào **Create Project** hoặc mở thư mục dự án CUSC hiện có trong **Zalo Mini App Extension**.
3. Cấu hình **App ID** và **Install Dependencies**, sau đó vào bảng **Run** > chọn **Start** để bắt đầu phát triển 🚀

### Sử dụng Zalo Mini App CLI

1. [Cài đặt Node JS](https://nodejs.org/en/download/).
2. [Cài đặt Mini App DevTools CLI](https://mini.zalo.me/docs/dev-tools/cli/intro/).
3. Tải xuống hoặc clone repository này.
4. Cài đặt thư viện:

   ```bash
   npm install
   ```

5. Chạy dev server:

   ```bash
   zmp start
   ```

6. Mở `localhost:3000` trên trình duyệt 🔥

## Triển khai (Deployment)

1. Tạo Mini App ID mới (Tham khảo [Hướng dẫn tạo Mini App](https://mini.zalo.me/tutorial/coffee-shop)).

2. Triển khai code lên Zalo bằng ID vừa tạo.

   Nếu dùng `zmp-cli`:

   ```bash
   zmp login
   zmp deploy
   ```

3. Quét mã QR bằng Zalo để xem trước phiên bản đã deploy.

## Cấu trúc & Tùy biến (Usage)

Ứng dụng cung cấp giao diện và logic mẫu phục vụ chiến dịch tuyển sinh của CUSC. Hệ thống được xây dựng nhằm hỗ trợ người dùng tiếp cận thông tin đào tạo, đăng ký tư vấn và tham gia các hoạt động tương tác trực tuyến.

Các luồng chính:

- **`src/pages/home.tsx`**: Trang chủ (Landing Page) giới thiệu chương trình tuyển sinh, banner, thông tin CUSC, yêu cầu quyền truy cập và Form đăng ký.
- **`src/pages/reward.tsx`**: Màn hình mở OA tuyển sinh CUSC sau khi đăng ký và tiếp tục đến menu Mini Game.
- **`src/pages/games.tsx`**: Menu các game đang bật trong bảng `games`.
- **`src/pages/profile.tsx`**: Hồ sơ vừa đăng ký trong phiên Mini App hiện tại.
- **`src/pages/wheel.tsx`**: Màn hình vòng quay may mắn, hỗ trợ hoạt động tương tác trong các chiến dịch tuyển sinh.
- **`src/pages/voucher.tsx`**: Màn hình hiển thị kết quả trúng thưởng.
- **`src/services`**: Các hàm tiện ích để xin quyền và lấy thông tin User/SĐT từ Zalo, đồng thời hỗ trợ giao tiếp với Backend API.
- **`stores`**: Quản lý state xin quyền, thông tin người dùng và dữ liệu đăng ký bằng Zustand.
- **`schemas`**: Chứa file `register.schema.ts` định nghĩa các quy tắc validation cho Form đăng ký tuyển sinh.

**Cấu trúc thư mục:**

- **`src`**: Mã nguồn chính.
  - **`components`**: Các UI block tái sử dụng (background, registration form, slot machine, voucher card).
  - **`pages`**: Các màn hình chính của ứng dụng.
  - **`services`**: Helper gọi Zalo API và Backend API.
  - **`stores`**: Zustand store quản lý trạng thái ứng dụng.
  - **`schemas`**: Valibot schemas kiểm tra dữ liệu đăng ký.
  - **`static`**: Hình ảnh, banner, logo và tài nguyên giao diện.
  - **`utils`**: Các hàm tiện ích (Tailwind merge...).
  - **`app.tsx`, `router.tsx`**: App shell và định tuyến.

- **`app-config.json`**: [Cấu hình Zalo Mini App](https://mini.zalo.me/documents/intro/getting-started/app-config/).

## Hướng dẫn tích hợp (Recipes)

### 1. Thay đổi thương hiệu (Branding)

Thay đổi màu sắc, logo và typography trong file `src/tokens.ts`. Tailwind sẽ tự động kế thừa các giá trị này để áp dụng cho toàn bộ ứng dụng. Có thể tùy chỉnh giao diện theo bộ nhận diện thương hiệu của CUSC để tạo sự đồng nhất trên các màn hình.

### 2. Tùy chỉnh Form & Validation

Form đăng ký lấy họ tên và số điện thoại từ quyền Zalo khi được cấp, đồng thời thu thập email, tỉnh/thành sau sáp nhập, trường và ngành quan tâm. Có thể tìm trường theo tên hoặc nhập tên trường khác nếu danh mục chưa có.

Dữ liệu được kiểm tra bằng TanStack React Form kết hợp Valibot trước khi gửi đến Backend API. Quản trị viên có thể sử dụng dữ liệu đã lưu để theo dõi danh sách đăng ký, phân loại nhu cầu và hỗ trợ công tác tư vấn tuyển sinh.

### 3. Kết nối API Quay thưởng (Spin Logic)

Vòng quay SVG được tích hợp như một hoạt động Mini Game nhằm tăng tương tác trong các chiến dịch tuyển sinh. Các ô trên vòng quay có thể được cấu hình tên phần thưởng, trạng thái có thưởng và kết quả tương ứng.

Server chịu trách nhiệm tạo kết quả và lưu lượt chơi trong MySQL. Mỗi học sinh chỉ có một lượt cho mỗi game theo khóa duy nhất `(student_id, game_id)`. Có thể tùy chỉnh danh sách phần thưởng; vòng quay hỗ trợ tối đa 12 ô và cần giữ ít nhất 2 ô.

Trò chơi xếp hình có hai cấp: ghép 3 × 3 trong 30 giây và ghép 3 × 4 trong 45 giây. Sau khi thắng hoặc thua, mỗi cấp có thể chơi lại sau 10 phút; cấp 2 chỉ mở sau khi hoàn thành cấp 1. Lượt chơi và kết quả được lưu ở bảng `puzzle_plays`.

### 4. Thay đổi tài nguyên (Assets)

Thay thế các hình ảnh nền, banner, logo, vòng quay và voucher trong thư mục `src/static`. Nên sử dụng hình ảnh phù hợp với nhận diện thương hiệu CUSC, các chương trình đào tạo và hoạt động tuyển sinh. Lưu ý điều chỉnh lại CSS class nếu kích thước ảnh mới khác biệt quá nhiều.

## Design Disclaimer

**Lưu ý:**

- Nội dung thiết kế, hình ảnh minh họa và dữ liệu mẫu trong dự án được sử dụng nhằm phục vụ mục đích nghiên cứu, phát triển và thử nghiệm ứng dụng tuyển sinh trên nền tảng Zalo Mini App.
- Các thông tin về chương trình đào tạo, ngành học, học phí và chính sách tuyển sinh cần được cập nhật theo thông tin chính thức do CUSC cung cấp.
- Việc triển khai và sử dụng dữ liệu người đăng ký cần tuân thủ các quy định về bảo mật thông tin và quyền riêng tư của người dùng.

## License

Copyright (c) Zalo Group and its affiliates. All rights reserved.

The original examples provided by Zalo Group are for non-commercial testing and evaluation purposes only. Zalo Group reserves all rights not expressly granted.