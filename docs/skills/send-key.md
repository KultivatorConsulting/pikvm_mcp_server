# send-key

> MCP Prompt: `send-key`

Guide for sending keys with `pikvm_key`.

## Purpose

Send a single key event, optionally with modifier keys held down. Use this for control keys, function keys, and modifier combos that aren't representable as plain text.

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| key | string | *(required)* | JavaScript key code (e.g., Enter, KeyA, F5) |
| modifiers | string[] | [] | Modifier keys to hold while pressing key |
| state | "click" \| "press" \| "release" | click | Key state — click sends press+release |

## Common Key Codes

- Letters: KeyA ... KeyZ
- Digits: Digit0 ... Digit9
- Function: F1 ... F12
- Modifiers: ShiftLeft, ControlLeft, AltLeft, MetaLeft (and Right variants)
- Special: Enter, Escape, Backspace, Tab, Space, Delete, Insert, Home, End, PageUp, PageDown
- Arrows: ArrowUp, ArrowDown, ArrowLeft, ArrowRight

## Example Calls

```json
{ "name": "pikvm_key", "arguments": { "key": "Enter" } }

{ "name": "pikvm_key", "arguments": { "key": "KeyS", "modifiers": ["ControlLeft"] } }

{ "name": "pikvm_key", "arguments": { "key": "ShiftLeft", "state": "press" } }
```

## Tips

- For simultaneous multi-key shortcuts (e.g., Ctrl+Alt+Del), prefer `pikvm_shortcut` — it presses all keys in one operation.
- Use **press** / **release** states for drag operations or when you need a modifier held across multiple actions.
- Modifiers are automatically pressed before and released after the main key.
