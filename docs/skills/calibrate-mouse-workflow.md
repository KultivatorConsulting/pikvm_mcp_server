# calibrate-mouse-workflow

> MCP Prompt: `calibrate-mouse-workflow`

Step-by-step procedure for calibrating mouse coordinates.

## Arguments

None.

## Workflow Steps

Mouse calibration corrects the offset between where you tell the cursor to go and where it actually lands. Run this whenever you start a session or after a resolution change.

### Step 1 — Get Resolution

Call `pikvm_get_resolution` and note the width and height. The expected center is (width/2, height/2).

### Step 2 — Start Calibration

Call `pikvm_calibrate`. The server moves the cursor to what it believes is the screen center and returns the expected position.

### Step 3 — Screenshot and Locate Cursor

Call `pikvm_screenshot`. Find the actual cursor position in the image. The cursor is typically an arrow or crosshair.

### Step 4 — Calculate Factors

Compute:

- **factorX** = expected_x / actual_x
- **factorY** = expected_y / actual_y

Example: If expected is (960, 540) but the cursor landed at (720, 405):

- factorX = 960 / 720 = 1.3333
- factorY = 540 / 405 = 1.3333

If the cursor is exactly at center, factors are 1.0 (no correction needed).

### Step 5 — Apply Calibration

Call `pikvm_set_calibration` with the computed factorX and factorY.

### Step 6 — Verify

Move the mouse to a known corner or UI element using `pikvm_mouse_move`, then take a screenshot to confirm the cursor landed where expected. If it's still off, repeat from Step 2.

## Notes

- Calibration is automatically cleared when screen resolution changes.
- Factors are typically between 1.0 and 1.5. Values outside this range may indicate a measurement error.
- You can check current calibration at any time with `pikvm_get_calibration`.
