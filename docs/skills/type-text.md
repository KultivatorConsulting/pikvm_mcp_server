# type-text

> MCP Prompt: `type-text`

Guide for typing text with `pikvm_type`.

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

```json
{
  "name": "pikvm_type",
  "arguments": { "text": "Hello, world!", "slow": true }
}
```

## Tips

- Use `pikvm_type` for printable text. For control keys (Enter, Tab, Escape, etc.) use `pikvm_key` instead.
- Enable **slow** mode or increase **delay** if the target machine drops characters.
- Very long strings may hit PiKVM endpoint limits — keep individual calls under ~1000 characters and split longer text into multiple calls.
- The response shows a truncated preview of what was typed (first 50 chars) for privacy.
