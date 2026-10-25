import { useCallback, useEffect, useRef, useState } from "react";

type RecognitionResult = {
  isFinal: boolean;
  length: number;
  [index: number]: { transcript: string };
};
type RecognitionEvent = {
  resultIndex: number;
  results: { length: number; [index: number]: RecognitionResult };
};
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type VoiceWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
export type VoiceMode = "browser" | "recording" | "unavailable";

const MAX_RECORDING_BYTES = 10 * 1024 * 1024;
const MAX_RECORDING_MS = 60_000;

function getRecognition() {
  if (typeof window === "undefined") return undefined;
  const browser = window as VoiceWindow;
  return browser.SpeechRecognition || browser.webkitSpeechRecognition;
}

function microphoneError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError")
    return "Microphone access was denied. Allow microphone access in your browser’s site settings, then try again. On macOS, also check System Settings → Privacy & Security → Microphone.";
  if (name === "NotFoundError" || name === "DevicesNotFoundError")
    return "No microphone was found. Connect or enable a microphone, then try again.";
  if (name === "NotReadableError" || name === "TrackStartError")
    return "Your microphone is busy or unavailable. Close other apps using it and check your system’s microphone settings.";
  if (name === "SecurityError")
    return "Your browser blocked microphone access. Open Orbit on HTTPS or 127.0.0.1, and allow microphone access for the site.";
  return "The microphone could not start. Check your browser and system microphone permissions, or type your message instead.";
}

/** Dictation always fills a draft. Sending that draft is a separate user action. */
export function useVoice({
  onTranscript,
  aiConfigured,
}: {
  onTranscript: (text: string) => void;
  aiConfigured: boolean;
}) {
  const nativeAvailable = Boolean(getRecognition());
  const recorderAvailable =
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia);
  const [mode, setMode] = useState<VoiceMode>(
    nativeAvailable
      ? "browser"
      : recorderAvailable && aiConfigured
        ? "recording"
        : "unavailable",
  );
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const mounted = useRef(true);
  const generation = useRef(0);
  const recognition = useRef<Recognition | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const upload = useRef<AbortController | null>(null);
  const active = useRef(false);
  const acquiring = useRef(false);
  const preferRecording = useRef(false);

  const releaseMicrophone = useCallback(() => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => {
    if (!active.current && !transcribing)
      setMode(
        preferRecording.current && recorderAvailable && aiConfigured
          ? "recording"
          : nativeAvailable
            ? "browser"
            : recorderAvailable && aiConfigured
              ? "recording"
              : "unavailable",
      );
  }, [aiConfigured, nativeAvailable, recorderAvailable, transcribing]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
      active.current = false;
      try {
        recognition.current?.abort();
      } catch {
        // A recognizer that has already ended may reject abort().
      }
      if (recorder.current?.state === "recording") recorder.current.stop();
      upload.current?.abort();
      releaseMicrophone();
    };
  }, [releaseMicrophone]);

  const startRecording = useCallback(async () => {
    if (active.current || recognition.current || upload.current) return;
    setError("");
    setInterim("");
    if (!window.isSecureContext) {
      setError(
        "Microphone access needs HTTPS or a local development address. Open Orbit at http://127.0.0.1:5173 on this computer, or use HTTPS when hosted.",
      );
      return;
    }
    if (!aiConfigured) {
      setError(
        "Recorded dictation needs an OpenAI API key on your Orbit server. Browser dictation may still work in Chrome or Safari; typing is always available.",
      );
      return;
    }
    if (!recorderAvailable) {
      setError(
        "Audio recording isn’t supported in this browser. Try a current version of Chrome or Safari, or type your message.",
      );
      return;
    }
    const run = ++generation.current;
    active.current = true;
    acquiring.current = true;
    setMode("recording");
    setListening(true);
    try {
      const microphone = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (!mounted.current || run !== generation.current) {
        microphone.getTracks().forEach((track) => track.stop());
        return;
      }
      acquiring.current = false;
      stream.current = microphone;
      const mime = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/webm",
        "audio/ogg;codecs=opus",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const audio = new MediaRecorder(
        microphone,
        mime ? { mimeType: mime } : undefined,
      );
      recorder.current = audio;
      const chunks: BlobPart[] = [];
      let bytes = 0;
      let failed = false;
      audio.ondataavailable = (event) => {
        if (!event.data.size) return;
        bytes += event.data.size;
        if (bytes > MAX_RECORDING_BYTES) {
          failed = true;
          if (mounted.current && run === generation.current)
            setError(
              "That recording was too large. Try a shorter message, up to one minute.",
            );
          if (audio.state === "recording") audio.stop();
          return;
        }
        chunks.push(event.data);
      };
      audio.onerror = () => {
        failed = true;
        if (!mounted.current || run !== generation.current) {
          microphone.getTracks().forEach((track) => track.stop());
          return;
        }
        if (mounted.current && run === generation.current) {
          setError(
            "Audio recording stopped unexpectedly. Please try again, or type your message.",
          );
          setListening(false);
        }
        active.current = false;
        recorder.current = null;
        releaseMicrophone();
      };
      audio.onstop = async () => {
        if (!mounted.current || run !== generation.current) {
          microphone.getTracks().forEach((track) => track.stop());
          return;
        }
        releaseMicrophone();
        recorder.current = null;
        active.current = false;
        if (!mounted.current || run !== generation.current) return;
        setListening(false);
        if (failed) return;
        if (!bytes) {
          setError(
            "The recording was empty. Check your microphone and try again.",
          );
          return;
        }
        const controller = new AbortController();
        upload.current = controller;
        const timeout = setTimeout(() => controller.abort(), 45_000);
        setTranscribing(true);
        try {
          const blob = new Blob(chunks, {
            type: audio.mimeType || mime || "audio/webm",
          });
          const response = await fetch("/api/transcribe", {
            method: "POST",
            headers: { "Content-Type": blob.type },
            body: blob,
            signal: controller.signal,
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok)
            throw new Error(
              typeof body.error === "string"
                ? body.error
                : "Transcription is unavailable. Check the OpenAI API configuration on your server and try again.",
            );
          if (!mounted.current || run !== generation.current) return;
          if (typeof body.text !== "string" || !body.text.trim())
            setError(
              "No speech was found in that recording. Try speaking a little closer to your microphone.",
            );
          else onTranscriptRef.current(body.text.trim());
        } catch (cause) {
          if (!mounted.current || run !== generation.current) return;
          setError(
            cause instanceof Error && cause.name === "AbortError"
              ? "Transcription timed out. Try a shorter recording or check your connection."
              : cause instanceof Error
                ? cause.message
                : "Couldn’t transcribe your recording. Please try again.",
          );
        } finally {
          clearTimeout(timeout);
          if (upload.current === controller) upload.current = null;
          if (mounted.current && run === generation.current)
            setTranscribing(false);
        }
      };
      audio.start(500);
      timer.current = setTimeout(() => {
        if (audio.state === "recording") audio.stop();
      }, MAX_RECORDING_MS);
    } catch (cause) {
      if (!mounted.current || run !== generation.current) return;
      releaseMicrophone();
      acquiring.current = false;
      active.current = false;
      if (mounted.current && run === generation.current) {
        setListening(false);
        setError(microphoneError(cause));
      }
    }
  }, [aiConfigured, recorderAvailable, releaseMicrophone]);

  const start = useCallback(() => {
    if (active.current || recognition.current || upload.current) return;
    setError("");
    setInterim("");
    if (!window.isSecureContext) {
      setError(
        "Microphone access needs HTTPS or a local address. Open Orbit at http://127.0.0.1:5173 on this computer, or use HTTPS when hosted.",
      );
      return;
    }
    const Speech = getRecognition();
    if (
      (!Speech || preferRecording.current) &&
      recorderAvailable &&
      aiConfigured
    ) {
      void startRecording();
      return;
    }
    if (!Speech) {
      setError(
        "This browser doesn’t offer speech recognition. Try Chrome or Safari, or enable an OpenAI API key for recorded dictation. You can always type your message.",
      );
      return;
    }
    const run = ++generation.current;
    let recognizer: Recognition;
    try {
      recognizer = new Speech();
    } catch (cause) {
      setError(microphoneError(cause));
      return;
    }
    recognition.current = recognizer;
    active.current = true;
    setMode("browser");
    recognizer.lang = navigator.language || "en-US";
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.maxAlternatives = 1;
    const finalResults = new Set<number>();
    recognizer.onresult = (event) => {
      if (!mounted.current || run !== generation.current) return;
      const pending: string[] = [];
      const completed: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript?.trim();
        if (!text) continue;
        if (result.isFinal && !finalResults.has(i)) {
          finalResults.add(i);
          completed.push(text);
        } else if (!result.isFinal) pending.push(text);
      }
      setInterim(pending.join(" "));
      if (completed.length) onTranscriptRef.current(completed.join(" "));
    };
    recognizer.onerror = ({ error: code }) => {
      if (!mounted.current || run !== generation.current) return;
      if (code === "aborted") return;
      if (code === "not-allowed" || code === "service-not-allowed")
        setError(
          "Speech recognition was denied. Allow microphone access in your browser’s site settings and macOS Privacy & Security → Microphone. Then try again.",
        );
      else if (code === "audio-capture")
        setError(
          "Your browser could not access a microphone. Check the selected input device and close other apps using it.",
        );
      else if (code === "no-speech")
        setError(
          "No speech was heard. Check your microphone input and try speaking a little closer.",
        );
      else if (code === "network" || code === "language-not-supported") {
        if (recorderAvailable && aiConfigured) {
          preferRecording.current = true;
          setMode("recording");
          setError(
            "Your browser’s dictation service is unavailable. Click the microphone again to record instead; the recording will be sent to OpenAI for transcription, then placed in your draft.",
          );
        } else
          setError(
            "Your browser’s dictation service is unavailable. Check your connection or try Chrome/Safari. Enable an OpenAI API key to use recorded dictation instead.",
          );
      } else
        setError(
          `Speech recognition stopped (${code}). Please try again, or type your message.`,
        );
      setListening(false);
      setInterim("");
      active.current = false;
      if (recognition.current === recognizer) recognition.current = null;
      try {
        recognizer.abort();
      } catch {
        // The browser may already have stopped its speech service.
      }
    };
    recognizer.onend = () => {
      if (recognition.current === recognizer) recognition.current = null;
      if (!mounted.current || run !== generation.current) return;
      active.current = false;
      setListening(false);
      setInterim("");
    };
    try {
      recognizer.start();
      setListening(true);
    } catch (cause) {
      recognition.current = null;
      active.current = false;
      setListening(false);
      setError(microphoneError(cause));
    }
  }, [aiConfigured, recorderAvailable, startRecording]);

  const stop = useCallback(() => {
    if (acquiring.current) {
      generation.current++;
      acquiring.current = false;
      active.current = false;
      setListening(false);
      return;
    }
    if (recorder.current?.state === "recording") {
      recorder.current.stop();
      return;
    }
    try {
      recognition.current?.stop();
    } catch {
      recognition.current = null;
      active.current = false;
    }
    setListening(false);
  }, []);

  return {
    supported: nativeAvailable || (recorderAvailable && aiConfigured),
    canRecord: recorderAvailable && aiConfigured,
    listening,
    transcribing,
    interim,
    error,
    start,
    stop,
    startRecording,
    clearError: useCallback(() => setError(""), []),
    mode,
  };
}
