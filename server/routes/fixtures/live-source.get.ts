import { getSetting } from "@agent-native/core/settings";
import { defineEventHandler, setResponseHeader } from "h3";

import {
  LIVE_SETTING,
  LIVE_VERSIONS,
  liveFixtureHtml,
  type LiveVersion,
} from "../../../fixtures/live-source.js";

// Public test page (see fixtures/live-source.ts). Not app data: it only
// renders one of three fixed versions.
export default defineEventHandler(async (event) => {
  const stored = (await getSetting(LIVE_SETTING))?.version;
  const version: LiveVersion = LIVE_VERSIONS.includes(stored as LiveVersion)
    ? (stored as LiveVersion)
    : "a";
  setResponseHeader(event, "content-type", "text/html; charset=utf-8");
  setResponseHeader(event, "cache-control", "no-store");
  return liveFixtureHtml(version);
});
