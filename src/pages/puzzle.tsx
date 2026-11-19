import { PATHS } from "@/constants/path";
import {
  profileApi,
  puzzleApi,
  type PuzzleLevel,
  type PuzzlePlay,
  type PuzzleStatus,
} from "@/services/api";
import aptechImage from "@/static/puzzle-aptech.png";
import arenaImage from "@/static/puzzle-arena.png";
import ctuImage from "@/static/puzzle-ctu.png";
import cuscImage from "@/static/puzzle-cusc.png";
import { useEffect, useState } from "react";
import { Page, useNavigate, useSnackbar } from "zmp-ui";

const LEVELS: Record<
  PuzzleLevel,
  { rows: number; columns: number; seconds: number; prize: string }
> = {
  1: { rows: 3, columns: 3, seconds: 30, prize: "Hộp quà may mắn" },
  2: { rows: 4, columns: 3, seconds: 45, prize: "Hộp quà đặc biệt" },
};

const PUZZLE_IMAGES = [ctuImage, cuscImage, aptechImage, arenaImage];

type Screen = "levels" | "playing" | "success" | "failed";

function shufflePieces(count: number) {
  const pieces = Array.from({ length: count }, (_, index) => index);
  for (let index = pieces.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(Math.random() * (index + 1));
    [pieces[index], pieces[otherIndex]] = [pieces[otherIndex], pieces[index]];
  }
  if (pieces.every((piece, index) => piece === index)) {
    [pieces[0], pieces[1]] = [pieces[1], pieces[0]];
  }
  return pieces;
}

function replacePlay(status: PuzzleStatus, play: PuzzlePlay): PuzzleStatus {
  return {
    plays: [...status.plays.filter((item) => item.level !== play.level), play],
  };
}

export default function PuzzlePage() {
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const [status, setStatus] = useState<PuzzleStatus>({ plays: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [screen, setScreen] = useState<Screen>("levels");
  const [level, setLevel] = useState<PuzzleLevel>(1);
  const [playId, setPlayId] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [image, setImage] = useState(ctuImage);
  const [pieces, setPieces] = useState<number[]>([]);
  const [selectedPiece, setSelectedPiece] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(LEVELS[1].seconds);

  useEffect(() => {
    if (!profileApi.hasRegistration()) {
      navigate(PATHS.HOME, { replace: true });
      return;
    }

    let active = true;
    void (async () => {
      try {
        const result = await puzzleApi.status();
        if (active) setStatus(result);
      } catch (error) {
        if (!active) return;
        openSnackbar({
          icon: true,
          type: "error",
          text:
            error instanceof Error
              ? error.message
              : "Không thể tải trạng thái trò chơi.",
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

  useEffect(() => {
    if (screen !== "playing" || !startedAt) return;

    const updateTime = () => {
      const elapsed = Math.floor((Date.now() - Date.parse(startedAt)) / 1000);
      const remaining = Math.max(0, LEVELS[level].seconds - elapsed);
      setSecondsLeft(remaining);
      if (remaining === 0) setScreen("failed");
    };

    updateTime();
    const interval = window.setInterval(updateTime, 250);
    return () => window.clearInterval(interval);
  }, [level, screen, startedAt]);

  const startLevel = async (selectedLevel: PuzzleLevel) => {
    setBusy(true);
    try {
      const play = await puzzleApi.start(selectedLevel);
      setStatus((current) => replacePlay(current, play));
      setLevel(selectedLevel);
      setPlayId(play.id);
      setStartedAt(play.startedAt);
      setSecondsLeft(LEVELS[selectedLevel].seconds);
      setImage(PUZZLE_IMAGES[Math.floor(Math.random() * PUZZLE_IMAGES.length)]);
      setPieces(shufflePieces(LEVELS[selectedLevel].rows * LEVELS[selectedLevel].columns));
      setSelectedPiece(null);
      setScreen("playing");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không thể bắt đầu trò chơi.";
      openSnackbar({
        icon: true,
        type: "error",
        text:
          message === "Yêu cầu thất bại (404)."
            ? "Máy chủ chưa có API bắt đầu xếp hình. Hãy cập nhật server/index.cjs và khởi động lại API."
            : message,
        duration: 5000,
      });
      try {
        setStatus(await puzzleApi.status());
      } catch {
        // Keep the current status visible; the start error is already shown.
      }
    } finally {
      setBusy(false);
    }
  };

  const handlePieceClick = (position: number) => {
    if (screen !== "playing" || busy) return;
    if (selectedPiece === null) {
      setSelectedPiece(position);
      return;
    }
    if (selectedPiece === position) {
      setSelectedPiece(null);
      return;
    }

    const nextPieces = [...pieces];
    [nextPieces[selectedPiece], nextPieces[position]] = [
      nextPieces[position],
      nextPieces[selectedPiece],
    ];
    setPieces(nextPieces);
    setSelectedPiece(null);

    if (nextPieces.every((piece, index) => piece === index)) {
      void completeLevel(nextPieces);
    }
  };

  const completeLevel = async (solution: number[]) => {
    if (playId === null) return;
    setBusy(true);
    try {
      const completedPlay = await puzzleApi.complete(level, playId, solution);
      setStatus((current) => replacePlay(current, completedPlay));
      setScreen("success");
    } catch (error) {
      openSnackbar({
        icon: true,
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Không thể xác nhận kết quả. Vui lòng kiểm tra kết nối.",
        duration: 5000,
      });
      try {
        const latestStatus = await puzzleApi.status();
        setStatus(latestStatus);
        const play = latestStatus.plays.find((item) => item.level === level);
        if (play?.status === "completed") setScreen("success");
        else if (play?.status === "failed") setScreen("failed");
      } catch {
        // Preserve the solved board so the player can see their result.
      }
    } finally {
      setBusy(false);
    }
  };

  const levelOnePlay = status.plays.find((play) => play.level === 1);
  const levelTwoPlay = status.plays.find((play) => play.level === 2);
  const levelTwoUnlocked = levelOnePlay?.status === "completed";

  const showGift = (selectedLevel: PuzzleLevel) => {
    setLevel(selectedLevel);
    setScreen("success");
  };

  const goToLevels = () => {
    setScreen("levels");
    setSelectedPiece(null);
  };

  return (
    <Page
      hideScrollbar
      className="min-h-full overflow-y-auto bg-gradient-to-b from-[#EAF3FF] to-white pb-24"
    >
      <main className="mx-auto max-w-lg px-4 pb-8 pt-10">
        <button
          type="button"
          aria-label="Quay lại"
          className="flex min-h-11 w-11 items-center justify-start text-[#0068FF]"
          onClick={() =>
            screen === "levels" ? navigate(PATHS.HOME) : goToLevels()
          }
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

        {loading ? (
          <p className="py-16 text-center text-sm text-gray-500">
            Đang tải trò chơi...
          </p>
        ) : screen === "levels" ? (
          <section>
            <header className="py-6 text-center">
              <h1 className="mt-2 text-2xl font-black text-[#0755B8]">
                XẾP HÌNH
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Chọn đúng vị trí các mảnh ghép trước khi hết giờ.
              </p>
            </header>
            <div className="space-y-4">
              <LevelCard
                level={1}
                play={levelOnePlay}
                disabled={busy}
                onPlay={() => void startLevel(1)}
                onShowGift={() => showGift(1)}
              />
              <LevelCard
                level={2}
                play={levelTwoPlay}
                locked={!levelTwoUnlocked}
                disabled={busy}
                onPlay={() => void startLevel(2)}
                onShowGift={() => showGift(2)}
              />
            </div>
            <p className="mt-4 rounded-xl bg-blue-50 p-4 text-xs leading-5 text-blue-900">
              Mỗi cấp chỉ có một lượt chơi. Cần hoàn thành cấp 1 để mở cấp 2;
              cấp 2 có hộp quà tượng trưng lớn hơn.
            </p>
          </section>
        ) : screen === "playing" ? (
          <section>
            <header className="flex items-center justify-between py-6">
              <div>
                <h1 className="text-xl font-black text-[#0755B8]">
                  CẤP {level}
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                  Chạm hai mảnh để đổi vị trí
                </p>
              </div>
              <div
                className={`rounded-xl px-4 py-2 text-lg font-black ${
                  secondsLeft <= 10
                    ? "bg-red-100 text-red-700"
                    : "bg-blue-100 text-[#0755B8]"
                }`}
                aria-live="polite"
              >
                CÒN {secondsLeft}s
              </div>
            </header>
            <PuzzleBoard
              level={level}
              image={image}
              pieces={pieces}
              selectedPiece={selectedPiece}
              disabled={busy}
              onPieceClick={handlePieceClick}
            />
            {busy && (
              <p className="mt-4 text-center text-sm text-gray-600">
                Đang xác nhận kết quả...
              </p>
            )}
          </section>
        ) : screen === "success" ? (
          <GiftScreen level={level} onBack={goToLevels} />
        ) : (
          <section className="mt-12 rounded-3xl bg-white p-6 text-center shadow-lg">
            <h1 className="mt-4 text-2xl font-black text-[#0755B8]">
              Hết thời gian!
            </h1>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Lượt chơi cấp {level} đã được sử dụng. Bạn vẫn có thể chơi cấp 2
              nếu đã hoàn thành cấp 1.
            </p>
            <button
              type="button"
              className="mt-6 w-full rounded-xl bg-[#0068FF] px-4 py-3 font-bold text-white"
              onClick={goToLevels}
            >
              QUAY LẠI CHỌN CẤP ĐỘ
            </button>
          </section>
        )}
      </main>
    </Page>
  );
}

function LevelCard({
  level,
  play,
  locked = false,
  disabled,
  onPlay,
  onShowGift,
}: {
  level: PuzzleLevel;
  play: PuzzlePlay | undefined;
  locked?: boolean;
  disabled: boolean;
  onPlay: () => void;
  onShowGift: () => void;
}) {
  const config = LEVELS[level];
  const completed = play?.status === "completed";
  const used = Boolean(play);

  return (
    <article
      className={`rounded-2xl border bg-white p-4 shadow-sm ${
        locked ? "border-gray-200 opacity-70" : "border-blue-100"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-[#0755B8]">
            Cấp {level}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Ghép {config.rows} × {config.columns} · {config.seconds} giây
          </p>
          <p className="mt-1 text-xs font-semibold text-amber-700">
            {config.prize}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            completed
              ? "bg-green-50 text-green-700"
              : locked
                ? "bg-gray-100 text-gray-500"
                : used
                  ? "bg-gray-100 text-gray-600"
                  : "bg-blue-50 text-[#0068FF]"
          }`}
        >
          {completed
            ? "Hoàn thành"
            : used
              ? "Đã sử dụng"
              : locked
                ? "Đã khóa"
                : "Sẵn sàng"}
        </span>
      </div>
      {locked && (
        <p className="mt-3 text-xs text-gray-500">
          Hoàn thành cấp 1 để mở khóa cấp này.
        </p>
      )}
      {play?.status === "failed" && (
        <p className="mt-3 text-xs text-red-600">
          Đã dùng lượt chơi, không thể chơi lại cấp này.
        </p>
      )}
      <button
        type="button"
        disabled={disabled || locked || (used && !completed)}
        className="mt-4 w-full rounded-xl bg-[#0068FF] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
        onClick={completed ? onShowGift : onPlay}
      >
        {completed
          ? "XEM HỘP QUÀ"
          : used
            ? "ĐÃ SỬ DỤNG LƯỢT"
            : locked
              ? "CHƯA MỞ KHÓA"
              : "BẮT ĐẦU CHƠI"}
      </button>
    </article>
  );
}

function PuzzleBoard({
  level,
  image,
  pieces,
  selectedPiece,
  disabled,
  onPieceClick,
}: {
  level: PuzzleLevel;
  image: string;
  pieces: number[];
  selectedPiece: number | null;
  disabled: boolean;
  onPieceClick: (position: number) => void;
}) {
  const { rows, columns } = LEVELS[level];

  return (
    <div
      className="grid aspect-square w-full gap-1.5 rounded-2xl bg-blue-100 p-2 shadow-inner"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      aria-label={`Bàn ghép hình ${rows} nhân ${columns}`}
    >
      {pieces.map((piece, position) => {
        const originalRow = Math.floor(piece / columns);
        const originalColumn = piece % columns;
        const backgroundPositionX =
          columns === 1 ? 0 : (originalColumn / (columns - 1)) * 100;
        const backgroundPositionY =
          rows === 1 ? 0 : (originalRow / (rows - 1)) * 100;
        return (
          <button
            key={position}
            type="button"
            disabled={disabled}
            aria-label={`Mảnh ${piece + 1}, vị trí ${position + 1}`}
            aria-pressed={selectedPiece === position}
            className={`min-h-0 min-w-0 rounded-lg border-2 bg-white bg-no-repeat transition ${
              selectedPiece === position
                ? "z-10 scale-95 border-amber-400 ring-4 ring-amber-200"
                : "border-white"
            }`}
            style={{
              backgroundImage: `url("${image}")`,
              backgroundSize: `${columns * 100}% ${rows * 100}%`,
              backgroundPosition: `${backgroundPositionX}% ${backgroundPositionY}%`,
            }}
            onClick={() => onPieceClick(position)}
          />
        );
      })}
    </div>
  );
}

function GiftScreen({
  level,
  onBack,
}: {
  level: PuzzleLevel;
  onBack: () => void;
}) {
  return (
    <section className="mt-10 rounded-3xl bg-white p-6 text-center shadow-lg">
      <p className="text-sm font-bold uppercase tracking-widest text-[#0068FF]">
        Chúc mừng bạn!
      </p>
      <h1 className="mt-2 text-2xl font-black text-[#0755B8]">
        Bạn đã hoàn thành cấp {level}
      </h1>
      <div
        className="relative mx-auto my-7 h-24 w-28"
        aria-hidden="true"
      >
        <div className="absolute left-1/2 top-1 h-5 w-28 -translate-x-1/2 rounded-md bg-[#8CC8FF]" />
        <div className="absolute bottom-0 left-2 right-2 top-7 rounded-b-xl bg-[#0068FF]" />
        <div className="absolute bottom-0 left-1/2 top-7 w-5 -translate-x-1/2 bg-[#DBEAFE]" />
        <div className="absolute left-1/2 top-0 h-7 w-12 -translate-x-1/2 rounded-full border-[5px] border-[#0068FF]" />
      </div>
      <div className="rounded-2xl bg-amber-50 p-4">
        <p className="font-extrabold text-amber-900">{LEVELS[level].prize}</p>
        <p className="mt-1 text-xs leading-5 text-amber-800">
          Đây là hộp quà tượng trưng cho trò chơi.
        </p>
      </div>
      {level === 1 && (
        <p className="mt-4 text-sm leading-5 text-gray-600">
          Cấp 2 đã được mở khóa với phần quà lớn hơn. Bạn có thể thử sức ngay!
        </p>
      )}
      <button
        type="button"
        className="mt-6 w-full rounded-xl bg-[#0068FF] px-4 py-3 font-bold text-white"
        onClick={onBack}
      >
        TIẾP TỤC
      </button>
    </section>
  );
}
