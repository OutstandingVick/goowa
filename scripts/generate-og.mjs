import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const [josefinPath, chakraPath] = process.argv.slice(2);
if (!josefinPath || !chakraPath) {
  throw new Error("Usage: node scripts/generate-og.mjs <JosefinSans.ttf> <ChakraPetch-Bold.ttf>");
}

const [josefin, chakra, mark] = await Promise.all([
  fs.readFile(josefinPath),
  fs.readFile(chakraPath),
  fs.readFile(new URL("../public/brand/goowa-mark-white.svg", import.meta.url)),
]);

const whiteMark = mark.toString("utf8").replaceAll("#723CD6", "#FCFFFF");
const markData = `data:image/svg+xml;base64,${Buffer.from(whiteMark).toString("base64")}`;
const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <font-face font-family="Josefin Sans"><font-face-src><font-face-uri href="data:font/ttf;base64,${josefin.toString("base64")}"/></font-face-src></font-face>
    <font-face font-family="Chakra Petch"><font-face-src><font-face-uri href="data:font/ttf;base64,${chakra.toString("base64")}"/></font-face-src></font-face>
    <radialGradient id="glow" cx="50%" cy="35%" r="75%">
      <stop offset="0" stop-color="#B382CB"/>
      <stop offset="0.52" stop-color="#814DDE"/>
      <stop offset="1" stop-color="#723CD6"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <image href="${markData}" x="342" y="151" width="120" height="120"/>
  <text x="492" y="245" fill="#FCFFFF" font-family="Chakra Petch" font-size="112" font-weight="700" letter-spacing="2">GOOWA</text>
  <text x="600" y="430" fill="#FCFFFF" text-anchor="middle" font-family="Josefin Sans" font-size="47" font-weight="600">AI drafts the research. You approve every claim.</text>
  <text x="600" y="500" fill="#FCFFFF" fill-opacity="0.78" text-anchor="middle" font-family="Josefin Sans" font-size="27" font-weight="400">Claim-level verification · tamper-evident receipts</text>
</svg>`;

await sharp(Buffer.from(svg))
  .png()
  .toFile(fileURLToPath(new URL("../public/goowa-og.png", import.meta.url)));
