import { PATHS } from "@/constants/path";
import { AnimationRoutes, Route, ZMPRouter } from "zmp-ui";
import HomePage from "./pages/home";
import RewardPage from "./pages/reward";
import VoucherPage from "./pages/voucher";
import WheelPage from "./pages/wheel";
import AdminPage from "./pages/admin";
import BottomNavigation from "./components/bottom-navigation";
import GamesPage from "./pages/games";
import ProfilePage from "./pages/profile";
import PuzzlePage from "./pages/puzzle";

const routes = [
  { path: PATHS.HOME, element: <HomePage /> },
  { path: PATHS.REWARD, element: <RewardPage /> },
  { path: PATHS.GAMES, element: <HomePage /> },
  { path: PATHS.PROFILE, element: <ProfilePage /> },
  { path: PATHS.WHEEL, element: <WheelPage /> },
  { path: PATHS.PUZZLE, element: <PuzzlePage /> },
  { path: PATHS.VOUCHER, element: <VoucherPage /> },
  { path: PATHS.ADMIN, element: <AdminPage /> },
];

export default function AppRouter() {
  return (
    <ZMPRouter>
      <AnimationRoutes>
        {routes.map((route) => (
          <Route key={route.path} path={route.path} element={route.element} />
        ))}
      </AnimationRoutes>
      <BottomNavigation />
    </ZMPRouter>
  );
}
