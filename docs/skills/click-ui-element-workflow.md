# click-ui-element-workflow

> MCP Prompt: `click-ui-element-workflow`

Step-by-step procedure for finding and clicking a UI element.

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `element_description` | Yes | Description of the UI element to click (e.g., "the Save button", "the File menu") |

## Workflow Steps

### Step 1 — Observe

Take a screenshot with `pikvm_screenshot` to see the current screen state.

### Step 2 — Analyze

Examine the screenshot and locate the target element. Identify its approximate center coordinates in pixels.

If the element is **not visible**:

- It may be off-screen — try scrolling with `pikvm_mouse_scroll`.
- It may be behind another window — try Alt+Tab or click elsewhere first.
- It may require a menu or dialog to be opened first.

### Step 3 — Click

Call `pikvm_mouse_click` with the x and y coordinates of the element center.

```json
{ "name": "pikvm_mouse_click", "arguments": { "x": <x>, "y": <y> } }
```

### Step 4 — Verify

Take another screenshot to confirm:

- The element was clicked (e.g., a menu opened, a button was pressed, a field is focused).
- The expected result occurred.

If the click missed, adjust coordinates and retry. If calibration seems off, run the calibrate-mouse-workflow first.
