import { createAuthPlugin } from "@agent-native/core/server";

export default createAuthPlugin({
  rootAuth: false,
  // Published receipts are proof for anyone with the link: the receipt page
  // and its read/verify actions work signed out. The actions only answer
  // for published documents.
  publicPaths: [
    "/r",
    "/fixtures/live-source",
    "/_agent-native/actions/get-receipt",
    "/_agent-native/actions/verify-receipt",
    "/_agent-native/actions/recheck-receipt-live",
  ],
});
