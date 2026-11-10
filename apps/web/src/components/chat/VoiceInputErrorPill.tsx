import { MICROPHONE_PERMISSION_ERROR } from "@t3tools/client-runtime/voice-input";
import { useNavigate } from "@tanstack/react-router";
import { RotateCcwIcon, SettingsIcon, XIcon } from "lucide-react";

import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { VoiceInputPill } from "./VoiceInputPill";
import { t } from "~/i18n";

const VOICE_ERROR_LABELS: Record<string, string> = {
  [MICROPHONE_PERMISSION_ERROR]: t("Microphone access needed"),
  "Microphone access is required for voice input.": t("Microphone access needed"),
  "This draft is no longer available.": t("Draft unavailable"),
  "Another voice recording is already active.": t("Another recording active"),
  "Voice transcription is not available.": t("Voice input unavailable"),
  "Voice transcription is still finishing. Try again shortly.": t("Transcription still busy"),
  "Voice transcription is not available for this language.": t("Language unsupported"),
  "Could not prepare voice transcription.": t("Couldn’t prepare dictation"),
  "Could not start voice recording.": t("Couldn’t start recording"),
  "Voice recording was interrupted.": t("Recording interrupted"),
  "Could not finish voice recording.": t("Couldn’t finish recording"),
  "Could not transcribe this recording.": t("Transcription failed"),
  "Voice transcription on this environment failed.": t("Transcription failed"),
  "The draft changed while voice input was running. The transcript was not added.":
    t("Draft changed"),
  "No speech was detected.": t("No speech detected"),
  "Microphone processing failed.": t("Microphone processing failed"),
  "The microphone disconnected.": t("Microphone disconnected"),
};

function voiceErrorLabel(error: string | null): string {
  return (error && VOICE_ERROR_LABELS[error]) || "Voice input failed";
}

export function VoiceInputErrorPill(props: {
  error: string | null;
  errorAction: "retry" | "settings" | null;
  disabled?: boolean;
  cancelShortcutLabel?: string | null;
  onRetry(): void;
  onDismiss(): void;
}) {
  const navigate = useNavigate();
  const openSettings = props.errorAction === "settings";
  const actionLabel = openSettings
    ? "Open voice settings"
    : props.error === "Could not transcribe this recording." ||
        props.error === "Voice transcription on this environment failed."
      ? "Retry transcription"
      : "Record again";
  return (
    <VoiceInputPill>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              size="icon-sm-pill"
              variant="ghost"
              aria-label={t("Dismiss voice input error")}
              onPointerDown={(event) => event.preventDefault()}
              onClick={props.onDismiss}
            >
              <XIcon />
            </Button>
          }
        />
        <TooltipPopup side="top">
          {t("Dismiss voice input error {0}", [
            props.cancelShortcutLabel ? ` (${props.cancelShortcutLabel})` : "",
          ])}
        </TooltipPopup>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              tabIndex={0}
              role="status"
              aria-label={props.error ?? t("Voice input failed")}
              className="min-w-0 flex-1 truncate text-sm text-destructive"
            />
          }
        >
          {voiceErrorLabel(props.error)}
        </TooltipTrigger>
        <TooltipPopup side="top">{props.error ?? t("Voice input failed")}</TooltipPopup>
      </Tooltip>
      {props.errorAction ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                size="icon-sm-pill"
                variant="ghost"
                aria-label={actionLabel}
                disabled={props.disabled}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (openSettings) {
                    props.onDismiss();
                    void navigate({ to: "/settings/voice" });
                  } else {
                    props.onRetry();
                  }
                }}
              >
                {openSettings ? <SettingsIcon /> : <RotateCcwIcon />}
              </Button>
            }
          />
          <TooltipPopup side="top">{actionLabel}</TooltipPopup>
        </Tooltip>
      ) : null}
    </VoiceInputPill>
  );
}
