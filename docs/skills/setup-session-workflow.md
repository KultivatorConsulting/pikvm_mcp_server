# setup-session-workflow

> MCP Prompt: `setup-session-workflow`

Step-by-step procedure for initializing a PiKVM session.

## Arguments

None.

## Workflow Steps

### Step 1 — Check Resolution

Call `pikvm_get_resolution` to determine the screen size and confirm the connection is working.

### Step 2 — Take Initial Screenshot

Call `pikvm_screenshot` to see the current state of the remote machine. This confirms video capture is working and shows you what's on screen.

### Step 3 — Calibrate Mouse (if needed)

If you will be using mouse operations:

1. Call `pikvm_calibrate` — this moves the cursor to the screen center.
2. Call `pikvm_screenshot` — visually locate the actual cursor position.
3. If the cursor is **not** at the center, calculate correction factors:
   - factorX = expected_x / actual_x
   - factorY = expected_y / actual_y
4. Call `pikvm_set_calibration` with the calculated factors.
5. Call `pikvm_screenshot` again to verify the calibration looks correct.

### Step 4 — Verify Keyboard (optional)

If you will be typing:

1. Identify a safe text input area on screen (e.g., a terminal, text editor, address bar).
2. Click on it with `pikvm_mouse_click`.
3. Type a short test string with `pikvm_type`.
4. Take a screenshot to verify the text appeared correctly.

### Step 5 — Report Ready

Summarize:

- Screen resolution
- What OS/application is visible
- Calibration status
- Any issues detected

The session is now ready for use.
