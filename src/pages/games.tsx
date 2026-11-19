import { PATHS } from "@/constants/path";
import { profileApi, publicGameApi, type GameOption } from "@/services/api";
import { useEffect, useState } from "react";
import { Page, useNavigate, useSnackbar } from "zmp-ui";

export default function GamesPage() {
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const [games, setGames] = useState<GameOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profileApi.hasRegistration()) {
      navigate(PATHS.HOME, { replace: true });
      return;
    }

    let active = true;
    (async () => {
      try {
        const options = await publicGameApi.games();
        if (active) {
          setGames(
            options.some((game) => game.code === "puzzle")
              ? options
              : [
                  ...options,
                  {
                    id: -1,
                    code: "puzzle",
                    name: "Xếp hình",
                    description: "Ghép hình trong thời gian quy định",
                    iconUrl: null,
                    routePath: PATHS.PUZZLE,
                  },
                ]
          );
        }
      } catch (error) {
        if (!active) return;
        openSnackbar({
          icon: true,
          type: "error",
          text:
            error instanceof Error
              ? error.message
              : "Không thể tải danh sách trò chơi.",
          duration: 5000,
        });
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <Page
      hideScrollbar
      className="min-h-screen overflow-y-auto bg-gradient-to-b from-[#EAF3FF] to-white pb-24"
    >
      <main className="mx-auto max-w-lg px-4 pt-10">
        <header className="py-6 text-center">
          <h1 className="text-2xl font-black text-[#0755B8]">Mini game</h1>
          <p className="mt-2 text-sm text-gray-600">
            Chọn trò chơi bạn muốn tham gia
          </p>
        </header>
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Đang tải trò chơi...
          </p>
        ) : games.length ? (
          <div className="grid grid-cols-2 gap-3">
            {games.map((game) => (
              <button
                key={game.id}
                type="button"
                className="flex min-h-40 flex-col items-center justify-center rounded-2xl bg-white p-4 text-center shadow-sm transition hover:shadow-md"
                onClick={() =>
                  navigate(
                    game.code === "puzzle" ? PATHS.PUZZLE : game.routePath
                  )
                }
              >
                {game.iconUrl ? (
                  <img
                    className="h-14 w-14 rounded-xl object-cover"
                    src={game.iconUrl}
                    alt=""
                  />
                ) : (
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-[#0068FF]"
                    aria-hidden="true"
                  >
                    <GameIcon code={game.code} />
                  </span>
                )}
                <span className="mt-3 font-semibold text-gray-900">
                  {game.name}
                </span>
                {game.description && (
                  <span className="mt-1 text-xs text-gray-500">
                    {game.description}
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-white p-4 text-center text-sm text-gray-600">
            Hiện chưa có trò chơi khả dụng.
          </p>
        )}
      </main>
    </Page>
  );
}

function GameIcon({ code }: { code: string }) {
  return (
    <svg
      className="h-9 w-9"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      {code === "lucky_wheel" ? (
        <>
          <circle cx="12" cy="10" r="7" />
          <path d="M12 3v14m-6.1-10.5 12.2 7m0-7-12.2 7M8 21h8m-4-4v4" />
          <circle cx="12" cy="10" r="1" fill="currentColor" />
        </>
      ) : code === "puzzle" ? (
        <path d="M9 3h2a2 2 0 1 1 4 0h2a2 2 0 0 1 2 2v3a2 2 0 1 0 0 4v3a2 2 0 0 1-2 2h-3a2 2 0 1 0-4 0H7a2 2 0 0 1-2-2v-3a2 2 0 1 0 0-4V5a2 2 0 0 1 2-2z" />
      ) : (
        <path d="M7 8h10a4 4 0 0 1 3.8 5.2l-.8 2.5a2 2 0 0 1-3.3.8L15 14H9l-1.7 2.5a2 2 0 0 1-3.3-.8l-.8-2.5A4 4 0 0 1 7 8zm1 3v3m-1.5-1.5h3M16 12h.01M18 14h.01" />
      )}
    </svg>
  );
}
