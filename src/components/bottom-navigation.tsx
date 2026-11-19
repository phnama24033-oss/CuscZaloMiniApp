import { PATHS } from "@/constants/path";
import { useLocation, useNavigate } from "zmp-ui";

const items = [
  { label: "Trang chủ", path: PATHS.HOME, icon: "home" },
  { label: "Cá nhân", path: PATHS.PROFILE, icon: "profile" },
  { label: "Quản trị", path: PATHS.ADMIN, icon: "settings" },
];

function NavigationIcon({ name }: { name: string }) {
  const paths = {
    home: "M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
    profile:
      "M20 21a8 8 0 0 0-16 0M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    settings:
      "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0-6v3m0 14v3m10-10h-3M5 12H2m17.07-7.07-2.12 2.12M7.05 16.95l-2.12 2.12m14.14 0-2.12-2.12M7.05 7.05 4.93 4.93",
  }[name as "home" | "profile" | "settings"];

  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d={paths} />
    </svg>
  );
}

export default function BottomNavigation() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="app-bottom-nav" aria-label="Điều hướng chính">
      {items.map((item) => {
        const active =
          item.path === PATHS.HOME
            ? pathname === PATHS.HOME
            : pathname.startsWith(item.path);

        return (
          <button
            key={item.path}
            type="button"
            className={`app-bottom-nav__item${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
            onClick={() => navigate(item.path)}
          >
            <span className="app-bottom-nav__icon">
              <NavigationIcon name={item.icon} />
            </span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
