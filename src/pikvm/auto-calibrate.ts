/**
 * Auto-calibration via visual cursor detection.
 *
 * Moves the mouse a known distance, diffs two screenshots to find the cursor,
 * and computes calibration factors from detected vs expected positions.
 */

import sharp from 'sharp';
import { PiKVMClient, ScreenResolution } from './client.js';

// ============================================================================
// Types
// ============================================================================

export interface AutoCalibrationConfig {
  rounds: number;           // default 5
  verifyRounds: number;     // default 5
  moveDelayMs: number;      // default 300
  diffThreshold: number;    // default 90 (summed RGB delta)
  minClusterSize: number;   // default 4
  maxClusterSize: number;   // default 2500
  maxRetries: number;       // default 3
  mergeRadius: number;      // default 30
  minSamples: number;       // default 3
  maxRatioDivergence: number; // default 0.5
  verbose: boolean;         // default false
}

export interface AutoCalibrationResult {
  success: boolean;
  factorX: number;
  factorY: number;
  resolution: ScreenResolution;
  confidence: number;        // 0-1
  verificationScore: number;
  validSamples: number;
  totalRounds: number;
  message: string;
}

interface Point {
  x: number;
  y: number;
}

interface Cluster {
  pixels: number;
  centroidX: number;
  centroidY: number;
}

interface CalibrationSample {
  detectedDelta: Point;
  commandedDelta: Point;
  ratioX: number;
  ratioY: number;
}

const DEFAULT_CONFIG: AutoCalibrationConfig = {
  rounds: 5,
  verifyRounds: 5,
  moveDelayMs: 300,
  // Capture/JPEG noise between identical frames reaches ~60 (summed RGB);
  // cursor edges against any background are several hundred.
  diffThreshold: 90,
  minClusterSize: 4,
  maxClusterSize: 2500,
  maxRetries: 3,
  mergeRadius: 30,
  minSamples: 3,
  maxRatioDivergence: 0.5,
  verbose: false,
};

// ============================================================================
// Image diffing
// ============================================================================

/**
 * Decode a JPEG buffer to raw RGB pixels via sharp.
 */
async function decodeToRgb(buffer: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  const image = sharp(buffer).removeAlpha().raw();
  const { data, info } = await image.toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/**
 * Diff two same-size raw RGB buffers.
 * Returns a boolean mask where changed pixels are true.
 */
function diffPixels(
  a: Buffer,
  b: Buffer,
  width: number,
  height: number,
  threshold: number,
): boolean[] {
  const total = width * height;
  const mask = new Array<boolean>(total);
  for (let i = 0; i < total; i++) {
    const offset = i * 3;
    const dr = Math.abs(a[offset] - b[offset]);
    const dg = Math.abs(a[offset + 1] - b[offset + 1]);
    const db = Math.abs(a[offset + 2] - b[offset + 2]);
    mask[i] = (dr + dg + db) >= threshold;
  }
  return mask;
}

/**
 * Connected-component labeling via 8-connectivity flood fill.
 * Returns clusters of changed pixels with centroid and size.
 */
function findClusters(
  mask: boolean[],
  width: number,
  height: number,
  minSize: number,
  maxSize: number,
): Cluster[] {
  const visited = new Uint8Array(width * height);
  const clusters: Cluster[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!mask[idx] || visited[idx]) continue;

      // Flood fill via BFS
      const queue: number[] = [idx];
      visited[idx] = 1;
      let sumX = 0;
      let sumY = 0;
      let count = 0;

      while (queue.length > 0) {
        const ci = queue.pop()!;
        const cx = ci % width;
        const cy = (ci - cx) / width;
        sumX += cx;
        sumY += cy;
        count++;

        // 8-connectivity neighbors
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const ni = ny * width + nx;
            if (!mask[ni] || visited[ni]) continue;
            visited[ni] = 1;
            queue.push(ni);
          }
        }
      }

      if (count >= minSize && count <= maxSize) {
        clusters.push({
          pixels: count,
          centroidX: Math.round(sumX / count),
          centroidY: Math.round(sumY / count),
        });
      }
    }
  }

  return clusters;
}

/**
 * Merge nearby clusters into logical groups (single-linkage union-find).
 * Handles cursor drop shadows that appear as separate clusters near the cursor body.
 */
function mergeClusters(clusters: Cluster[], mergeRadius: number): Cluster[] {
  if (clusters.length <= 1) return clusters;

  // Union-Find
  const parent = clusters.map((_, i) => i);

  function find(i: number): number {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]; // path compression
      i = parent[i];
    }
    return i;
  }

  function union(a: number, b: number): void {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  // Merge pairs within mergeRadius (centroid distance)
  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const dx = clusters[i].centroidX - clusters[j].centroidX;
      const dy = clusters[i].centroidY - clusters[j].centroidY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= mergeRadius) {
        union(i, j);
      }
    }
  }

  // Group by root
  const groups = new Map<number, number[]>();
  for (let i = 0; i < clusters.length; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  }

  // Merge each group: pixel-weighted average centroid
  const merged: Cluster[] = [];
  for (const members of groups.values()) {
    let totalPixels = 0;
    let weightedX = 0;
    let weightedY = 0;
    for (const idx of members) {
      const c = clusters[idx];
      totalPixels += c.pixels;
      weightedX += c.centroidX * c.pixels;
      weightedY += c.centroidY * c.pixels;
    }
    merged.push({
      pixels: totalPixels,
      centroidX: Math.round(weightedX / totalPixels),
      centroidY: Math.round(weightedY / totalPixels),
    });
  }

  return merged;
}

/**
 * Diff two JPEG screenshots and return cursor-sized clusters.
 */
async function diffScreenshots(
  bufA: Buffer,
  bufB: Buffer,
  config: AutoCalibrationConfig,
): Promise<Cluster[]> {
  const imgA = await decodeToRgb(bufA);
  const imgB = await decodeToRgb(bufB);

  if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
    throw new Error('Screenshot dimensions changed between captures');
  }

  const mask = diffPixels(imgA.data, imgB.data, imgA.width, imgA.height, config.diffThreshold);
  const raw = findClusters(mask, imgA.width, imgA.height, config.minClusterSize, config.maxClusterSize);
  return mergeClusters(raw, config.mergeRadius);
}

// ============================================================================
// Helpers
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function magnitude(p: Point): number {
  return Math.sqrt(p.x * p.x + p.y * p.y);
}

/**
 * Generate a random start position in the safe zone (central 60% of screen).
 */
function randomSafePosition(resolution: ScreenResolution): Point {
  const marginX = resolution.width * 0.2;
  const marginY = resolution.height * 0.2;
  return {
    x: Math.round(marginX + Math.random() * (resolution.width - 2 * marginX)),
    y: Math.round(marginY + Math.random() * (resolution.height - 2 * marginY)),
  };
}

/**
 * Generate a random delta for the calibration move (80-150px, varying direction).
 */
function randomDelta(round: number): Point {
  const distance = 80 + Math.random() * 70; // 80-150px
  // Spread directions across rounds
  const angle = (round * 72 + Math.random() * 30) * (Math.PI / 180);
  return {
    x: Math.round(distance * Math.cos(angle)),
    y: Math.round(distance * Math.sin(angle)),
  };
}

/**
 * Take a raw screenshot (no preview scaling) and return the buffer.
 */
async function takeRawScreenshot(client: PiKVMClient): Promise<Buffer> {
  const result = await client.screenshot();
  return result.buffer;
}

// ============================================================================
// Main calibration algorithm
// ============================================================================

export async function autoCalibrate(
  client: PiKVMClient,
  partialConfig?: Partial<AutoCalibrationConfig>,
): Promise<AutoCalibrationResult> {
  const config: AutoCalibrationConfig = { ...DEFAULT_CONFIG, ...partialConfig };
  const verboseLog: string[] = [];

  function vlog(msg: string): void {
    if (config.verbose) {
      console.error(`[auto-cal] ${msg}`);
      verboseLog.push(msg);
    }
  }

  function getVerboseSuffix(): string {
    return config.verbose && verboseLog.length > 0
      ? '\n\n--- Verbose Log ---\n' + verboseLog.join('\n')
      : '';
  }

  // Clear existing calibration
  client.clearCalibration();

  const resolution = await client.getResolution(true);
  const initialResolution = { ...resolution };
  vlog(`Resolution: ${resolution.width}x${resolution.height}`);

  // Take baseline screenshot (to warm up capture pipeline)
  await takeRawScreenshot(client);

  // ---- Sampling phase ----
  const samples: CalibrationSample[] = [];
  let consecutiveFailures = 0;

  for (let round = 0; round < config.rounds; round++) {
    // Check resolution hasn't changed
    const currentRes = await client.getResolution(true);
    if (currentRes.width !== initialResolution.width || currentRes.height !== initialResolution.height) {
      return {
        success: false,
        factorX: 1.0,
        factorY: 1.0,
        resolution: currentRes,
        confidence: 0,
        verificationScore: 0,
        validSamples: samples.length,
        totalRounds: round,
        message: 'Resolution changed during calibration. Please try again with a stable display.' + getVerboseSuffix(),
      };
    }

    const startPos = randomSafePosition(resolution);
    const delta = randomDelta(round);
    vlog(`Round ${round + 1}/${config.rounds}: start=(${startPos.x},${startPos.y}), delta=(${delta.x},${delta.y})`);

    // Move to start position (raw/uncalibrated)
    await client.mouseMoveRaw(startPos.x, startPos.y);
    await sleep(config.moveDelayMs);
    const screenshotA = await takeRawScreenshot(client);

    // Move by known delta
    const endPos = {
      x: startPos.x + delta.x,
      y: startPos.y + delta.y,
    };
    await client.mouseMoveRaw(endPos.x, endPos.y);
    await sleep(config.moveDelayMs);
    const screenshotB = await takeRawScreenshot(client);

    // Diff screenshots to find cursor positions
    let clusters: Cluster[];
    try {
      clusters = await diffScreenshots(screenshotA, screenshotB, config);
    } catch {
      vlog(`Round ${round + 1}: diff failed (exception)`);
      consecutiveFailures++;
      if (consecutiveFailures >= 3) {
        return {
          success: false,
          factorX: 1.0,
          factorY: 1.0,
          resolution: initialResolution,
          confidence: 0,
          verificationScore: 0,
          validSamples: samples.length,
          totalRounds: round + 1,
          message: 'Failed to diff screenshots. The display may be off or unresponsive.' + getVerboseSuffix(),
        };
      }
      continue;
    }

    vlog(`Round ${round + 1}: ${clusters.length} cluster(s) found`);

    // We expect exactly 2 cursor-sized clusters (old and new cursor positions)
    if (clusters.length !== 2) {
      vlog(`Round ${round + 1}: REJECTED — wrong cluster count (expected 2, got ${clusters.length})`);
      consecutiveFailures++;
      if (consecutiveFailures >= 3) {
        return {
          success: false,
          factorX: 1.0,
          factorY: 1.0,
          resolution: initialResolution,
          confidence: 0,
          verificationScore: 0,
          validSamples: samples.length,
          totalRounds: round + 1,
          message: `Cursor detection failed: expected 2 clusters but found ${clusters.length}. ` +
            'The cursor may be hidden, or there may be screen animations. ' +
            'Try manual calibration with pikvm_calibrate instead.' + getVerboseSuffix(),
        };
      }
      continue;
    }

    // Reset consecutive failures on valid cluster count
    consecutiveFailures = 0;

    // Determine which cluster is the old vs new position by matching direction
    const c0 = clusters[0];
    const c1 = clusters[1];

    vlog(`Round ${round + 1}: c0=(${c0.centroidX},${c0.centroidY}) c1=(${c1.centroidX},${c1.centroidY})`);

    // Vector between clusters
    const detectedDelta = {
      x: c1.centroidX - c0.centroidX,
      y: c1.centroidY - c0.centroidY,
    };

    // Check if vector roughly matches commanded delta (within 30% magnitude)
    const detectedMag = magnitude(detectedDelta);
    const commandedMag = magnitude(delta);
    if (commandedMag === 0) {
      vlog(`Round ${round + 1}: REJECTED — commanded magnitude is zero`);
      continue;
    }

    const magRatio = detectedMag / commandedMag;
    vlog(`Round ${round + 1}: detectedDelta=(${detectedDelta.x},${detectedDelta.y}), magRatio=${magRatio.toFixed(3)}`);
    if (magRatio < 0.3 || magRatio > 3.0) {
      vlog(`Round ${round + 1}: REJECTED — magnitude mismatch (ratio ${magRatio.toFixed(3)} outside 0.3–3.0)`);
      continue;
    }

    // Check direction roughly matches (dot product positive and angle within ~60 degrees)
    const dot = detectedDelta.x * delta.x + detectedDelta.y * delta.y;
    if (dot <= 0) {
      // Might be reversed — try swapping clusters
      const altDelta = { x: -detectedDelta.x, y: -detectedDelta.y };
      const altDot = altDelta.x * delta.x + altDelta.y * delta.y;
      if (altDot <= 0) {
        vlog(`Round ${round + 1}: REJECTED — direction mismatch (dot=${dot}, altDot=${altDot})`);
        continue;
      }

      // Use swapped direction
      detectedDelta.x = altDelta.x;
      detectedDelta.y = altDelta.y;
    }

    // Compute per-axis ratio: commanded / detected
    // Avoid division by zero
    if (Math.abs(detectedDelta.x) < 2 && Math.abs(delta.x) > 10) {
      vlog(`Round ${round + 1}: REJECTED — division-by-zero guard (detectedDelta.x too small)`);
      continue;
    }
    if (Math.abs(detectedDelta.y) < 2 && Math.abs(delta.y) > 10) {
      vlog(`Round ${round + 1}: REJECTED — division-by-zero guard (detectedDelta.y too small)`);
      continue;
    }

    const ratioX = Math.abs(delta.x) > 5 ? delta.x / detectedDelta.x : 1.0;
    const ratioY = Math.abs(delta.y) > 5 ? delta.y / detectedDelta.y : 1.0;

    // Reject rounds where X and Y ratios diverge wildly (indicates noise, not real cursor movement)
    // Only check when both axes contributed real ratios (not the fallback 1.0)
    if (Math.abs(delta.x) > 5 && Math.abs(delta.y) > 5) {
      const divergence = Math.abs(ratioX - ratioY) / Math.max(Math.abs(ratioX), Math.abs(ratioY));
      if (divergence > config.maxRatioDivergence) {
        vlog(`Round ${round + 1}: REJECTED — ratio divergence too high (${divergence.toFixed(2)} > ${config.maxRatioDivergence.toFixed(2)}): ratioX=${ratioX.toFixed(4)}, ratioY=${ratioY.toFixed(4)}`);
        continue;
      }
    }

    vlog(`Round ${round + 1}: ACCEPTED — ratioX=${ratioX.toFixed(4)}, ratioY=${ratioY.toFixed(4)}`);

    samples.push({
      detectedDelta,
      commandedDelta: delta,
      ratioX,
      ratioY,
    });
  }

  // ---- Factor computation ----
  vlog(`Sampling complete: ${samples.length}/${config.minSamples} minimum valid samples`);
  if (samples.length < config.minSamples) {
    return {
      success: false,
      factorX: 1.0,
      factorY: 1.0,
      resolution: initialResolution,
      confidence: 0,
      verificationScore: 0,
      validSamples: samples.length,
      totalRounds: config.rounds,
      message: `Insufficient valid samples (${samples.length}/${config.minSamples} minimum). ` +
        'The cursor may be hard to detect. Try manual calibration with pikvm_calibrate instead.' + getVerboseSuffix(),
    };
  }

  // Compute factors via pure median (inherently outlier-resistant)
  const xRatios = samples.filter((s) => Math.abs(s.commandedDelta.x) > 5).map((s) => s.ratioX);
  const yRatios = samples.filter((s) => Math.abs(s.commandedDelta.y) > 5).map((s) => s.ratioY);

  vlog(`X ratios (${xRatios.length}): [${xRatios.map((r) => r.toFixed(4)).join(', ')}]`);
  vlog(`Y ratios (${yRatios.length}): [${yRatios.map((r) => r.toFixed(4)).join(', ')}]`);

  let factorX = 1.0;
  let factorY = 1.0;

  if (xRatios.length >= 2) {
    factorX = median(xRatios);
  }

  if (yRatios.length >= 2) {
    factorY = median(yRatios);
  }

  vlog(`Median factors: X=${factorX.toFixed(4)}, Y=${factorY.toFixed(4)}`);

  // Sanity check
  if (factorX < 0.5 || factorX > 2.0 || factorY < 0.5 || factorY > 2.0) {
    return {
      success: false,
      factorX: 1.0,
      factorY: 1.0,
      resolution: initialResolution,
      confidence: 0,
      verificationScore: 0,
      validSamples: samples.length,
      totalRounds: config.rounds,
      message: `Computed factors out of range: factorX=${factorX.toFixed(4)}, factorY=${factorY.toFixed(4)}. ` +
        'This suggests an unusual display configuration. Try manual calibration with pikvm_calibrate instead.' + getVerboseSuffix(),
    };
  }

  // Apply calibration
  client.setCalibrationFactors(factorX, factorY);

  // ---- Verification phase ----
  let hits = 0;
  let misses = 0;

  for (let round = 0; round < config.verifyRounds; round++) {
    const target = randomSafePosition(resolution);
    vlog(`Verify ${round + 1}/${config.verifyRounds}: target=(${target.x},${target.y})`);

    // Move to target (now with calibration applied)
    await client.mouseMove(target.x, target.y);
    await sleep(config.moveDelayMs);
    const screenshotC = await takeRawScreenshot(client);

    // Move away
    const awayPos = {
      x: target.x + 120,
      y: target.y + 120,
    };
    await client.mouseMove(
      Math.min(awayPos.x, resolution.width - 20),
      Math.min(awayPos.y, resolution.height - 20),
    );
    await sleep(config.moveDelayMs);
    const screenshotD = await takeRawScreenshot(client);

    // Diff to find cursor position in C
    let clusters: Cluster[];
    try {
      clusters = await diffScreenshots(screenshotC, screenshotD, config);
    } catch {
      vlog(`Verify ${round + 1}: diff failed (exception)`);
      continue;
    }

    vlog(`Verify ${round + 1}: ${clusters.length} cluster(s)`);
    if (clusters.length !== 2) {
      vlog(`Verify ${round + 1}: SKIPPED — wrong cluster count (${clusters.length}), noisy screen`);
      continue;
    }

    // The cursor in screenshot C is the one closer to target
    const d0 = Math.abs(clusters[0].centroidX - target.x) + Math.abs(clusters[0].centroidY - target.y);
    const d1 = Math.abs(clusters[1].centroidX - target.x) + Math.abs(clusters[1].centroidY - target.y);
    const cursorCluster = d0 < d1 ? clusters[0] : clusters[1];

    const errorX = Math.abs(cursorCluster.centroidX - target.x);
    const errorY = Math.abs(cursorCluster.centroidY - target.y);
    const error = Math.sqrt(errorX * errorX + errorY * errorY);

    if (error <= 20) {
      hits++;
      vlog(`Verify ${round + 1}: HIT — cursor=(${cursorCluster.centroidX},${cursorCluster.centroidY}), error=${error.toFixed(1)}px`);
    } else {
      misses++;
      vlog(`Verify ${round + 1}: MISS — cursor=(${cursorCluster.centroidX},${cursorCluster.centroidY}), error=${error.toFixed(1)}px`);
    }
  }

  const cleanRounds = hits + misses;
  const skippedRounds = config.verifyRounds - cleanRounds;
  // Confidence based on total attempted rounds, not just clean ones
  const confidence = config.verifyRounds > 0 ? hits / config.verifyRounds : 0;
  const verificationScore = hits - misses;
  vlog(`Verification: ${hits} hits, ${misses} misses, ${skippedRounds} skipped out of ${config.verifyRounds} attempted (confidence=${(confidence * 100).toFixed(0)}%)`);

  // Inconclusive if too few clean verify rounds
  if (cleanRounds < config.minSamples) {
    // Keep calibration applied (factors may be correct, we just can't verify)
    return {
      success: false,
      factorX,
      factorY,
      resolution: initialResolution,
      confidence,
      verificationScore,
      validSamples: samples.length,
      totalRounds: config.rounds,
      message: `Verification inconclusive: only ${cleanRounds}/${config.minSamples} minimum clean verify rounds obtained ` +
        `(${skippedRounds} skipped due to screen noise). ` +
        `Factors: X=${factorX.toFixed(4)}, Y=${factorY.toFixed(4)}. ` +
        'Calibration reverted. Reduce screen activity and retry, or use pikvm_calibrate.' +
        getVerboseSuffix(),
    };
  }

  if (verificationScore > 0) {
    return {
      success: true,
      factorX,
      factorY,
      resolution: initialResolution,
      confidence,
      verificationScore,
      validSamples: samples.length,
      totalRounds: config.rounds,
      message: `Auto-calibration successful. ` +
        `Factors: X=${factorX.toFixed(4)}, Y=${factorY.toFixed(4)}. ` +
        `Verification: ${hits}/${config.verifyRounds} hits (${(confidence * 100).toFixed(0)}% accuracy).` +
        getVerboseSuffix(),
    };
  }

  // Verification failed — revert
  client.clearCalibration();
  return {
    success: false,
    factorX,
    factorY,
    resolution: initialResolution,
    confidence,
    verificationScore,
    validSamples: samples.length,
    totalRounds: config.rounds,
    message: `Auto-calibration verification failed (score: ${verificationScore}). ` +
      `Factors were: X=${factorX.toFixed(4)}, Y=${factorY.toFixed(4)}. ` +
      'Calibration reverted. Try manual calibration with pikvm_calibrate instead.' +
      getVerboseSuffix(),
  };
}

/**
 * Run auto-calibration with retries.
 */
export async function autoCalibrateWithRetries(
  client: PiKVMClient,
  partialConfig?: Partial<AutoCalibrationConfig>,
): Promise<AutoCalibrationResult> {
  const config: AutoCalibrationConfig = { ...DEFAULT_CONFIG, ...partialConfig };
  const maxRetries = config.maxRetries;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await autoCalibrate(client, config);
    if (result.success) return result;

    // On last attempt, return the failure
    if (attempt === maxRetries) return result;

    // Increase move delay for retries (slow capture might be the issue)
    config.moveDelayMs = Math.min(config.moveDelayMs + 100, 800);
  }

  // Unreachable, but TypeScript needs it
  return {
    success: false,
    factorX: 1.0,
    factorY: 1.0,
    resolution: { width: 0, height: 0 },
    confidence: 0,
    verificationScore: 0,
    validSamples: 0,
    totalRounds: 0,
    message: 'Auto-calibration failed after all retries.',
  };
}
