import "./index.css";
import React from "react";
import { render } from "react-dom";
import * as Sentry from "@sentry/react";
import { App } from "./App";

// Initialize Sentry error monitoring (no-op if DSN not set)
const sentryDsn = (import.meta as any).env?.VITE_SENTRY_DSN || "";
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.2,
    environment: (import.meta as any).env?.MODE || "production",
    // Don't send PII
    sendDefaultPii: false,
  });
}

render(<App />, document.getElementById("root"));