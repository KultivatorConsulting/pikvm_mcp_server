/**
 * PiKVM API Client
 *
 * Handles communication with PiKVM's REST API for HID control.
 * All mouse operations use the REST API which is more reliable than WebSocket.
 */

import { Agent, fetch } from 'undici';

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

export class PiKVMClient {
  private config: Required<PiKVMConfig>;
  private dispatcher: Agent;
  private cachedResolution: ScreenResolution | null = null;

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
      throw new Error(`PiKVM API error ${response.status}: ${errorText}`);
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
   * Take a screenshot
   */
  async screenshot(options?: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  }): Promise<Buffer> {
    const params = new URLSearchParams();
    if (options?.maxWidth || options?.maxHeight) {
      params.set('preview', '1');
      if (options.maxWidth) params.set('preview_max_width', options.maxWidth.toString());
      if (options.maxHeight) params.set('preview_max_height', options.maxHeight.toString());
      if (options.quality) params.set('preview_quality', options.quality.toString());
    }

    const path = `/streamer/snapshot${params.toString() ? '?' + params : ''}`;
    const arrayBuffer = await this.request<ArrayBuffer>('GET', path);
    return Buffer.from(arrayBuffer);
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
    this.cachedResolution = {
      width: response.result.streamer.source.resolution.width,
      height: response.result.streamer.source.resolution.height,
    };
    return this.cachedResolution;
  }

  /**
   * Convert pixel coordinates to PiKVM's normalized coordinate system
   * PiKVM uses range -32768 to 32767 for absolute positioning
   */
  private pixelToNormalized(pixelX: number, pixelY: number, resolution: ScreenResolution): { x: number; y: number } {
    return {
      x: remap(pixelX, 0, resolution.width - 1, MOUSE_COORD_MIN, MOUSE_COORD_MAX),
      y: remap(pixelY, 0, resolution.height - 1, MOUSE_COORD_MIN, MOUSE_COORD_MAX),
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
   * Coordinates are automatically converted to PiKVM's normalized range
   * @param x - X coordinate in pixels (0 = left edge)
   * @param y - Y coordinate in pixels (0 = top edge)
   */
  async mouseMove(x: number, y: number): Promise<void> {
    // Get screen resolution for coordinate conversion
    const resolution = await this.getResolution();
    const normalized = this.pixelToNormalized(x, y, resolution);

    const params = new URLSearchParams();
    params.set('to_x', normalized.x.toString());
    params.set('to_y', normalized.y.toString());

    await this.request('POST', `/hid/events/send_mouse_move?${params}`);
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
