// Nitro's catch-all does not match "/". Serve the public landing route
// through the same React Router SSR handler as every other page.
export { default } from "./[...page].get.js";
