import {
  gameApi,
  publicGameApi,
  type SpinResult,
  type WheelOption,
} from "@/services/api";
import { useEffect, useRef, useState } from "react";
import { useSnackbar } from "zmp-ui";

const COLORS = [
  "#0068FF",
  "#1685FF",
  "#0755B8",
  "#00A5FF",
  "#1D4ED8",
  "#3D8BFF",
  "#0369A1",
  "#2563EB",
  "#0284C7",
  "#1E40AF",
  "#0EA5E9",
  "#1D4ED8",
];

function pointAt(angle: number, radius: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: 150 + radius * Math.cos(radians),
    y: 150 + radius * Math.sin(radians),
  };
}

function sectorPath(index: number, count: number) {
  const startAngle = -90 + (index * 360) / count;
  const endAngle = -90 + ((index + 1) * 360) / count;
  const start = pointAt(startAngle, 140);
  const end = pointAt(endAngle, 140);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M 150 150 L ${start.x} ${start.y} A 140 140 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

function WheelGraphic({
  slots,
  rotation,
  spinning,
}: {
  slots: WheelOption[];
  rotation: number;
  spinning: boolean;
}) {
  const segmentAngle = 360 / slots.length;

  return (
    <div className="relative mx-auto w-full max-w-[340px]">
      <div className="wheel-pointer" aria-hidden="true" />
      <svg
        viewBox="0 0 300 300"
        role="img"
        aria-label={`Vòng quay gồm ${slots.length} ô`}
        className="wheel-graphic"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning
            ? "transform 5s cubic-bezier(0.12, 0.72, 0.12, 1)"
            : "none",
        }}
      >
        <circle cx="150" cy="150" r="147" fill="#ffffff" />
        <g>
          {slots.map((slot, index) => {
            const middleAngle = -90 + (index + 0.5) * segmentAngle;
            return (
              <g key={slot.id}>
                <path
                  d={sectorPath(index, slots.length)}
                  fill={COLORS[index % COLORS.length]}
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                <g transform={`rotate(${middleAngle + 90} 150 150)`}>
                  <text
                    x="150"
                    y="62"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={slots.length > 8 ? 12 : 15}
                    fontWeight="800"
                  >
                    {index + 1}
                  </text>
                  <text
                    x="150"
                    y="80"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={slots.length > 8 ? 8 : 10}
                    fontWeight="600"
                  >
                    {slot.label.length > 18
                      ? `${slot.label.slice(0, 17)}…`
                      : slot.label}
                  </text>
                </g>
              </g>
            );
          })}
        </g>
        <circle
          cx="150"
          cy="150"
          r="24"
          fill="#ffffff"
          stroke="#dbeafe"
          strokeWidth="5"
        />
        <text
          x="150"
          y="154"
          textAnchor="middle"
          fill="#0068ff"
          fontSize="9"
          fontWeight="800"
        >
          QUAY
        </text>
      </svg>
    </div>
  );
}

export default function SlotMachine() {
  const [slots, setSlots] = useState<WheelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [checkingSpin, setCheckingSpin] = useState(true);
  const [spinUsed, setSpinUsed] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [outcome, setOutcome] = useState<SpinResult | null>(null);
  const currentRotation = useRef(0);
  const { openSnackbar } = useSnackbar();

  useEffect(() => {
    let active = true;
    publicGameApi
      .wheel()
      .then((wheel) => {
        if (active) setSlots(wheel);
      })
      .catch((error: unknown) => {
        if (!active) return;
        openSnackbar({
          icon: true,
          type: "error",
          text:
            error instanceof Error
              ? error.message
              : "Không thể tải cấu hình vòng quay.",
          duration: 5000,
        });
      })
      .then(() => {
        if (active) setLoading(false);
      }, () => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    gameApi
      .status()
      .then((status) => {
        if (active && status) setSpinUsed(status.used);
      })
      .catch((error: unknown) => {
        if (!active) return;
        openSnackbar({
          icon: true,
          type: "error",
          text:
            error instanceof Error
              ? error.message
              : "Không thể kiểm tra lượt quay.",
          duration: 5000,
        });
      })
      .then(() => {
        if (active) setCheckingSpin(false);
      }, () => {
        if (active) setCheckingSpin(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const spin = async () => {
    if (spinning || spinUsed || checkingSpin || loading || slots.length < 2)
      return;
    setSpinning(true);
    setOutcome(null);
    sessionStorage.removeItem("cusc-zalo-mini-app-latest-prize");

    try {
      const result = await gameApi.spin();
      setSpinUsed(true);
      const nextSlots = result.wheel;
      if (nextSlots.length < 2 || result.slotIndex >= nextSlots.length) {
        throw new Error("Cấu hình vòng quay từ máy chủ không hợp lệ.");
      }

      setSlots(nextSlots);
      const segmentAngle = 360 / nextSlots.length;
      const targetAngle =
        (360 - (result.slotIndex + 0.5) * segmentAngle) % 360;
      const remaining =
        (targetAngle - (currentRotation.current % 360) + 360) % 360;
      currentRotation.current += 360 * 5 + remaining;
      setRotation(currentRotation.current);
      setOutcome(result);
      if (result.reward) {
        sessionStorage.setItem("cusc-zalo-mini-app-latest-prize", result.reward);
      }

      window.setTimeout(() => setSpinning(false), 5100);
    } catch (error) {
      setSpinning(false);
      if (error instanceof Error && error.message.includes("lượt quay duy nhất")) {
        setSpinUsed(true);
      }
      openSnackbar({
        icon: true,
        type: "error",
        text:
          error instanceof Error ? error.message : "Không thể quay thưởng.",
        duration: 5000,
      });
    }
  };

  return (
    <div className="grid justify-items-center gap-5 p-3">
      {loading ? (
        <div className="grid aspect-square w-full max-w-[340px] place-items-center rounded-full bg-white/80 text-sm text-gray-500">
          Đang tải vòng quay...
        </div>
      ) : slots.length < 2 ? (
        <div className="w-full rounded-2xl bg-white p-5 text-center text-sm text-gray-600">
          Vòng quay chưa được cấu hình đủ 2 ô. Vui lòng liên hệ quản trị viên.
        </div>
      ) : (
        <WheelGraphic slots={slots} rotation={rotation} spinning={spinning} />
      )}

      <button
        type="button"
        onClick={spin}
        disabled={
          spinning || spinUsed || checkingSpin || loading || slots.length < 2
        }
        className="rounded-full bg-[#0068FF] px-10 py-3 font-bold text-white shadow-lg disabled:opacity-60"
      >
        {spinning
          ? "Đang quay..."
          : checkingSpin
          ? "Đang kiểm tra lượt..."
          : spinUsed
          ? "Đã dùng lượt quay"
          : "QUAY NGAY"}
      </button>

      {spinUsed && !spinning && (
        <p className="text-center text-sm text-gray-600">
          Mỗi người chơi chỉ có một lượt quay. Bạn đã sử dụng lượt này.
        </p>
      )}

      {outcome && !spinning && (
        <div className="w-full rounded-2xl bg-white p-4 text-center shadow">
          <div role="status">
            <p className="text-sm text-gray-500">
              Ô số {outcome.slotIndex + 1}
            </p>
            <p className="mt-1 text-lg font-bold text-[#0068FF]">
              {outcome.reward || "Chúc bạn may mắn lần sau!"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
