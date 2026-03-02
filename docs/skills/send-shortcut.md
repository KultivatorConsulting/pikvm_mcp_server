# send-shortcut

> MCP Prompt: `send-shortcut`

Guide for sending keyboard shortcuts with `pikvm_shortcut`.

## Purpose

Press multiple keys simultaneously. All keys are pressed in order, then released in reverse order, mimicking a human pressing a shortcut.

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| keys | string[] | *(required)* | Array of key codes to press together (max 10) |

## Example Calls

```json
{ "name": "pikvm_shortcut", "arguments": { "keys": ["ControlLeft", "AltLeft", "Delete"] } }

{ "name": "pikvm_shortcut", "arguments": { "keys": ["ControlLeft", "KeyC"] } }

{ "name": "pikvm_shortcut", "arguments": { "keys": ["AltLeft", "F4"] } }
```

## Tips

- List **modifier keys first**, then the action key — this mirrors how humans press shortcuts.
- Maximum of **10 keys** per call.
- Common shortcuts: Ctrl+C (copy), Ctrl+V (paste), Ctrl+Z (undo), Alt+Tab (switch window), Ctrl+Alt+Delete (security attention).
- If you only need one key with modifiers, `pikvm_key` with the `modifiers` parameter works too. `pikvm_shortcut` is better when there are many keys or no single "main" key.
