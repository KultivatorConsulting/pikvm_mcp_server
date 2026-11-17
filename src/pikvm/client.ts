/**
 * PiKVM API Client
 *
 * Handles communication with PiKVM's REST API for HID control.
 * All mouse operations use the REST API which is more reliable than WebSocket.
 */

import { Agent, fetch } from 'undici';
import sharp from 'sharp';
import { detectDisplayArea, type DisplayArea } from './display-area.js';

export interface PiKVMConfig {
  host: string;
  username: string;
  password: string;
  verifySsl?: boolean;
  defaultKeymap?: string;
}

export interface TypeOptions {
  keymap?: string;
  slow?: boolean;
  delay?: number;
}

export interface KeyOptions {
  state?: boolean; // true = press, false = release, undefined = press+release
}

export interface ScreenResolution {
  width: number;
  height: number;
}

export type MouseButton = 'left' | 'right' | 'middle' | 'up' | 'down';

export interface ScreenshotResult {
  buffer: Buffer;
  screenshotWidth: number;
  screenshotHeight: number;
  actualWidth: number;
  actualHeight: number;
  scaleX: number;
  scaleY: number;
  /** Region of the capture holding the remote desktop (excludes black bars) */
  displayArea: DisplayArea;
}

/**
 * Non-2xx response from the PiKVM API
 */
export class PiKVMApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'PiKVMApiError';
  }
}

// The streamer answers 503 when a snapshot is requested while it is still
// busy (e.g. back-to-back captures during auto-calibration). Retry with backoff.
const SNAPSHOT_RETRY_DELAYS_MS = [250, 500, 1000, 2000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// PiKVM uses signed 16-bit integers for absolute mouse coordinates
const MOUSE_COORD_MIN = -32768;
const MOUSE_COORD_MAX = 32767;

// Relative mouse deltas are limited to signed 8-bit range
const MOUSE_DELTA_MIN = -127;
const MOUSE_DELTA_MAX = 127;

/**
 * Linearly remap a value from one range to another
 */
function remap(value: number, fromMin: number, fromMax: number, toMin: number, toMax: number): number {
  return Math.round(toMin + (value - fromMin) * (toMax - toMin) / (fromMax - fromMin));
}

/**
 * Clamp a value to a range
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface CalibrationState {
  factorX: number;
  factorY: number;
  resolution: ScreenResolution;
}

export interface CalibrationResult {
  expectedPosition: { x: number; y: number };
  requestedNormalized: { x: number; y: number };
  resolution: ScreenResolution;
  message: string;
}

export class PiKVMClient {
  private config: Required<PiKVMConfig>;
  private dispatcher: Agent;
  private cachedResolution: ScreenResolution | null = null;
  private screenshotScale: {
    scaleX: number;
    scaleY: number;
  } | null = null;
  private calibration: CalibrationState | null = null;
  /**
   * Region of the capture that the remote desktop occupies. Null until a
   * full-resolution frame has been analysed for the current resolution.
   */
  private displayArea: DisplayArea | null = null;

  constructor(config: PiKVMConfig) {
    this.config = {
      verifySsl: false,
      defaultKeymap: 'en-us',
      ...config,
    };

    // Create dispatcher with SSL configuration
    this.dispatcher = new Agent({
      connect: {
        rejectUnauthorized: this.config.verifySsl,
      },
    });
  }

  /**
   * Close any resources (no-op for REST-only client, kept for API compatibility)
   */
  close(): void {
    // No resources to close when using REST API only
  }

  /**
   * Make an authenticated request to the PiKVM API
   */
  private async request<T = unknown>(
    method: string,
    path: string,
    body?: string | object,
    contentType?: string
  ): Promise<T> {
    const url = new URL(`/api${path}`, this.config.host);

    const headers: Record<string, string> = {
      'X-KVMD-User': this.config.username,
      'X-KVMD-Passwd': this.config.password,
    };

    if (body !== undefined) {
      if (contentType) {
        headers['Content-Type'] = contentType;
      } else if (typeof body === 'object') {
        headers['Content-Type'] = 'application/json';
      } else {
        headers['Content-Type'] = 'text/plain';
      }
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? (typeof body === 'object' ? JSON.stringify(body) : body) : undefined,
      dispatcher: this.dispatcher,
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Sanitize error text to avoid exposing sensitive information
      const sanitizedError = errorText
        .replace(/password[=:][^\s,"]*/gi, 'password=[REDACTED]')
        .replace(/X-KVMD-Passwd[^,\s"]*/gi, 'X-KVMD-Passwd=[REDACTED]')
        .substring(0, 200); // Limit error message length
      throw new PiKVMApiError(response.status, `PiKVM API error ${response.status}: ${sanitizedError}`);
    }

    // Check content type for response handling
    const responseType = response.headers.get('content-type') || '';
    if (responseType.includes('image/')) {
      return response.arrayBuffer() as Promise<T>;
    }

    // Handle empty responses (204 No Content)
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return {} as T;
    }

    const text = await response.text();
    if (!text) {
      return {} as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      // If not JSON, return as-is wrapped in an object
      return { result: text } as T;
    }
  }

  /**
   * GET a streamer snapshot, retrying while the streamer reports 503 (busy).
   */
  private async requestSnapshot<T>(path: string): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.request<T>('GET', path);
      } catch (err) {
        const retryable = err instanceof PiKVMApiError && err.status === 503;
        if (!retryable || attempt >= SNAPSHOT_RETRY_DELAYS_MS.length) throw err;
        await sleep(SNAPSHOT_RETRY_DELAYS_MS[attempt]);
      }
    }
  }

  /**
   * Take a screenshot and calculate coordinate scaling factors
   */
  async screenshot(options?: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  }): Promise<ScreenshotResult> {
    const params = new URLSearchParams();
    if (options?.maxWidth || options?.maxHeight) {
      params.set('preview', '1');
      if (options.maxWidth) params.set('preview_max_width', options.maxWidth.toString());
      if (options.maxHeight) params.set('preview_max_height', options.maxHeight.toString());
      if (options.quality) params.set('preview_quality', options.quality.toString());
    }

    const path = `/streamer/snapshot${params.toString() ? '?' + params : ''}`;
    const arrayBuffer = await this.requestSnapshot<ArrayBuffer>(path);
    const buffer = Buffer.from(arrayBuffer);

    // Get actual screen resolution (force refresh to ensure accuracy)
    const actualResolution = await this.getResolution(true);

    // Get screenshot dimensions using sharp
    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error('Failed to read screenshot dimensions');
    }
    const dimensions = { width: metadata.width, height: metadata.height };

    // Locate the remote desktop inside the frame (black-bar detection).
    // Only full-resolution frames are analysed, so the area is in screen pixels.
    if (!params.has('preview')) {
      await this.updateDisplayArea(buffer);
    }

    // Calculate and store scale factors
    const scaleX = actualResolution.width / dimensions.width;
    const scaleY = actualResolution.height / dimensions.height;
    this.screenshotScale = { scaleX, scaleY };

    return {
      buffer,
      screenshotWidth: dimensions.width,
      screenshotHeight: dimensions.height,
      actualWidth: actualResolution.width,
      actualHeight: actualResolution.height,
      scaleX,
      scaleY,
      displayArea: this.getDisplayArea(actualResolution),
    };
  }

  /**
   * Re-detect the active display area from a full-resolution frame.
   * An inconclusive result (e.g. an all-black frame) keeps the previous area.
   */
  private async updateDisplayArea(frame: Buffer): Promise<void> {
    const detected = await detectDisplayArea(frame);
    if (detected) {
      this.displayArea = detected;
    }
  }

  /**
   * The region of the capture holding the remote desktop, or the full frame
   * if it hasn't been detected.
   */
  getDisplayArea(resolution: ScreenResolution): DisplayArea {
    return this.displayArea ?? { x: 0, y: 0, width: resolution.width, height: resolution.height };
  }

  /**
   * Make sure the display area has been detected for the current resolution.
   * Captures a frame internally if needed; the frame is never returned.
   * Detection failures fall back to the full frame.
   */
  private async ensureDisplayArea(): Promise<void> {
    if (this.displayArea) return;
    try {
      const frame = Buffer.from(await this.requestSnapshot<ArrayBuffer>('/streamer/snapshot'));
      await this.updateDisplayArea(frame);
    } catch {
      // Leave undetected; mouse mapping uses the full frame.
    }
  }

  /**
   * Get current screen resolution from the video streamer
   */
  async getResolution(forceRefresh = false): Promise<ScreenResolution> {
    if (this.cachedResolution && !forceRefresh) {
      return this.cachedResolution;
    }

    interface StreamerResponse {
      ok: boolean;
      result: {
        streamer: {
          source: {
            resolution: {
              width: number;
              height: number;
            };
          };
        };
      };
    }

    const response = await this.request<StreamerResponse>('GET', '/streamer');

    // Defensive null checks for nested API response structure
    const resolution = response?.result?.streamer?.source?.resolution;
    if (!resolution || typeof resolution.width !== 'number' || typeof resolution.height !== 'number') {
      throw new Error('Invalid or missing resolution data from PiKVM streamer API');
    }

    if (this.cachedResolution &&
        (this.cachedResolution.width !== resolution.width || this.cachedResolution.height !== resolution.height)) {
      // Bars depend on the capture resolution; re-detect on the next frame.
      this.displayArea = null;
    }
    this.cachedResolution = {
      width: resolution.width,
      height: resolution.height,
    };
    return this.cachedResolution;
  }

  /**
   * Convert pixel coordinates to PiKVM's normalized coordinate system
   * PiKVM uses range -32768 to 32767 for absolute positioning
   *
   * The HID range spans the remote desktop, which may not fill the capture
   * (letterbox/pillarbox), so pixels are mapped from the detected display area.
   * Points in the black bars clamp to the nearest desktop edge.
   *
   * Calibration factors are applied to compensate for resolution-dependent
   * coordinate scaling issues. Without calibration, factors default to 1.0.
   */
  private pixelToNormalized(pixelX: number, pixelY: number, resolution: ScreenResolution): { x: number; y: number } {
    const area = this.getDisplayArea(resolution);

    // Calculate base normalized coordinates
    const baseX = remap(pixelX, area.x, area.x + area.width - 1, MOUSE_COORD_MIN, MOUSE_COORD_MAX);
    const baseY = remap(pixelY, area.y, area.y + area.height - 1, MOUSE_COORD_MIN, MOUSE_COORD_MAX);

    // Apply calibration factors if available, otherwise use 1.0 (no correction)
    const factorX = this.calibration?.factorX ?? 1.0;
    const factorY = this.calibration?.factorY ?? 1.0;

    // Convert to unsigned (0-65535), apply calibration, convert back to signed
    const correctedX = Math.round((baseX + 32768) * factorX) - 32768;
    const correctedY = Math.round((baseY + 32768) * factorY) - 32768;

    // Clamp to valid range
    return {
      x: clamp(correctedX, MOUSE_COORD_MIN, MOUSE_COORD_MAX),
      y: clamp(correctedY, MOUSE_COORD_MIN, MOUSE_COORD_MAX),
    };
  }

  /**
   * Perform calibration by moving cursor to center of screen.
   * Returns information needed for the agent to calculate calibration factors.
   */
  async calibrate(): Promise<CalibrationResult> {
    // Force refresh resolution to ensure accuracy
    const resolution = await this.getResolution(true);
    await this.ensureDisplayArea();

    // Calculate center position
    const centerX = Math.round(resolution.width / 2);
    const centerY = Math.round(resolution.height / 2);

    // Temporarily clear calibration to get raw coordinates
    const savedCalibration = this.calibration;
    this.calibration = null;

    // Calculate the normalized coordinates we'll send (without calibration)
    const normalized = this.pixelToNormalized(centerX, centerY, resolution);

    // Move cursor to center using raw coordinates
    const params = new URLSearchParams();
    params.set('to_x', normalized.x.toString());
    params.set('to_y', normalized.y.toString());
    await this.request('POST', `/hid/events/send_mouse_move?${params}`);

    // Restore previous calibration (if any)
    this.calibration = savedCalibration;

    return {
      expectedPosition: { x: centerX, y: centerY },
      requestedNormalized: normalized,
      resolution,
      message: `Cursor moved to expected center position (${centerX}, ${centerY}). ` +
        `Please take a screenshot and visually verify the actual cursor position. ` +
        `Then call pikvm_set_calibration with the calculated factors: ` +
        `factorX = ${centerX} / actual_x, factorY = ${centerY} / actual_y`,
    };
  }

  /**
   * Set calibration factors for coordinate correction
   */
  setCalibrationFactors(factorX: number, factorY: number): void {
    // Sanity check: factors should be reasonable (0.5 to 2.0)
    if (factorX < 0.5 || factorX > 2.0 || factorY < 0.5 || factorY > 2.0) {
      throw new Error(`Calibration factors out of reasonable range (0.5-2.0): factorX=${factorX}, factorY=${factorY}`);
    }

    this.calibration = {
      factorX,
      factorY,
      resolution: this.cachedResolution || { width: 0, height: 0 },
    };
  }

  /**
   * Get current calibration state
   */
  getCalibration(): CalibrationState | null {
    return this.calibration;
  }

  /**
   * Clear calibration (revert to uncalibrated mode)
   */
  clearCalibration(): void {
    this.calibration = null;
  }

  /**
   * Move mouse to absolute pixel position WITHOUT calibration or screenshot scaling.
   * Used during auto-calibration to send known uncalibrated positions.
   */
  async mouseMoveRaw(x: number, y: number): Promise<void> {
    const resolution = await this.getResolution();
    await this.ensureDisplayArea();

    // Temporarily clear calibration to get raw coordinates
    const savedCalibration = this.calibration;
    this.calibration = null;

    const normalized = this.pixelToNormalized(x, y, resolution);

    // Restore calibration
    this.calibration = savedCalibration;

    const params = new URLSearchParams();
    params.set('to_x', normalized.x.toString());
    params.set('to_y', normalized.y.toString());
    await this.request('POST', `/hid/events/send_mouse_move?${params}`);
  }

  /**
   * Check if resolution has changed since calibration
   */
  private hasResolutionChanged(currentResolution: ScreenResolution): boolean {
    if (!this.calibration) return false;
    return this.calibration.resolution.width !== currentResolution.width ||
           this.calibration.resolution.height !== currentResolution.height;
  }

  /**
   * Scale coordinates from screenshot space to actual screen space
   * If no screenshot has been taken, coordinates pass through unchanged
   */
  private scaleCoordinates(x: number, y: number): { x: number; y: number } {
    if (!this.screenshotScale) {
      return { x, y };
    }
    return {
      x: Math.round(x * this.screenshotScale.scaleX),
      y: Math.round(y * this.screenshotScale.scaleY),
    };
  }

  /**
   * Type text using paste-as-keys (handles special characters correctly)
   */
  async type(text: string, options?: TypeOptions): Promise<void> {
    const params = new URLSearchParams();
    params.set('keymap', options?.keymap || this.config.defaultKeymap);
    if (options?.slow) params.set('slow', '1');
    if (options?.delay !== undefined) params.set('delay', options.delay.toString());

    await this.request('POST', `/hid/print?${params}`, text, 'text/plain');
  }

  /**
   * Send a key event
   */
  async sendKey(key: string, options?: KeyOptions): Promise<void> {
    const params = new URLSearchParams();
    params.set('key', key);
    if (options?.state !== undefined) {
      params.set('state', options.state.toString());
    }

    await this.request('POST', `/hid/events/send_key?${params}`);
  }

  /**
   * Send a keyboard shortcut (multiple keys pressed together)
   */
  async sendShortcut(keys: string[]): Promise<void> {
    await this.request('POST', '/hid/events/send_shortcut', keys);
  }

  /**
   * Move mouse to absolute pixel position (via REST API)
   * Coordinates are automatically scaled from screenshot space to screen space
   * if a scaled screenshot was previously taken.
   * @param x - X coordinate in pixels (0 = left edge), in screenshot space
   * @param y - Y coordinate in pixels (0 = top edge), in screenshot space
   * @returns Object with calibrationInvalidated flag if resolution changed
   */
  async mouseMove(x: number, y: number): Promise<{ calibrationInvalidated: boolean }> {
    // Scale coordinates from screenshot space to screen space
    const scaled = this.scaleCoordinates(x, y);

    // Get screen resolution for coordinate conversion (force refresh to detect changes)
    const resolution = await this.getResolution(true);

    // Check if resolution changed since calibration
    let calibrationInvalidated = false;
    if (this.hasResolutionChanged(resolution)) {
      // Clear calibration since it's no longer valid
      this.calibration = null;
      calibrationInvalidated = true;
    }

    await this.ensureDisplayArea();
    const normalized = this.pixelToNormalized(scaled.x, scaled.y, resolution);

    const params = new URLSearchParams();
    params.set('to_x', normalized.x.toString());
    params.set('to_y', normalized.y.toString());

    await this.request('POST', `/hid/events/send_mouse_move?${params}`);

    return { calibrationInvalidated };
  }

  /**
   * Move mouse relative to current position (via REST API)
   * @param deltaX - Horizontal movement (negative = left, positive = right)
   * @param deltaY - Vertical movement (negative = up, positive = down)
   */
  async mouseMoveRelative(deltaX: number, deltaY: number): Promise<void> {
    // Clamp deltas to valid range (-127 to 127)
    const clampedX = clamp(Math.round(deltaX), MOUSE_DELTA_MIN, MOUSE_DELTA_MAX);
    const clampedY = clamp(Math.round(deltaY), MOUSE_DELTA_MIN, MOUSE_DELTA_MAX);

    const params = new URLSearchParams();
    params.set('delta_x', clampedX.toString());
    params.set('delta_y', clampedY.toString());

    await this.request('POST', `/hid/events/send_mouse_relative?${params}`);
  }

  /**
   * Click mouse button (via REST API)
   */
  async mouseClick(button: MouseButton = 'left', options?: KeyOptions): Promise<void> {
    const params = new URLSearchParams();
    params.set('button', button);

    if (options?.state !== undefined) {
      params.set('state', options.state.toString());
      await this.request('POST', `/hid/events/send_mouse_button?${params}`);
    } else {
      // Full click: press then release
      params.set('state', 'true');
      await this.request('POST', `/hid/events/send_mouse_button?${params}`);
      params.set('state', 'false');
      await this.request('POST', `/hid/events/send_mouse_button?${params}`);
    }
  }

  /**
   * Scroll mouse wheel (via REST API)
   */
  async mouseScroll(deltaX: number, deltaY: number): Promise<void> {
    const params = new URLSearchParams();
    params.set('delta_x', Math.round(deltaX).toString());
    params.set('delta_y', Math.round(deltaY).toString());

    await this.request('POST', `/hid/events/send_mouse_wheel?${params}`);
  }

  /**
   * Get available keymaps
   */
  async getKeymaps(): Promise<string[]> {
    const response = await this.request<{ result: { keymaps: Record<string, unknown> } }>('GET', '/hid/keymaps');
    return Object.keys(response.result.keymaps);
  }

  /**
   * Reset HID device
   */
  async resetHid(): Promise<void> {
    await this.request('POST', '/hid/reset');
  }

  /**
   * Check authentication
   */
  async checkAuth(): Promise<boolean> {
    try {
      await this.request('GET', '/auth/check');
      return true;
    } catch {
      return false;
    }
  }
}
