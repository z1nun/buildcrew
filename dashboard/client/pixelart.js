/**
 * Procedural pixel art textures.
 * Draws 16x16 tileable patterns via Canvas API and registers them with Phaser.
 * Styles: carpet (cozy), wood (planks), stone (walls), grass (outdoor).
 * Each tile has low-res palette + intentional pixel edges (no smoothing).
 */

const TILE = 16;

/**
 * Create pixel textures and register them with a Phaser Textures manager.
 * @param {Phaser.Textures.TextureManager} textures
 */
export function buildPixelTextures(textures) {
  const carpet = makeCarpet();
  const wood = makeWood();
  const stone = makeStone();
  const grass = makeGrass();
  const check = makeCheck();

  textures.addCanvas("tile-carpet", carpet);
  textures.addCanvas("tile-wood", wood);
  textures.addCanvas("tile-stone", stone);
  textures.addCanvas("tile-grass", grass);
  textures.addCanvas("tile-check", check);
}

// ---- tile generators ----

function makeCarpet() {
  // Warm red-brown carpet with subtle dots pattern
  const c = newCanvas(TILE, TILE);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#6b4632";
  ctx.fillRect(0, 0, TILE, TILE);
  // Darker speckles
  ctx.fillStyle = "#4a301f";
  speckle(ctx, 0x1337, 14);
  // Warm highlights
  ctx.fillStyle = "#8f6244";
  speckle(ctx, 0xaaaa, 8);
  // Border outline (subtle)
  ctx.fillStyle = "#3a2418";
  for (let x = 0; x < TILE; x += 4) {
    ctx.fillRect(x, 0, 1, 1);
    ctx.fillRect(0, x, 1, 1);
  }
  return c;
}

function makeWood() {
  // Wood plank floor — horizontal bands with grain marks
  const c = newCanvas(TILE, TILE);
  const ctx = c.getContext("2d");
  const planks = ["#6e4a2a", "#805533", "#6e4a2a", "#805533"];
  const plankH = TILE / planks.length;
  for (let i = 0; i < planks.length; i++) {
    ctx.fillStyle = planks[i];
    ctx.fillRect(0, i * plankH, TILE, plankH);
    // plank separator line (darker)
    ctx.fillStyle = "#3d2617";
    ctx.fillRect(0, i * plankH + plankH - 1, TILE, 1);
  }
  // Random grain marks per plank
  ctx.fillStyle = "#50331d";
  const marks = [[2,1],[6,5],[11,1],[3,9],[9,13],[13,5]];
  for (const [x, y] of marks) ctx.fillRect(x, y, 2, 1);
  return c;
}

function makeStone() {
  // Gray stone brick wall, 2 rows with offset seams
  const c = newCanvas(TILE, TILE);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#58504a";
  ctx.fillRect(0, 0, TILE, TILE);
  // Stones — lighter
  ctx.fillStyle = "#6e6660";
  // Top row: 2 stones
  ctx.fillRect(1, 1, 6, 6);
  ctx.fillRect(8, 1, 7, 6);
  // Bottom row: offset
  ctx.fillRect(1, 9, 4, 6);
  ctx.fillRect(6, 9, 9, 6);
  // Mortar darker pixels
  ctx.fillStyle = "#3a332e";
  ctx.fillRect(0, 0, TILE, 1);
  ctx.fillRect(0, 8, TILE, 1);
  ctx.fillRect(0, 15, TILE, 1);
  ctx.fillRect(7, 1, 1, 6);
  ctx.fillRect(5, 9, 1, 6);
  return c;
}

function makeGrass() {
  // Grass with blades
  const c = newCanvas(TILE, TILE);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#3a5a2a";
  ctx.fillRect(0, 0, TILE, TILE);
  // Darker patches
  ctx.fillStyle = "#2d4820";
  speckle(ctx, 0x7777, 10);
  // Bright blades
  ctx.fillStyle = "#4e7236";
  const blades = [[2,3],[7,2],[13,6],[4,10],[10,13],[14,11]];
  for (const [x, y] of blades) {
    ctx.fillRect(x, y, 1, 2);
  }
  return c;
}

function makeCheck() {
  // Subtle checker for headers/outside areas
  const c = newCanvas(TILE, TILE);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#2a2420";
  ctx.fillRect(0, 0, TILE, TILE);
  ctx.fillStyle = "#322a25";
  ctx.fillRect(0, 0, TILE / 2, TILE / 2);
  ctx.fillRect(TILE / 2, TILE / 2, TILE / 2, TILE / 2);
  return c;
}

// ---- helpers ----

function newCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  return c;
}

// Deterministic pseudo-random dots using a small LCG seeded by `seed`
function speckle(ctx, seed, count) {
  let s = seed | 0;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rand() * TILE);
    const y = Math.floor(rand() * TILE);
    ctx.fillRect(x, y, 1, 1);
  }
}

/**
 * Return the texture key for a room name.
 */
export function roomFloorKey(roomName) {
  switch (roomName) {
    case "Meeting":    return "tile-carpet";   // cozy
    case "QA Lab":     return "tile-wood";     // lab floor
    case "SecOps":     return "tile-stone";    // fortress
    case "Think Tank": return "tile-carpet";   // cozy
    case "Field":      return "tile-grass";    // outdoor
    default:           return "tile-wood";
  }
}

/**
 * Build a pixel-art character sprite texture (one per agent color).
 * 24x32 px chunky pixel dude with hat, body, feet.
 * Returns canvas; caller registers with textures.addCanvas.
 */
export function makeCharacter(color) {
  const w = 24, h = 32;
  const c = newCanvas(w, h);
  const ctx = c.getContext("2d");
  const hex = "#" + color.toString(16).padStart(6, "0");
  const darkHex = shade(color, -0.35);
  const lightHex = shade(color, 0.25);

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(6, 30, 12, 2);

  // Feet
  ctx.fillStyle = darkHex;
  ctx.fillRect(7, 27, 4, 3);
  ctx.fillRect(13, 27, 4, 3);

  // Body (main rect)
  ctx.fillStyle = hex;
  ctx.fillRect(6, 12, 12, 16);
  // Body shading right
  ctx.fillStyle = darkHex;
  ctx.fillRect(16, 12, 2, 16);
  // Body highlight left
  ctx.fillStyle = lightHex;
  ctx.fillRect(6, 12, 2, 14);

  // Head (lighter)
  ctx.fillStyle = "#f4d4a7";
  ctx.fillRect(7, 4, 10, 9);
  // Head shading
  ctx.fillStyle = "#c9a876";
  ctx.fillRect(15, 4, 2, 9);
  // Hair/hat (top darker band)
  ctx.fillStyle = darkHex;
  ctx.fillRect(6, 3, 12, 3);

  // Outline (black)
  ctx.fillStyle = "#1a120d";
  // around body
  ctx.fillRect(5, 12, 1, 16);
  ctx.fillRect(18, 12, 1, 16);
  ctx.fillRect(6, 11, 12, 1);
  // around head
  ctx.fillRect(6, 3, 1, 10);
  ctx.fillRect(17, 3, 1, 10);
  ctx.fillRect(7, 2, 10, 1);
  ctx.fillRect(7, 13, 10, 1);

  return c;
}

function shade(hex, amount) {
  // hex = 0xRRGGBB, amount = -1..1
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  const adj = (v) => {
    if (amount >= 0) return Math.round(v + (255 - v) * amount);
    return Math.round(v * (1 + amount));
  };
  return `#${[adj(r), adj(g), adj(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
