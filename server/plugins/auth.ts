import { createToolkitAuthPlugin } from "@agent-native/toolkit/app/auth/server";

export default createToolkitAuthPlugin({
  workspaceAppPublicPaths: ["/"],
  rootAuth: true,
  marketing: false,
  // Published receipts are proof for anyone with the link: the receipt page
  // and its read/verify actions work signed out. The actions only answer
  // for published documents.
  publicPaths: [
    "/r",
    "/_agent-native/actions/get-receipt",
    "/_agent-native/actions/verify-receipt",
    "/_agent-native/actions/recheck-receipt-live",
  ],
});
