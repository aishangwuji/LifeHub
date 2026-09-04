import type {
  InjectFace,
  PropsLocale,
  PropsRuntime,
} from "@deepseek-ai/dsh-client-ui-slots";
import { useEffect, useRef, useState, useCallback } from "react";

export interface VoiceCoreClientFace {
  sessionState: {
    active: boolean;
    providerId: string | null;
    status: string;
    error: string | null;
  };
}

export type WaveformOverlaySlotProps = PropsRuntime<"shell.overlay"> &
  PropsLocale<"voice-core"> &
  InjectFace<VoiceCoreClientFace>;

const BAR_COUNT = 28;
const CANVAS_WIDTH = 140;
const CANVAS_HEIGHT = 32;

export function WaveformOverlaySlot(props: WaveformOverlaySlotProps) {
  const t = props.t as unknown as (key: string) => string;
  const face = props.face as VoiceCoreClientFace;

  const [visible, setVisible] = useState(false);
  const [statusText, setStatusText] = useState("");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const statusRef = useRef(face.sessionState.status);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 保持状态与动画帧实时同步
  statusRef.current = face.sessionState.status;

  // Canvas 绘制核心逻辑（零 React Re-render 开销）
  const startCanvasAnimation = useCallback(() => {
    if (animationRef.current) return;

    let phase = 0;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animationRef.current = requestAnimationFrame(render);
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = CANVAS_WIDTH;
      const height = CANVAS_HEIGHT;

      ctx.clearRect(0, 0, width, height);

      const status = statusRef.current;
      const isSpeaking = status === "speaking";
      const isListening = status === "listening";
      const isConnecting = status === "connecting";

      phase += isSpeaking ? 0.08 : 0.04;

      const barWidth = 3;
      const barSpacing = (width - BAR_COUNT * barWidth) / (BAR_COUNT - 1);

      for (let i = 0; i < BAR_COUNT; i++) {
        // 汉宁窗包络衰减：让两侧自然低平，中心高耸更具声学质感
        const envelope = Math.sin((i / (BAR_COUNT - 1)) * Math.PI);

        let intensity = 0.15;
        if (isSpeaking) {
          // 说话状态：多频正弦叠加与动态呼吸
          intensity =
            0.35 +
            Math.sin(phase * 1.5 + i * 0.35) * 0.3 +
            Math.cos(phase * 0.8 + i * 0.15) * 0.2;
        } else if (isListening) {
          // 倾听状态：平缓微动波形
          intensity = 0.25 + Math.sin(phase + i * 0.25) * 0.2;
        } else if (isConnecting) {
          // 连接状态：单向微光流动
          intensity = 0.2 + Math.sin(phase * 2 - i * 0.3) * 0.15;
        }

        const normalizedHeight = Math.max(
          0.08,
          Math.min(1, intensity * envelope),
        );
        const barHeight = Math.max(4, normalizedHeight * (height - 4));
        const x = i * (barWidth + barSpacing);
        const y = (height - barHeight) / 2; // 上下居中对称生长

        // 渐变色彩映射状态
        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        if (isSpeaking) {
          gradient.addColorStop(0, "#60a5fa");
          gradient.addColorStop(1, "#a855f7"); // AI说话时显示紫蓝流体色
        } else {
          gradient.addColorStop(0, "#38bdf8");
          gradient.addColorStop(1, "#2563eb"); // 录音/倾听时纯净科技蓝
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);
  }, []);

  const stopCanvasAnimation = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  // 监听会话生命周期
  useEffect(() => {
    const { active, status, error } = face.sessionState;

    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }

    if (
      active &&
      ["connecting", "connected", "listening", "speaking"].includes(status)
    ) {
      setVisible(true);
      if (status === "connecting") setStatusText(t("waveformConnecting"));
      else if (status === "listening") setStatusText(t("waveformListening"));
      else if (status === "speaking") setStatusText(t("waveformSpeaking"));
      else setStatusText(t("statusConnected"));

      startCanvasAnimation();
    } else {
      stopCanvasAnimation();
      if (error) {
        setStatusText(t("statusError"));
        setVisible(true);
        errorTimerRef.current = setTimeout(() => setVisible(false), 3000);
      } else {
        setVisible(false);
      }
    }

    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, [face.sessionState, t, startCanvasAnimation, stopCanvasAnimation]);

  // Canvas 分辨率缩放适配
  useEffect(() => {
    if (!visible || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_WIDTH * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
  }, [visible]);

  if (!visible) return null;

  const isError = Boolean(face.sessionState.error);

  return (
    <>
      <style>{`
        @keyframes dshVoiceOverlayEnter {
          from { opacity: 0; transform: translate(-50%, 16px) scale(0.96); }
          to { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
        @keyframes dshStatusPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>

      <div
        style={{
          position: "fixed",
          bottom: "100px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "6px 16px 6px 14px",
          height: "48px",
          borderRadius: "24px",
          background: "rgba(23, 23, 27, 0.78)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow:
            "0 12px 32px rgba(0, 0, 0, 0.28), 0 2px 6px rgba(0, 0, 0, 0.12)",
          pointerEvents: "none",
          userSelect: "none",
          animation: "dshVoiceOverlayEnter 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* 状态呼吸光点 */}
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: isError ? "#ef4444" : "#22c55e",
            boxShadow: isError
              ? "0 0 10px rgba(239, 68, 68, 0.8)"
              : "0 0 10px rgba(34, 197, 94, 0.8)",
            animation: isError
              ? "none"
              : "dshStatusPulse 2s ease-in-out infinite",
            flexShrink: 0,
          }}
        />

        {/* 高性能音频波形 Canvas */}
        {!isError && (
          <canvas
            ref={canvasRef}
            style={{
              width: `${CANVAS_WIDTH}px`,
              height: `${CANVAS_HEIGHT}px`,
              display: "block",
            }}
          />
        )}

        {/* 状态描述 */}
        <span
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: isError ? "#fca5a5" : "#f3f4f6",
            letterSpacing: "0.01em",
            whiteSpace: "nowrap",
          }}
        >
          {statusText}
        </span>
      </div>
    </>
  );
}
