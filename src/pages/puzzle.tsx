import { PATHS } from "@/constants/path";
import {
  profileApi,
  puzzleApi,
  type PuzzleLevel,
  type PuzzlePlay,
  type PuzzleStatus,
  type PuzzleGameConfig,
  getApiBaseUrl,
} from "@/services/api";
import aptechImage from "@/static/puzzle-aptech.png";
import arenaImage from "@/static/puzzle-arena.png";
import ctuImage from "@/static/puzzle-ctu.png";
import cuscImage from "@/static/puzzle-cusc.png";
import { useEffect, useRef, useState } from "react";
import { Page, useNavigate, useSnackbar } from "zmp-ui";

const LEVELS: Record<
  PuzzleLevel,
  { rows: number; columns: number; seconds: number; prize: string }
> = {
  1: { rows: 3, columns: 3, seconds: 30, prize: "Hộp quà may mắn" },
  2: { rows: 4, columns: 3, seconds: 45, prize: "Hộp quà đặc biệt" },
};

const PUZZLE_IMAGES = [ctuImage, cuscImage, aptechImage, arenaImage];

type Screen = "levels" | "preparing" | "playing" | "success" | "failed";

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
  const previousCompletedLevels =
    status.completedLevels ??
    status.plays
      .filter((item) => item.status === "completed")
      .map((item) => item.level);
  const completedLevels =
    play.status === "completed" &&
    !previousCompletedLevels.includes(play.level)
      ? [...previousCompletedLevels, play.level]
      : previousCompletedLevels;
  return {
    plays: [...status.plays.filter((item) => item.level !== play.level), play],
    completedLevels,
  };
}

export default function PuzzlePage() {
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const [status, setStatus] = useState<PuzzleStatus>({
    plays: [],
    completedLevels: [],
  });
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
  const [preparationSeconds, setPreparationSeconds] = useState(3);
  const [showSample, setShowSample] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [puzzleConfig, setPuzzleConfig] = useState<PuzzleGameConfig | null>(null);
  const preparationIdRef = useRef(0);

  useEffect(() => {
    if (!profileApi.hasRegistration()) {
      navigate(PATHS.HOME, { replace: true });
      return;
    }

    let active = true;
    void (async () => {
      try {
        const [result, config] = await Promise.all([
          puzzleApi.status(),
          puzzleApi.config(),
        ]);
        if (active) {
          setStatus(result);
          setPuzzleConfig(config);
        }
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

  useEffect(
    () => () => {
      preparationIdRef.current += 1;
    },
    []
  );

  useEffect(() => {
    if (screen !== "playing" || !startedAt) return;
    let expiryReported = false;

    const updateTime = () => {
      const elapsed = Math.floor((Date.now() - Date.parse(startedAt)) / 1000);
      const remaining = Math.max(0, LEVELS[level].seconds - elapsed);
      setSecondsLeft(remaining);
      if (remaining === 0) {
        setScreen("failed");
        if (!expiryReported) {
          expiryReported = true;
          void puzzleApi
            .status()
            .then(setStatus)
            .catch((error) =>
              openSnackbar({
                icon: true,
                type: "error",
                text:
                  error instanceof Error
                    ? error.message
                    : "Không thể cập nhật trạng thái lượt chơi.",
                duration: 5000,
              })
            );
        }
      }
    };

    updateTime();
    const interval = window.setInterval(updateTime, 250);
    return () => window.clearInterval(interval);
  }, [level, openSnackbar, screen, startedAt]);

  useEffect(() => {
    if (screen !== "levels") return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [screen]);

  useEffect(() => {
    if (screen !== "levels") return;
    const activePlays = status.plays.filter((play) => play.status === "started");
    if (!activePlays.length) return;

    const nextExpiration = Math.min(
      ...activePlays.map(
        (play) =>
          Date.parse(play.startedAt) + LEVELS[play.level].seconds * 1000
      )
    );
    const timeout = window.setTimeout(() => {
      void puzzleApi
        .status()
        .then(setStatus)
        .catch((error) =>
          openSnackbar({
            icon: true,
            type: "error",
            text:
              error instanceof Error
                ? error.message
                : "Không thể cập nhật trạng thái lượt chơi.",
            duration: 5000,
          })
        );
    }, Math.max(0, nextExpiration - Date.now()) + 100);

    return () => window.clearTimeout(timeout);
  }, [openSnackbar, screen, status.plays]);

  const startLevel = async (selectedLevel: PuzzleLevel) => {
    const preparationId = preparationIdRef.current + 1;
    preparationIdRef.current = preparationId;
    setBusy(true);
    setLevel(selectedLevel);
    const availableImages = [
      ...PUZZLE_IMAGES,
      ...(puzzleConfig?.images ?? []).map(
        (item) => `${getApiBaseUrl()}${item.url}`
      ),
    ];
    setImage(availableImages[Math.floor(Math.random() * availableImages.length)]);
    setPieces(
      Array.from(
        { length: LEVELS[selectedLevel].rows * LEVELS[selectedLevel].columns },
        (_, index) => index
      )
    );
    setPreparationSeconds(3);
    setShowSample(false);
    setScreen("preparing");

    try {
      for (let seconds = 3; seconds > 0; seconds -= 1) {
        if (preparationId !== preparationIdRef.current) return;
        setPreparationSeconds(seconds);
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
      }
      if (preparationId !== preparationIdRef.current) return;
      setPreparationSeconds(0);

      const play = await puzzleApi.start(selectedLevel);
      if (preparationId !== preparationIdRef.current) return;
      setStatus((current) => replacePlay(current, play));
      setPlayId(play.id);
      setStartedAt(play.startedAt);
      setSecondsLeft(LEVELS[selectedLevel].seconds);
      setPieces(
        shufflePieces(LEVELS[selectedLevel].rows * LEVELS[selectedLevel].columns)
      );
      setSelectedPiece(null);
      setShowSample(false);
      setScreen("playing");
    } catch (error) {
      if (preparationId !== preparationIdRef.current) return;
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
      setScreen("levels");
    } finally {
      if (preparationId === preparationIdRef.current) setBusy(false);
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
  const levelOneCompleted =
    status.completedLevels?.includes(1) ?? levelOnePlay?.status === "completed";
  const levelTwoCompleted =
    status.completedLevels?.includes(2) ?? levelTwoPlay?.status === "completed";
  const levelTwoUnlocked = levelOneCompleted;

  const showGift = (selectedLevel: PuzzleLevel) => {
    setLevel(selectedLevel);
    setScreen("success");
  };

  const goToLevels = () => {
    preparationIdRef.current += 1;
    setScreen("levels");
    setBusy(false);
    setSelectedPiece(null);
    setShowSample(false);
  };

  return (
    <Page
      hideScrollbar
      className="min-h-screen overflow-y-auto bg-[#F4F8FF] pb-24"
    >
      <main className="mx-auto max-w-lg px-4 pb-8 pt-10">
        <button
          type="button"
          aria-label="Quay lại"
          disabled={screen === "preparing" && preparationSeconds === 0}
          className="flex min-h-11 w-11 items-center justify-start text-[#0068FF] disabled:opacity-50"
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
                hasCompleted={levelOneCompleted}
                now={now}
                disabled={busy}
                onPlay={() => void startLevel(1)}
                onShowGift={() => showGift(1)}
              />
              <LevelCard
                level={2}
                play={levelTwoPlay}
                hasCompleted={levelTwoCompleted}
                now={now}
                locked={!levelTwoUnlocked}
                disabled={busy}
                onPlay={() => void startLevel(2)}
                onShowGift={() => showGift(2)}
              />
            </div>
            <p className="mt-4 rounded-xl bg-blue-50 p-4 text-xs leading-5 text-blue-900">
              Mỗi cấp chỉ có một lượt chơi. Hoàn thành cấp 1 để mở cấp 2 với
              thử thách khó hơn và phần quà hấp dẫn hơn.
            </p>
          </section>
        ) : screen === "preparing" ? (
          <section className="mt-5 rounded-3xl border border-blue-100 bg-white p-5 text-center shadow-md">
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-extrabold tracking-[0.14em] text-[#0755B8]">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-[#0068FF]"
              />
              SẴN SÀNG THỬ THÁCH
            </span>
            <h1 className="mt-4 text-2xl font-black text-[#0755B8]">
              Chuẩn bị cấp {level}
            </h1>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-gray-600">
              Quan sát thật kỹ hình mẫu — bạn sẽ cần ghi nhớ để ghép lại
              chính xác.
            </p>

            <div className="relative mx-auto mt-5 max-w-[240px] rounded-2xl border border-blue-100 bg-blue-50 p-2">
              <img
                src={image}
                alt="Ảnh mẫu để chuẩn bị ghép hình"
                className="mx-auto max-h-72 max-w-full rounded-xl object-contain"
              />
              <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-[10px] font-extrabold tracking-wider text-[#0755B8] shadow-sm">
                ẢNH MẪU
              </span>
            </div>

            <div className="mx-auto mt-5 flex max-w-[280px] items-center justify-center gap-3 rounded-2xl bg-slate-50 px-3 py-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xl font-black tabular-nums text-[#0755B8]">
                {preparationSeconds > 0 ? preparationSeconds : "…"}
              </span>
              <div className="text-left">
                <p
                  className="text-sm font-extrabold text-[#0755B8]"
                  aria-live="polite"
                >
                  {preparationSeconds > 0
                    ? "Trò chơi sắp bắt đầu"
                    : "Đang vào trò chơi..."}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {LEVELS[level].rows * LEVELS[level].columns} mảnh ghép
                  <span aria-hidden="true"> · </span>
                  {LEVELS[level].seconds} giây
                </p>
              </div>
            </div>
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
              disabled={busy || showSample}
              onPieceClick={handlePieceClick}
            />
            <button
              type="button"
              disabled={busy}
              aria-expanded={showSample}
              aria-controls="puzzle-sample"
              className="mt-4 w-full touch-none select-none rounded-xl border border-[#0068FF] px-4 py-3 text-sm font-bold text-[#0068FF] disabled:opacity-50"
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                setShowSample(true);
              }}
              onPointerUp={() => setShowSample(false)}
              onPointerCancel={() => setShowSample(false)}
              onLostPointerCapture={() => setShowSample(false)}
              onKeyDown={(event) => {
                if (event.key === " " || event.key === "Enter") {
                  event.preventDefault();
                  setShowSample(true);
                }
              }}
              onKeyUp={(event) => {
                if (event.key === " " || event.key === "Enter") {
                  setShowSample(false);
                }
              }}
              onBlur={() => setShowSample(false)}
              onContextMenu={(event) => event.preventDefault()}
            >
              XEM MẪU ẢNH
            </button>
            <p className="mt-1 text-center text-xs text-gray-500">
              Nhấn giữ để xem mẫu
            </p>
            {showSample && (
              <div
                id="puzzle-sample"
                className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
              >
                <div className="w-full max-w-[360px] rounded-2xl bg-white p-4 text-center shadow-2xl">
                  <p className="font-bold text-[#0755B8]">ẢNH MẪU</p>
                  <img
                    src={image}
                    alt="Ảnh mẫu của bàn ghép hình"
                    className="mx-auto mt-3 aspect-[3/4] w-full rounded-lg object-cover"
                  />
                  <p className="mt-3 text-sm text-gray-600">
                    Thả tay để tiếp tục ghép hình
                  </p>
                </div>
              </div>
            )}
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
              Lượt chơi cấp {level} đã kết thúc. Bạn có thể chơi lại sau 10
              phút.
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

function formatCooldown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function LevelCard({
  level,
  play,
  hasCompleted,
  now,
  locked = false,
  disabled,
  onPlay,
  onShowGift,
}: {
  level: PuzzleLevel;
  play: PuzzlePlay | undefined;
  hasCompleted: boolean;
  now: number;
  locked?: boolean;
  disabled: boolean;
  onPlay: () => void;
  onShowGift: () => void;
}) {
  const config = LEVELS[level];
  const completed = hasCompleted;
  const used = Boolean(play);
  const retrySeconds = play?.retryAt
    ? Math.max(0, Math.ceil((Date.parse(play.retryAt) - now) / 1000))
    : 0;
  const coolingDown = retrySeconds > 0;
  const inProgress = play?.status === "started";

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
            : locked
              ? "Đã khóa"
              : inProgress
                ? "Đang chơi"
                : play?.status === "failed"
                  ? "Đã kết thúc"
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
          {coolingDown
            ? `Có thể chơi lại sau ${formatCooldown(retrySeconds)}.`
            : "Bạn có thể chơi lại cấp này."}
        </p>
      )}
      {completed && coolingDown && (
        <p className="mt-3 text-xs text-amber-700">
          Có thể chơi lại sau {formatCooldown(retrySeconds)}.
        </p>
      )}
      <button
        type="button"
        disabled={disabled || locked || inProgress || coolingDown}
        className="mt-4 w-full rounded-xl bg-[#0068FF] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
        onClick={onPlay}
      >
        {locked
          ? "CHƯA MỞ KHÓA"
          : inProgress
            ? "ĐANG TRONG LƯỢT CHƠI"
            : coolingDown
              ? `CHƠI LẠI SAU ${formatCooldown(retrySeconds)}`
              : used
                ? "CHƠI LẠI"
                : "BẮT ĐẦU CHƠI"}
      </button>
      {completed && (
        <button
          type="button"
          className="mt-2 w-full rounded-xl border border-[#0068FF] px-4 py-3 text-sm font-bold text-[#0068FF]"
          onClick={onShowGift}
        >
          XEM HỘP QUÀ
        </button>
      )}
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
      className="mx-auto grid aspect-[3/4] w-full max-w-[360px] gap-0.5 rounded-2xl bg-blue-100 p-1 shadow-inner"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
      }}
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
            className={`min-h-0 min-w-0 rounded-md border bg-white bg-no-repeat transition ${
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
    <section className="mt-5 rounded-3xl border border-blue-100 bg-white p-5 text-center shadow-md">
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-extrabold tracking-[0.14em] text-emerald-700">
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          viewBox="0 0 20 20"
          fill="none"
        >
          <path
            d="m4 10 4 4 8-8"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
          />
        </svg>
        HOÀN THÀNH THỬ THÁCH
      </span>
      <h1 className="mt-4 text-2xl font-black leading-tight text-[#0755B8]">
        Tuyệt vời!<br />
        Bạn đã hoàn thành cấp {level}
      </h1>

      <div className="relative mx-auto my-5 flex h-36 max-w-[280px] items-center justify-center overflow-hidden rounded-2xl bg-blue-50">
        <span
          aria-hidden="true"
          className="absolute left-8 top-7 h-2 w-2 rounded-full bg-amber-400"
        />
        <span
          aria-hidden="true"
          className="absolute right-10 top-10 h-3 w-3 rounded-full bg-blue-300"
        />
        <span
          aria-hidden="true"
          className="absolute bottom-7 left-12 h-2.5 w-2.5 rounded-full bg-sky-400"
        />
        <div className="relative h-24 w-28" aria-hidden="true">
          <div className="absolute left-1/2 top-1 h-5 w-28 -translate-x-1/2 rounded-md bg-[#8CC8FF]" />
          <div className="absolute bottom-0 left-2 right-2 top-7 rounded-b-xl bg-[#0068FF]" />
          <div className="absolute bottom-0 left-1/2 top-7 w-5 -translate-x-1/2 bg-[#DBEAFE]" />
          <div className="absolute left-1/2 top-0 h-7 w-12 -translate-x-1/2 rounded-full border-[5px] border-[#0068FF]" />
        </div>
      </div>

      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
          Phần thưởng của bạn
        </p>
        <p className="mt-1 font-extrabold text-amber-950">
          {LEVELS[level].prize}
        </p>
      </div>
      {level === 1 ? (
        <div className="mt-4 rounded-2xl bg-blue-50 px-4 py-3 text-left">
          <p className="text-sm font-bold text-[#0755B8]">
            Cấp 2 đã được mở khóa!
          </p>
          <p className="mt-1 text-xs leading-5 text-blue-800">
            Sẵn sàng cho thử thách khó hơn và phần quà lớn hơn chưa?
          </p>
        </div>
      ) : (
        <p className="mt-4 text-sm leading-5 text-gray-600">
          Bạn đã chinh phục tất cả các cấp độ. Cảm ơn bạn đã tham gia!
        </p>
      )}
      <button
        type="button"
        className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#0068FF] px-4 py-3 font-extrabold text-white shadow-md transition active:scale-[0.98]"
        onClick={onBack}
      >
        {level === 1 ? "TIẾP TỤC CẤP 2" : "VỀ DANH SÁCH CẤP"}
        <svg
          aria-hidden="true"
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M5 12h14m-6-6 6 6-6 6"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      </button>
    </section>
  );
}
