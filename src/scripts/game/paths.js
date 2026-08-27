// The game fetches its images and audio by runtime URL rather than importing
// them, so they live in public/game/ and have to resolve against the deployed
// base path (astro.config.ts sets one). A bare "img/bird.png" would resolve
// against whatever the current document URL happens to be, which breaks the
// moment the page is served without a trailing slash.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function asset(path) {
  return `${BASE}/game/${path}`;
}
