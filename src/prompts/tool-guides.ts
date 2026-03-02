/**
 * Tool guide prompts — one per PiKVM tool that agents commonly use.
 */

import type { PromptDefinition } from './types.js';

export const toolGuidePrompts: PromptDefinition[] = [
  // ---------- take-screenshot ----------
  {
    name: 'take-screenshot',
    description: 'Guide for capturing screenshots with pikvm_screenshot',
    getMessages() {
      return [
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: `# pikvm_screenshot — Capture a Screenshot

## Purpose
Capture the current screen of the remote machine as a JPEG image. This is your primary way to **see** what is on screen.

## Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| maxWidth | number | *(native)* | Maximum width in pixels — image is scaled down if the screen is wider |
| maxHeight | number | *(native)* | Maximum height in pixels — image is scaled down if the screen is taller |
| quality | number | 80 | JPEG quality (1-100) |

Scaling preserves aspect ratio. When you scale a screenshot, the server tracks the scale factor so that mouse coordinates you derive from the image are automatically mapped back to native resolution.

## Example Call
\`\`\`json
{
  "name": "pikvm_screenshot",
  "arguments": { "maxWidth": 1280, "quality": 70 }
}
\`\`\`

## Tips
- Omit maxWidth/maxHeight to get the full native resolution — best for reading small text.
- Use lower quality (50-60) when you only need layout/position information to save bandwidth.
- Always take a screenshot **after** performing an action to verify the result.
- The response includes a text line describing dimensions and any scaling that was applied.`,
          },
        },
      ];
    },
  },

  // ---------- check-resolution ----------
  {
    name: 'check-resolution',
    description: 'Guide for checking screen resolution with pikvm_get_resolution',
    getMessages() {
      return [
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: `# pikvm_get_resolution — Check Screen Resolution

## Purpose
Return the current width and height of the remote screen in pixels. The result defines the valid coordinate space for all mouse operations.

## Parameters
None.

## Example Call
\`\`\`json
{ "name": "pikvm_get_resolution" }
\`\`\`

## When to Call
- At the **start of a session** so you know the coordinate space before any mouse interaction.
- After the remote machine might have **changed resolution** (e.g., opening a game, switching display settings).
- Before **calibration** — the calibrate workflow uses this value.

## Tips
- Valid mouse coordinates range from (0, 0) to (width-1, height-1).
- If the resolution changes after you have calibrated, calibration is **automatically invalidated** — you will need to recalibrate.`,
          },
        },
      ];
    },
  },

  // ---------- type-text ----------
  {
    name: 'type-text',
    description: 'Guide for typing text with pikvm_type',
    getMessages() {
      return [
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: `# pikvm_type — Type Text

## Purpose
Type a string of text on the remote machine. The server converts characters into the correct HID key events using the specified keyboard layout, so special characters (e.g., @, #, {) are handled correctly.

## Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| text | string | *(required)* | The text to type |
| keymap | string | en-us | Keyboard layout for character-to-key conversion |
| slow | boolean | false | Use slow typing mode (adds extra delays for compatibility) |
| delay | number | *(default)* | Delay between keystrokes in ms (0-200) |

## Example Call
\`\`\`json
{
  "name": "pikvm_type",
  "arguments": { "text": "Hello, world!", "slow": true }
}
\`\`\`

## Tips
- Use \`pikvm_type\` for printable text. For control keys (Enter, Tab, Escape, etc.) use \`pikvm_key\` instead.
- Enable **slow** mode or increase **delay** if the target machine drops characters.
- Very long strings may hit PiKVM endpoint limits — keep individual calls under ~1000 characters and split longer text into multiple calls.
- The response shows a truncated preview of what was typed (first 50 chars) for privacy.`,
          },
        },
      ];
    },
  },

  // ---------- send-key ----------
  {
    name: 'send-key',
    description: 'Guide for sending keys with pikvm_key',
    getMessages() {
      return [
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: `# pikvm_key — Send a Key or Key Combination

## Purpose
Send a single key event, optionally with modifier keys held down. Use this for control keys, function keys, and modifier combos that aren't representable as plain text.

## Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| key | string | *(required)* | JavaScript key code (e.g., Enter, KeyA, F5) |
| modifiers | string[] | [] | Modifier keys to hold while pressing key |
| state | "click" \\| "press" \\| "release" | click | Key state — click sends press+release |

## Common Key Codes
- Letters: KeyA … KeyZ
- Digits: Digit0 … Digit9
- Function: F1 … F12
- Modifiers: ShiftLeft, ControlLeft, AltLeft, MetaLeft (and Right variants)
- Special: Enter, Escape, Backspace, Tab, Space, Delete, Insert, Home, End, PageUp, PageDown
- Arrows: ArrowUp, ArrowDown, ArrowLeft, ArrowRight

## Example Calls
\`\`\`json
{ "name": "pikvm_key", "arguments": { "key": "Enter" } }

{ "name": "pikvm_key", "arguments": { "key": "KeyS", "modifiers": ["ControlLeft"] } }

{ "name": "pikvm_key", "arguments": { "key": "ShiftLeft", "state": "press" } }
\`\`\`

## Tips
- For simultaneous multi-key shortcuts (e.g., Ctrl+Alt+Del), prefer \`pikvm_shortcut\` — it presses all keys in one operation.
- Use **press** / **release** states for drag operations or when you need a modifier held across multiple actions.
- Modifiers are automatically pressed before and released after the main key.`,
          },
        },
      ];
    },
  },

  // ---------- send-shortcut ----------
  {
    name: 'send-shortcut',
    description: 'Guide for sending keyboard shortcuts with pikvm_shortcut',
    getMessages() {
      return [
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: `# pikvm_shortcut — Send a Keyboard Shortcut

## Purpose
Press multiple keys simultaneously. All keys are pressed in order, then released in reverse order, mimicking a human pressing a shortcut.

## Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| keys | string[] | *(required)* | Array of key codes to press together (max 10) |

## Example Calls
\`\`\`json
{ "name": "pikvm_shortcut", "arguments": { "keys": ["ControlLeft", "AltLeft", "Delete"] } }

{ "name": "pikvm_shortcut", "arguments": { "keys": ["ControlLeft", "KeyC"] } }

{ "name": "pikvm_shortcut", "arguments": { "keys": ["AltLeft", "F4"] } }
\`\`\`

## Tips
- List **modifier keys first**, then the action key — this mirrors how humans press shortcuts.
- Maximum of **10 keys** per call.
- Common shortcuts: Ctrl+C (copy), Ctrl+V (paste), Ctrl+Z (undo), Alt+Tab (switch window), Ctrl+Alt+Delete (security attention).
- If you only need one key with modifiers, \`pikvm_key\` with the \`modifiers\` parameter works too. \`pikvm_shortcut\` is better when there are many keys or no single "main" key.`,
          },
        },
      ];
    },
  },

  // ---------- move-mouse ----------
  {
    name: 'move-mouse',
    description: 'Guide for moving the mouse with pikvm_mouse_move',
    getMessages() {
      return [
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: `# pikvm_mouse_move — Move the Mouse Cursor

## Purpose
Move the mouse cursor to an absolute pixel position or by a relative delta.

## Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| x | number | *(required)* | X coordinate (absolute) or delta (relative) |
| y | number | *(required)* | Y coordinate (absolute) or delta (relative) |
| relative | boolean | false | If true, move relative to current position |

## Coordinate Space
- **Absolute mode** (default): (0, 0) is the top-left corner. Maximum values are (width-1, height-1) from \`pikvm_get_resolution\`.
- **Relative mode**: Deltas are clamped to -127 to 127 per call. Use multiple calls for larger relative moves.

## Example Calls
\`\`\`json
{ "name": "pikvm_mouse_move", "arguments": { "x": 500, "y": 300 } }

{ "name": "pikvm_mouse_move", "arguments": { "x": -50, "y": 0, "relative": true } }
\`\`\`

## Tips
- If calibration is active, absolute coordinates are automatically adjusted.
- A **resolution change** will invalidate calibration — you'll see a warning in the response.
- To move and click in one step, use \`pikvm_mouse_click\` with x/y parameters instead.`,
          },
        },
      ];
    },
  },

  // ---------- click-element ----------
  {
    name: 'click-element',
    description: 'Guide for clicking with pikvm_mouse_click',
    getMessages() {
      return [
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: `# pikvm_mouse_click — Click a Mouse Button

## Purpose
Click a mouse button, optionally moving to a position first. Supports left, right, middle click and scroll wheel buttons.

## Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| button | "left" \\| "right" \\| "middle" \\| "up" \\| "down" | left | Button to click. "up"/"down" are scroll wheel buttons |
| x | number | *(current)* | X pixel coordinate to move to before clicking |
| y | number | *(current)* | Y pixel coordinate to move to before clicking |
| state | "click" \\| "press" \\| "release" | click | Button state |

## Example Calls
\`\`\`json
{ "name": "pikvm_mouse_click", "arguments": { "x": 500, "y": 300 } }

{ "name": "pikvm_mouse_click", "arguments": { "button": "right", "x": 100, "y": 200 } }

{ "name": "pikvm_mouse_click", "arguments": { "button": "left", "x": 100, "y": 100, "state": "press" } }
\`\`\`

## Tips
- Providing x and y moves the cursor **then** clicks — it's a single tool call instead of move + click.
- Use **press** and **release** states for drag-and-drop: press at the source, move, release at the destination.
- Double-click: call twice in quick succession with the same coordinates.
- Always take a screenshot first to determine accurate click coordinates.`,
          },
        },
      ];
    },
  },

  // ---------- scroll-page ----------
  {
    name: 'scroll-page',
    description: 'Guide for scrolling with pikvm_mouse_scroll',
    getMessages() {
      return [
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: `# pikvm_mouse_scroll — Scroll the Mouse Wheel

## Purpose
Scroll the mouse wheel vertically or horizontally.

## Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| deltaY | number | *(required)* | Vertical scroll: negative = scroll up, positive = scroll down |
| deltaX | number | 0 | Horizontal scroll: negative = scroll left, positive = scroll right |

## Example Calls
\`\`\`json
{ "name": "pikvm_mouse_scroll", "arguments": { "deltaY": -3 } }

{ "name": "pikvm_mouse_scroll", "arguments": { "deltaY": 5, "deltaX": 2 } }
\`\`\`

## Tips
- A deltaY of **-3 to -5** is a reasonable "scroll up one section" amount; **3 to 5** for scrolling down.
- Move the cursor over the target area first if the scroll should apply to a specific pane or element.
- For long pages, use multiple scroll calls with screenshots in between to verify you've reached the desired content.
- Horizontal scrolling is less commonly supported — verify it works on the target application.`,
          },
        },
      ];
    },
  },
];
