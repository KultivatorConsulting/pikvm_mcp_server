/**
 * Detection of the remote display's active area inside a PiKVM capture.
 *
 * When the target outputs a different aspect ratio from the capture
 * resolution, the picture is letterboxed/pillarboxed with black bars. PiKVM's
 * absolute mouse range spans the target's desktop, not the capture frame, so
 * pixel coordinates read from a screenshot must be mapped into the active area.
 */

import sharp from 'sharp';

export interface DisplayArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

// A pixel brighter than this is treated as picture, not bar (JPEG bars are ~0-10).
const BLACK_LEVEL = 24;
// Lines with at most this many bright pixels still count as bar (tolerates JPEG noise).
const MAX_BRIGHT_PIXELS = 2;
// Bars thinner than this are ignored (edge noise, overscan).
const MIN_BAR = 4;
// Aspect ratios a scaled-to-fit source picture can plausibly have.
const KNOWN_ASPECTS = [4 / 3, 5 / 4, 3 / 2, 16 / 10, 16 / 9, 21 / 9, 64 / 27, 32 / 9];
const ASPECT_TOLERANCE = 0.015;

function isBlankColumn(gray: Buffer, width: number, height: number, x: number): boolean {
  let bright = 0;
  for (let y = 0; y < height; y++) {
    if (gray[y * width + x] > BLACK_LEVEL && ++bright > MAX_BRIGHT_PIXELS) return false;
  }
  return true;
}

function isBlankRow(gray: Buffer, width: number, y: number): boolean {
  let bright = 0;
  const start = y * width;
  for (let x = 0; x < width; x++) {
    if (gray[start + x] > BLACK_LEVEL && ++bright > MAX_BRIGHT_PIXELS) return false;
  }
  return true;
}

/**
 * Bars from scaling are centred, so both sides are equal. Dark content at one
 * edge can only make a bar look wider, never narrower, so trust the smaller side.
 */
function symmetricBar(lead: number, trail: number): number {
  const bar = Math.min(lead, trail);
  return bar >= MIN_BAR ? bar : 0;
}

/**
 * Find the active area in a greyscale frame.
 * Returns null when the result is inconclusive (frame entirely black, or the
 * apparent bars don't leave a picture with a recognisable aspect ratio), in
 * which case the caller should keep its previous answer.
 */
export function detectDisplayAreaFromGray(gray: Buffer, width: number, height: number): DisplayArea | null {
  let left = 0;
  while (left < width && isBlankColumn(gray, width, height, left)) left++;
  if (left === width) return null; // all black: screen off or blanked

  let right = 0;
  while (isBlankColumn(gray, width, height, width - 1 - right)) right++;

  let top = 0;
  while (isBlankRow(gray, width, top)) top++;
  let bottom = 0;
  while (isBlankRow(gray, width, height - 1 - bottom)) bottom++;

  const barX = symmetricBar(left, right);
  const barY = symmetricBar(top, bottom);
  if (barX === 0 && barY === 0) {
    return { x: 0, y: 0, width, height };
  }

  const area = { x: barX, y: barY, width: width - 2 * barX, height: height - 2 * barY };
  const aspect = area.width / area.height;
  const plausible = KNOWN_ASPECTS.some((a) => Math.abs(aspect - a) / a <= ASPECT_TOLERANCE);
  return plausible ? area : null;
}

/**
 * Decode a captured frame and detect its active area.
 */
export async function detectDisplayArea(image: Buffer): Promise<DisplayArea | null> {
  const { data, info } = await sharp(image).greyscale().raw().toBuffer({ resolveWithObject: true });
  return detectDisplayAreaFromGray(data, info.width, info.height);
}
