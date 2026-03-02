# click-element

> MCP Prompt: `click-element`

Guide for clicking with `pikvm_mouse_click`.

## Purpose

Click a mouse button, optionally moving to a position first. Supports left, right, middle click and scroll wheel buttons.

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| button | "left" \| "right" \| "middle" \| "up" \| "down" | left | Button to click. "up"/"down" are scroll wheel buttons |
| x | number | *(current)* | X pixel coordinate to move to before clicking |
| y | number | *(current)* | Y pixel coordinate to move to before clicking |
| state | "click" \| "press" \| "release" | click | Button state |

## Example Calls

```json
{ "name": "pikvm_mouse_click", "arguments": { "x": 500, "y": 300 } }

{ "name": "pikvm_mouse_click", "arguments": { "button": "right", "x": 100, "y": 200 } }

{ "name": "pikvm_mouse_click", "arguments": { "button": "left", "x": 100, "y": 100, "state": "press" } }
```

## Tips

- Providing x and y moves the cursor **then** clicks — it's a single tool call instead of move + click.
- Use **press** and **release** states for drag-and-drop: press at the source, move, release at the destination.
- Double-click: call twice in quick succession with the same coordinates.
- Always take a screenshot first to determine accurate click coordinates.
