import { defineAppConfig } from "@agent-native/core/server";

export default defineAppConfig({
  app: {
    // This name appears in transactional emails. Change it to your product name.
    name: "Goowa",
    // The source template keeps a renamed app from inheriting first-party email branding.
    sourceTemplate: "chat",
    // Keep the template's authenticated entry explicit after renaming the app.
    // Keep the public landing page at the canonical root. The product entry
    // lives at /app and is linked explicitly from every marketing CTA.
    homePath: "/",
    // Optional: use your own absolute HTTPS logo URL in transactional emails.
    // logoUrl: "https://example.com/logo.png",
  },
});
