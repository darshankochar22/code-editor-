"use client";

import { useCallback, useRef, useEffect } from "react";
import type { LogMessage } from "@/components/Terminal";

interface UseTerminalLoggingProps {
  onLogsUpdate: (logs: LogMessage[]) => void;
}

export function useTerminalLogging({ onLogsUpdate }: UseTerminalLoggingProps) {
  const messageCountRef = useRef(0);

  // Log to terminal
  const logToTerminal = useCallback(
    (message: string, type: "log" | "error" | "warn" | "info" = "log") => {
      const now = new Date();
      const timestamp = now.toLocaleTimeString();
      onLogsUpdate([
        {
          id: messageCountRef.current++,
          message,
          timestamp,
          type,
        },
      ]);
    },
    [onLogsUpdate]
  );

  // Intercept console methods
  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;

    const addLog = (
      message: unknown,
      type: "log" | "error" | "warn" | "info"
    ) => {
      const now = new Date();
      const timestamp = now.toLocaleTimeString();
      const formattedMessage =
        typeof message === "string"
          ? message
          : JSON.stringify(message, null, 2);

      onLogsUpdate([
        {
          id: messageCountRef.current++,
          message: formattedMessage,
          timestamp,
          type,
        },
      ]);
    };

    console.log = (...args) => {
      addLog(args.length === 1 ? args[0] : args.join(" "), "log");
      originalLog.apply(console, args);
    };

    console.error = (...args) => {
      addLog(args.length === 1 ? args[0] : args.join(" "), "error");
      originalError.apply(console, args);
    };

    console.warn = (...args) => {
      addLog(args.length === 1 ? args[0] : args.join(" "), "warn");
      originalWarn.apply(console, args);
    };

    console.info = (...args) => {
      addLog(args.length === 1 ? args[0] : args.join(" "), "info");
      originalInfo.apply(console, args);
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      console.info = originalInfo;
    };
  }, [onLogsUpdate]);

  return {
    logToTerminal,
    messageCountRef,
  };
}

