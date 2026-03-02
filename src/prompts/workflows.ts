/**
 * Workflow prompts — multi-step recipes combining several PiKVM tools.
 */

import type { PromptDefinition } from './types.js';

export const workflowPrompts: PromptDefinition[] = [
  // ---------- setup-session-workflow ----------
  {
    name: 'setup-session-workflow',
    description: 'Step-by-step procedure for initializing a PiKVM session',
    getMessages() {
      return [
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'I need to start a new PiKVM session and make sure everything is working before I begin interacting with the remote machine.',
          },
        },
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: `# Setup Session Workflow

Follow these steps to initialize a PiKVM session:

## Step 1 — Check Resolution
Call \`pikvm_get_resolution\` to determine the screen size and confirm the connection is working.

## Step 2 — Take Initial Screenshot
Call \`pikvm_screenshot\` to see the current state of the remote machine. This confirms video capture is working and shows you what's on screen.

## Step 3 — Calibrate Mouse (if needed)
If you will be using mouse operations:
1. Call \`pikvm_calibrate\` — this moves the cursor to the screen center.
2. Call \`pikvm_screenshot\` — visually locate the actual cursor position.
3. If the cursor is **not** at the center, calculate correction factors:
   - factorX = expected_x / actual_x
   - factorY = expected_y / actual_y
4. Call \`pikvm_set_calibration\` with the calculated factors.
5. Call \`pikvm_screenshot\` again to verify the calibration looks correct.

## Step 4 — Verify Keyboard (optional)
If you will be typing:
1. Identify a safe text input area on screen (e.g., a terminal, text editor, address bar).
2. Click on it with \`pikvm_mouse_click\`.
3. Type a short test string with \`pikvm_type\`.
4. Take a screenshot to verify the text appeared correctly.

## Step 5 — Report Ready
Summarize:
- Screen resolution
- What OS/application is visible
- Calibration status
- Any issues detected

The session is now ready for use.`,
          },
        },
      ];
    },
  },

  // ---------- calibrate-mouse-workflow ----------
  {
    name: 'calibrate-mouse-workflow',
    description: 'Step-by-step procedure for calibrating mouse coordinates',
    getMessages() {
      return [
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'I need to calibrate the mouse so that click coordinates are accurate.',
          },
        },
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: `# Calibrate Mouse Workflow

Mouse calibration corrects the offset between where you tell the cursor to go and where it actually lands. Run this whenever you start a session or after a resolution change.

## Step 1 — Get Resolution
Call \`pikvm_get_resolution\` and note the width and height. The expected center is (width/2, height/2).

## Step 2 — Start Calibration
Call \`pikvm_calibrate\`. The server moves the cursor to what it believes is the screen center and returns the expected position.

## Step 3 — Screenshot and Locate Cursor
Call \`pikvm_screenshot\`. Find the actual cursor position in the image. The cursor is typically an arrow or crosshair.

## Step 4 — Calculate Factors
Compute:
- **factorX** = expected_x / actual_x
- **factorY** = expected_y / actual_y

Example: If expected is (960, 540) but the cursor landed at (720, 405):
- factorX = 960 / 720 = 1.3333
- factorY = 540 / 405 = 1.3333

If the cursor is exactly at center, factors are 1.0 (no correction needed).

## Step 5 — Apply Calibration
Call \`pikvm_set_calibration\` with the computed factorX and factorY.

## Step 6 — Verify
Move the mouse to a known corner or UI element using \`pikvm_mouse_move\`, then take a screenshot to confirm the cursor landed where expected. If it's still off, repeat from Step 2.

## Notes
- Calibration is automatically cleared when screen resolution changes.
- Factors are typically between 1.0 and 1.5. Values outside this range may indicate a measurement error.
- You can check current calibration at any time with \`pikvm_get_calibration\`.`,
          },
        },
      ];
    },
  },

  // ---------- click-ui-element-workflow ----------
  {
    name: 'click-ui-element-workflow',
    description: 'Step-by-step procedure for finding and clicking a UI element',
    arguments: [
      {
        name: 'element_description',
        description: 'Description of the UI element to click (e.g., "the Save button", "the File menu")',
        required: true,
      },
    ],
    getMessages(args) {
      const element = args?.element_description || '[not specified]';
      return [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `I need to click on: ${element}`,
          },
        },
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: `# Click UI Element Workflow

Target: **${element}**

## Step 1 — Observe
Take a screenshot with \`pikvm_screenshot\` to see the current screen state.

## Step 2 — Analyze
Examine the screenshot and locate **${element}**. Identify its approximate center coordinates in pixels.

If the element is **not visible**:
- It may be off-screen — try scrolling with \`pikvm_mouse_scroll\`.
- It may be behind another window — try Alt+Tab or click elsewhere first.
- It may require a menu or dialog to be opened first.

## Step 3 — Click
Call \`pikvm_mouse_click\` with the x and y coordinates of the element center.
\`\`\`json
{ "name": "pikvm_mouse_click", "arguments": { "x": <x>, "y": <y> } }
\`\`\`

## Step 4 — Verify
Take another screenshot to confirm:
- The element was clicked (e.g., a menu opened, a button was pressed, a field is focused).
- The expected result occurred.

If the click missed, adjust coordinates and retry. If calibration seems off, run the calibrate-mouse-workflow first.`,
          },
        },
      ];
    },
  },

  // ---------- fill-form-workflow ----------
  {
    name: 'fill-form-workflow',
    description: 'Step-by-step procedure for filling in a form on screen',
    arguments: [
      {
        name: 'form_description',
        description: 'Description of the form or the fields to fill in',
        required: false,
      },
    ],
    getMessages(args) {
      const form = args?.form_description || 'the visible form';
      return [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `I need to fill in ${form}.`,
          },
        },
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: `# Fill Form Workflow

Target: **${form}**

## Step 1 — Screenshot and Identify Fields
Call \`pikvm_screenshot\` and identify all input fields, their labels, current values, and positions.

## Step 2 — For Each Field
Repeat for every field that needs to be filled:

1. **Click the field** — Use \`pikvm_mouse_click\` at the field's center coordinates to focus it.
2. **Clear existing content** (if any) — Use \`pikvm_shortcut\` with \`["ControlLeft", "KeyA"]\` to select all, then \`pikvm_key\` with \`Delete\` or \`Backspace\`.
3. **Type the value** — Use \`pikvm_type\` with the desired text.
4. **Move to next field** — Use \`pikvm_key\` with \`Tab\` to advance, or click the next field directly.

## Step 3 — Verify
Take a screenshot to check all fields are filled correctly.

## Step 4 — Submit (if appropriate)
- Click the Submit/OK/Save button using \`pikvm_mouse_click\`, or
- Press Enter with \`pikvm_key\` if the form supports it.

## Step 5 — Confirm
Take a final screenshot to verify the form was accepted (look for success messages, page changes, or error indicators).

## Tips
- For dropdown/select fields: click to open, then click the desired option (take a screenshot after opening to see choices).
- For checkboxes/radio buttons: a single click toggles them.
- For date pickers: try typing the date directly into the field before attempting to use the picker widget.
- If a field requires special characters, \`pikvm_type\` handles them via keymap conversion.`,
          },
        },
      ];
    },
  },

  // ---------- navigate-desktop-workflow ----------
  {
    name: 'navigate-desktop-workflow',
    description: 'Step-by-step procedure for navigating a desktop environment',
    arguments: [
      {
        name: 'goal',
        description: 'What you want to accomplish (e.g., "open Firefox", "find and open a file")',
        required: true,
      },
    ],
    getMessages(args) {
      const goal = args?.goal || '[not specified]';
      return [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `I need to navigate the desktop to: ${goal}`,
          },
        },
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: `# Navigate Desktop Workflow

Goal: **${goal}**

Use an **Observe-Plan-Act-Verify** loop until the goal is achieved.

## The Loop

### Observe
Take a screenshot with \`pikvm_screenshot\`. Identify:
- What OS / desktop environment is running (Windows, macOS, Linux/GNOME, Linux/KDE, etc.)
- What applications/windows are currently open
- Where relevant UI elements are (taskbar, dock, menus, desktop icons)

### Plan
Decide the next action to get closer to the goal. Common desktop patterns:

**Opening applications:**
- Taskbar/dock: click the application icon
- Start menu / application launcher: click the menu button, then search or browse
- Terminal: open a terminal and run the application command
- Desktop shortcut: double-click the icon

**Common shortcuts:**
- Open file manager: often on taskbar or via Super key
- Open terminal: Ctrl+Alt+T (many Linux DEs), or right-click desktop
- Search: Super key (Windows/GNOME), Cmd+Space (macOS)
- Switch windows: Alt+Tab
- Show desktop: Super+D (Windows/some Linux)
- Close window: Alt+F4

### Act
Execute the planned action using the appropriate PiKVM tool:
- \`pikvm_mouse_click\` for clicking UI elements
- \`pikvm_key\` or \`pikvm_shortcut\` for keyboard shortcuts
- \`pikvm_type\` for typing in search bars or terminals
- \`pikvm_mouse_scroll\` for scrolling through menus or file lists

### Verify
Take another screenshot to confirm the action had the expected effect. If not, reassess and try an alternative approach.

## Repeat
Continue the Observe-Plan-Act-Verify loop until the goal **${goal}** is achieved. If you get stuck, try a different approach (e.g., use keyboard shortcuts instead of mouse, or use a terminal command instead of the GUI).`,
          },
        },
      ];
    },
  },
];
