import type {
  InjectFace,
  PropsLocale,
  PropsRuntime,
} from "@deepseek-ai/dsh-client-ui-slots";
import {
  Button,
  Menu,
  MenuItem,
  MenuTrigger,
} from "@deepseek-ai/dsh-client-ui-primitives";
import { useState, useEffect, useCallback, useRef } from "react";

export interface VoiceCoreClientFace {
  getProviders: () => Array<{ id: string; name: string }>;
  getActiveProvider: () => string | null;
  setActiveProvider: (id: string) => boolean;
  startSession: (providerId?: string) => Promise<void>;
  stopSession: () => Promise<void>;
  sessionState: {
    active: boolean;
    providerId: string | null;
    status: string;
    error: string | null;
  };
}

export type VoiceButtonSlotProps = PropsRuntime<"conversation.input.right"> &
  PropsLocale<"voice-core"> &
  InjectFace<VoiceCoreClientFace>;

type VoiceButtonState = "idle" | "connecting" | "recording" | "error";

// 内置矢量图标，统一视觉语言与尺寸
const Icons = {
  Mic: () => (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  ),
  Stop: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  ),
  Spinner: () => (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ animation: "spin 1s linear infinite" }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  ),
  Alert: () => (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  ),
  ChevronDown: () => (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
  Check: () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
};

export function VoiceButtonSlot(props: VoiceButtonSlotProps) {
  const t = props.t as unknown as (key: string) => string;
  const face = props.face as VoiceCoreClientFace;

  const [state, setState] = useState<VoiceButtonState>("idle");
  const [providers, setProviders] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setProviders(face.getProviders());
    setActiveProviderId(face.getActiveProvider());
  }, [face]);

  useEffect(() => {
    const sessionState = face.sessionState;
    if (sessionState.active) {
      if (sessionState.status === "connecting") {
        setState("connecting");
      } else if (
        ["connected", "listening", "speaking"].includes(sessionState.status)
      ) {
        setState("recording");
      } else if (sessionState.status === "error") {
        setState("error");
      }
    } else {
      setState("idle");
    }
  }, [face.sessionState]);

  const handleStart = useCallback(async () => {
    let targetProviderId = activeProviderId;
    if (!targetProviderId && providers.length > 0) {
      targetProviderId = providers[0].id;
      face.setActiveProvider(targetProviderId);
      setActiveProviderId(targetProviderId);
    }

    setState("connecting");
    try {
      await face.startSession(targetProviderId || undefined);
    } catch (error) {
      console.error("Failed to start voice session:", error);
      setState("error");
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setState("idle"), 3000);
    }
  }, [face, activeProviderId, providers]);

  const handleStop = useCallback(async () => {
    try {
      await face.stopSession();
    } catch (error) {
      console.error("Failed to stop voice session:", error);
    }
    setState("idle");
  }, [face]);

  const handleProviderSelect = useCallback(
    (providerId: string) => {
      face.setActiveProvider(providerId);
      setActiveProviderId(providerId);
      setShowMenu(false);
    },
    [face],
  );

  const renderContent = () => {
    switch (state) {
      case "connecting":
        return {
          icon: <Icons.Spinner />,
          label: t("voiceButtonConnecting"),
          variant: "secondary" as const,
        };
      case "recording":
        return {
          icon: (
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "#ef4444",
                  boxShadow: "0 0 0 0 rgba(239, 68, 68, 0.7)",
                  animation: "pulse 1.5s infinite",
                }}
              />
              <Icons.Stop />
            </span>
          ),
          label: t("voiceButtonStop"),
          variant: "destructive" as const,
        };
      case "error":
        return {
          icon: <Icons.Alert />,
          label: t("voiceButtonError"),
          variant: "destructive" as const,
        };
      default:
        return {
          icon: <Icons.Mic />,
          label: t("voiceButtonStart"),
          variant: "secondary" as const,
        };
    }
  };

  const { icon, label, variant } = renderContent();
  const isDisabled = state === "connecting" || providers.length === 0;
  const hasMultipleProviders = providers.length > 1;

  return (
    <>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          height: "32px",
          borderRadius: "8px",
          boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
          overflow: "hidden",
        }}
      >
        {/* 主交互按钮 */}
        <Button
          variant={variant}
          size="sm"
          disabled={isDisabled}
          onClick={state === "recording" ? handleStop : handleStart}
          title={label}
          style={{
            height: "100%",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "0 10px",
            fontSize: "12px",
            fontWeight: 500,
            borderTopRightRadius: hasMultipleProviders ? 0 : "8px",
            borderBottomRightRadius: hasMultipleProviders ? 0 : "8px",
            transition: "background-color 0.2s, color 0.2s",
          }}
        >
          {icon}
          <span>{label}</span>
        </Button>

        {/* 模型/提供商下拉触发器（Split Button 结构） */}
        {hasMultipleProviders && (
          <MenuTrigger>
            <Button
              variant={variant}
              size="sm"
              disabled={state === "recording" || state === "connecting"}
              style={{
                height: "100%",
                padding: "0 6px",
                minWidth: "22px",
                borderLeft: "1px solid rgba(128, 128, 128, 0.2)",
                borderTopLeftRadius: 0,
                borderBottomLeftRadius: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label={t("selectProvider")}
            >
              <Icons.ChevronDown />
            </Button>
            <Menu
              side="bottom"
              align="end"
              open={showMenu}
              onOpenChange={setShowMenu}
              style={{ minWidth: "140px", padding: "4px" }}
            >
              {providers.map((provider) => {
                const isSelected = activeProviderId === provider.id;
                return (
                  <MenuItem
                    key={provider.id}
                    onSelect={() => handleProviderSelect(provider.id)}
                    disabled={state === "recording" || state === "connecting"}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "13px",
                      padding: "6px 8px",
                      borderRadius: "4px",
                      fontWeight: isSelected ? 500 : 400,
                    }}
                  >
                    <span>{provider.name}</span>
                    {isSelected && (
                      <span
                        style={{
                          color: "var(--accent-color, #2563eb)",
                          marginLeft: "8px",
                        }}
                      >
                        <Icons.Check />
                      </span>
                    )}
                  </MenuItem>
                );
              })}
            </Menu>
          </MenuTrigger>
        )}
      </div>
    </>
  );
}
