#!/usr/bin/env node
/**
 * PiKVM MCP Server
 *
 * Provides MCP tools for controlling remote machines via PiKVM.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { PiKVMClient } from './pikvm/client.js';
import { loadConfig } from './config.js';

// Defer initialization to main() for proper error handling
let pikvm: PiKVMClient;

// ============================================================================
// Input Validation Helpers
// ============================================================================

/**
 * Validate that a value is a string, returning undefined if not
 */
function validateString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Validate that a value is a string and non-empty, throwing if required but missing
 */
function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${fieldName} is required and must be a non-empty string`);
  }
  return value;
}

/**
 * Validate and clamp a number to bounds, returning undefined if not a number
 */
function validateNumber(value: unknown, min?: number, max?: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  let result = value;
  if (min !== undefined) result = Math.max(min, result);
  if (max !== undefined) result = Math.min(max, result);
  return result;
}

/**
 * Validate that a value is a number, throwing if required but missing
 */
function requireNumber(value: unknown, fieldName: string, min?: number, max?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${fieldName} is required and must be a number`);
  }
  let result = value;
  if (min !== undefined) result = Math.max(min, result);
  if (max !== undefined) result = Math.min(max, result);
  return result;
}

/**
 * Validate that a value is a boolean
 */
function validateBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

/**
 * Validate that a value is an array of strings with at least one element
 */
function requireStringArray(value: unknown, fieldName: string, minLength = 1): string[] {
  if (!Array.isArray(value) || value.length < minLength) {
    throw new Error(`${fieldName} must be an array with at least ${minLength} element(s)`);
  }
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      throw new Error(`${fieldName} must contain only strings`);
    }
    result.push(item);
  }
  return result;
}

/**
 * Validate optional string array
 */
function validateStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

/**
 * Validate enum value
 */
function validateEnum<T extends string>(value: unknown, allowed: readonly T[], defaultValue: T): T {
  if (typeof value === 'string' && allowed.includes(value as T)) {
    return value as T;
  }
  return defaultValue;
}

const VALID_BUTTONS = ['left', 'right', 'middle', 'up', 'down'] as const;
const VALID_KEY_STATES = ['press', 'release', 'click'] as const;

// Define available tools
const tools: Tool[] = [
  {
    name: 'pikvm_screenshot',
    description: 'Capture a screenshot from the PiKVM video stream. Returns the current screen as a JPEG image.',
    inputSchema: {
      type: 'object',
      properties: {
        maxWidth: {
          type: 'number',
          description: 'Maximum width of the screenshot in pixels (optional, for preview)',
        },
        maxHeight: {
          type: 'number',
          description: 'Maximum height of the screenshot in pixels (optional, for preview)',
        },
        quality: {
          type: 'number',
          description: 'JPEG quality 1-100 (optional, default 80)',
        },
      },
    },
  },
  {
    name: 'pikvm_get_resolution',
    description: 'Get the current screen resolution of the remote machine. Useful for knowing valid coordinate ranges for mouse operations.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'pikvm_type',
    description: 'Type text on the remote machine using PiKVM. Handles special characters correctly via keymap conversion.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The text to type',
        },
        keymap: {
          type: 'string',
          description: 'Keyboard layout (default: en-us)',
        },
        slow: {
          type: 'boolean',
          description: 'Use slow typing mode for compatibility',
        },
        delay: {
          type: 'number',
          description: 'Delay between keystrokes in ms (0-200)',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'pikvm_key',
    description: 'Send a key or key combination to the remote machine. Use JavaScript key codes (e.g., KeyA, Enter, ControlLeft).',
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Key code (e.g., KeyA, Enter, Escape, F1)',
        },
        modifiers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Modifier keys to hold (e.g., ["ControlLeft", "AltLeft"])',
        },
        state: {
          type: 'string',
          enum: ['press', 'release', 'click'],
          description: 'Key state: press (hold), release, or click (press+release, default)',
        },
      },
      required: ['key'],
    },
  },
  {
    name: 'pikvm_shortcut',
    description: 'Send a keyboard shortcut (multiple keys pressed simultaneously). Example: Ctrl+Alt+Delete',
    inputSchema: {
      type: 'object',
      properties: {
        keys: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of key codes to press together (e.g., ["ControlLeft", "AltLeft", "Delete"])',
        },
      },
      required: ['keys'],
    },
  },
  {
    name: 'pikvm_mouse_move',
    description: 'Move the mouse cursor to a position on the remote machine. For absolute moves, coordinates are in screen pixels (0,0 = top-left). For relative moves, deltas are clamped to -127 to 127.',
    inputSchema: {
      type: 'object',
      properties: {
        x: {
          type: 'number',
          description: 'X coordinate in pixels (absolute) or delta pixels (relative)',
        },
        y: {
          type: 'number',
          description: 'Y coordinate in pixels (absolute) or delta pixels (relative)',
        },
        relative: {
          type: 'boolean',
          description: 'If true, move relative to current position (delta -127 to 127). Default: false (absolute pixel position)',
        },
      },
      required: ['x', 'y'],
    },
  },
  {
    name: 'pikvm_mouse_click',
    description: 'Click a mouse button on the remote machine. Optionally move to a pixel position first.',
    inputSchema: {
      type: 'object',
      properties: {
        button: {
          type: 'string',
          enum: ['left', 'right', 'middle', 'up', 'down'],
          description: 'Mouse button to click (default: left). "up" and "down" are scroll wheel buttons.',
        },
        x: {
          type: 'number',
          description: 'X pixel coordinate to move to before clicking (optional)',
        },
        y: {
          type: 'number',
          description: 'Y pixel coordinate to move to before clicking (optional)',
        },
        state: {
          type: 'string',
          enum: ['press', 'release', 'click'],
          description: 'Button state: press (hold), release, or click (default)',
        },
      },
    },
  },
  {
    name: 'pikvm_mouse_scroll',
    description: 'Scroll the mouse wheel on the remote machine.',
    inputSchema: {
      type: 'object',
      properties: {
        deltaX: {
          type: 'number',
          description: 'Horizontal scroll amount (negative = left, positive = right)',
        },
        deltaY: {
          type: 'number',
          description: 'Vertical scroll amount (negative = up, positive = down)',
        },
      },
      required: ['deltaY'],
    },
  },
];

// Create MCP server
const server = new Server(
  {
    name: 'pikvm-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case 'pikvm_screenshot': {
        const buffer = await pikvm.screenshot({
          maxWidth: validateNumber(args.maxWidth, 1, 10000),
          maxHeight: validateNumber(args.maxHeight, 1, 10000),
          quality: validateNumber(args.quality, 1, 100),
        });
        return {
          content: [
            {
              type: 'image',
              data: buffer.toString('base64'),
              mimeType: 'image/jpeg',
            },
          ],
        };
      }

      case 'pikvm_get_resolution': {
        const resolution = await pikvm.getResolution(true); // force refresh
        return {
          content: [
            {
              type: 'text',
              text: `Screen resolution: ${resolution.width}x${resolution.height} pixels. Valid mouse coordinates: x=0-${resolution.width - 1}, y=0-${resolution.height - 1}`,
            },
          ],
        };
      }

      case 'pikvm_type': {
        const text = requireString(args.text, 'text');
        await pikvm.type(text, {
          keymap: validateString(args.keymap),
          slow: validateBoolean(args.slow),
          delay: validateNumber(args.delay, 0, 200),
        });
        // Don't echo full text in response to avoid leaking sensitive input
        const displayText = text.length > 50 ? `${text.substring(0, 50)}...` : text;
        return {
          content: [{ type: 'text', text: `Typed ${text.length} character(s): "${displayText}"` }],
        };
      }

      case 'pikvm_key': {
        const key = requireString(args.key, 'key');
        const modifiers = validateStringArray(args.modifiers);
        const state = validateEnum(args.state, VALID_KEY_STATES, 'click');

        // Press modifiers
        for (const mod of modifiers) {
          await pikvm.sendKey(mod, { state: true });
        }

        // Send main key
        if (state === 'press') {
          await pikvm.sendKey(key, { state: true });
        } else if (state === 'release') {
          await pikvm.sendKey(key, { state: false });
        } else {
          await pikvm.sendKey(key); // click
        }

        // Release modifiers (in reverse order)
        for (const mod of [...modifiers].reverse()) {
          await pikvm.sendKey(mod, { state: false });
        }

        return {
          content: [
            {
              type: 'text',
              text: modifiers.length > 0
                ? `Sent key: ${modifiers.join('+')}+${key}`
                : `Sent key: ${key}`,
            },
          ],
        };
      }

      case 'pikvm_shortcut': {
        const keys = requireStringArray(args.keys, 'keys', 1);
        if (keys.length > 10) {
          throw new Error('keys array must have at most 10 elements');
        }
        await pikvm.sendShortcut(keys);
        return {
          content: [{ type: 'text', text: `Sent shortcut: ${keys.join('+')}` }],
        };
      }

      case 'pikvm_mouse_move': {
        const x = requireNumber(args.x, 'x');
        const y = requireNumber(args.y, 'y');
        const relative = validateBoolean(args.relative) ?? false;
        if (relative) {
          // Relative moves are clamped to -127 to 127 in the client
          await pikvm.mouseMoveRelative(x, y);
        } else {
          // Absolute moves should be positive pixel coordinates
          const clampedX = Math.max(0, Math.round(x));
          const clampedY = Math.max(0, Math.round(y));
          await pikvm.mouseMove(clampedX, clampedY);
        }
        return {
          content: [
            {
              type: 'text',
              text: relative
                ? `Moved mouse by (${x}, ${y})`
                : `Moved mouse to pixel (${Math.max(0, Math.round(x))}, ${Math.max(0, Math.round(y))})`,
            },
          ],
        };
      }

      case 'pikvm_mouse_click': {
        const button = validateEnum(args.button, VALID_BUTTONS, 'left');
        const clickX = validateNumber(args.x, 0);
        const clickY = validateNumber(args.y, 0);

        // Move to position first if specified
        if (clickX !== undefined && clickY !== undefined) {
          await pikvm.mouseMove(Math.round(clickX), Math.round(clickY));
        }

        const state = validateEnum(args.state, VALID_KEY_STATES, 'click');
        if (state === 'press') {
          await pikvm.mouseClick(button, { state: true });
        } else if (state === 'release') {
          await pikvm.mouseClick(button, { state: false });
        } else {
          await pikvm.mouseClick(button);
        }

        return {
          content: [{ type: 'text', text: `${button} click` }],
        };
      }

      case 'pikvm_mouse_scroll': {
        const deltaY = requireNumber(args.deltaY, 'deltaY');
        const deltaX = validateNumber(args.deltaX) ?? 0;
        await pikvm.mouseScroll(deltaX, deltaY);
        return {
          content: [
            {
              type: 'text',
              text: `Scrolled (${deltaX}, ${deltaY})`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    // Sanitize error messages to avoid exposing sensitive information
    let message: string;
    if (error instanceof Error) {
      // Strip any potential credential information from error messages
      message = error.message
        .replace(/X-KVMD-Passwd[^,\s]*/gi, 'X-KVMD-Passwd=[REDACTED]')
        .replace(/password[=:][^\s,]*/gi, 'password=[REDACTED]');
    } else {
      message = 'An unexpected error occurred';
    }
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  // Load configuration (deferred to here for proper error handling)
  const config = loadConfig();
  pikvm = new PiKVMClient(config.pikvm);

  // Verify connection on startup
  const authOk = await pikvm.checkAuth();
  if (!authOk) {
    console.error('Warning: Could not authenticate with PiKVM. Check credentials.');
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('PiKVM MCP Server running');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
