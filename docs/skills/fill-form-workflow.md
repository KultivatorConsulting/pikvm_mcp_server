# fill-form-workflow

> MCP Prompt: `fill-form-workflow`

Step-by-step procedure for filling in a form on screen.

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `form_description` | No | Description of the form or the fields to fill in |

## Workflow Steps

### Step 1 — Screenshot and Identify Fields

Call `pikvm_screenshot` and identify all input fields, their labels, current values, and positions.

### Step 2 — For Each Field

Repeat for every field that needs to be filled:

1. **Click the field** — Use `pikvm_mouse_click` at the field's center coordinates to focus it.
2. **Clear existing content** (if any) — Use `pikvm_shortcut` with `["ControlLeft", "KeyA"]` to select all, then `pikvm_key` with `Delete` or `Backspace`.
3. **Type the value** — Use `pikvm_type` with the desired text.
4. **Move to next field** — Use `pikvm_key` with `Tab` to advance, or click the next field directly.

### Step 3 — Verify

Take a screenshot to check all fields are filled correctly.

### Step 4 — Submit (if appropriate)

- Click the Submit/OK/Save button using `pikvm_mouse_click`, or
- Press Enter with `pikvm_key` if the form supports it.

### Step 5 — Confirm

Take a final screenshot to verify the form was accepted (look for success messages, page changes, or error indicators).

## Tips

- For dropdown/select fields: click to open, then click the desired option (take a screenshot after opening to see choices).
- For checkboxes/radio buttons: a single click toggles them.
- For date pickers: try typing the date directly into the field before attempting to use the picker widget.
- If a field requires special characters, `pikvm_type` handles them via keymap conversion.
