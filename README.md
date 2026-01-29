# PiKVM MCP Server

An MCP (Model Context Protocol) server that provides direct API access to PiKVM devices, enabling Claude Code and other MCP clients to control remote machines via keyboard, mouse, and screenshots.

## Features

- **Screenshot capture** - Get current screen as JPEG image
- **Text typing** - Type text with proper special character handling via keymaps
- **Keyboard control** - Send individual keys or key combinations (e.g., Ctrl+Alt+Delete)
- **Mouse control** - Move, click, and scroll

## Installation

```bash
npm install
npm run build
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env`:
```
PIKVM_HOST=https://192.168.1.71
PIKVM_USERNAME=admin
PIKVM_PASSWORD=your_password
PIKVM_VERIFY_SSL=false
PIKVM_DEFAULT_KEYMAP=en-us
```

## Usage with Claude Code

Add to your Claude Code MCP settings (`~/.config/claude-code/settings.json` or via the settings UI):

```json
{
  "mcpServers": {
    "pikvm": {
      "command": "node",
      "args": ["/path/to/pikvm_mcp_server/dist/index.js"],
      "env": {
        "PIKVM_HOST": "https://192.168.1.71",
        "PIKVM_USERNAME": "admin",
        "PIKVM_PASSWORD": "your_password"
      }
    }
  }
}
```

Or if using the .env file:

```json
{
  "mcpServers": {
    "pikvm": {
      "command": "node",
      "args": ["/path/to/pikvm_mcp_server/dist/index.js"]
    }
  }
}
```

## Available Tools

### pikvm_screenshot
Capture a screenshot from the remote machine.

```
Parameters:
- maxWidth (optional): Maximum width in pixels (1-10000)
- maxHeight (optional): Maximum height in pixels (1-10000)
- quality (optional): JPEG quality 1-100
```

### pikvm_get_resolution
Get the current screen resolution of the remote machine. Useful for knowing valid coordinate ranges for mouse operations.

```
Parameters: none
Returns: Screen resolution (width x height) and valid coordinate ranges
```

### pikvm_type
Type text on the remote machine. Handles special characters correctly.

```
Parameters:
- text (required): The text to type
- keymap (optional): Keyboard layout (default: en-us)
- slow (optional): Use slow typing mode
- delay (optional): Delay between keystrokes in ms (0-200)
```

### pikvm_key
Send a key or key combination.

```
Parameters:
- key (required): Key code (e.g., "Enter", "KeyA", "F1")
- modifiers (optional): Array of modifier keys ["ControlLeft", "AltLeft"]
- state (optional): "press", "release", or "click" (default)
```

### pikvm_shortcut
Send a keyboard shortcut (multiple keys simultaneously).

```
Parameters:
- keys (required): Array of key codes ["ControlLeft", "AltLeft", "Delete"]
```

### pikvm_mouse_move
Move the mouse cursor.

```
Parameters:
- x (required): X coordinate or delta
- y (required): Y coordinate or delta
- relative (optional): If true, move relative to current position
```

### pikvm_mouse_click
Click a mouse button.

```
Parameters:
- button (optional): "left", "right", "middle", "up", or "down" (default: "left")
  Note: "up" and "down" are scroll wheel buttons
- x (optional): X coordinate to move to first
- y (optional): Y coordinate to move to first
- state (optional): "press", "release", or "click" (default)
```

### pikvm_mouse_scroll
Scroll the mouse wheel.

```
Parameters:
- deltaX (optional): Horizontal scroll amount
- deltaY (required): Vertical scroll amount
```

## Key Codes Reference

Common key codes for `pikvm_key` and `pikvm_shortcut`:

- Letters: `KeyA`, `KeyB`, ... `KeyZ`
- Numbers: `Digit0`, `Digit1`, ... `Digit9`
- Function keys: `F1`, `F2`, ... `F12`
- Modifiers: `ShiftLeft`, `ShiftRight`, `ControlLeft`, `ControlRight`, `AltLeft`, `AltRight`, `MetaLeft`, `MetaRight`
- Special: `Enter`, `Escape`, `Backspace`, `Tab`, `Space`, `Delete`, `Insert`, `Home`, `End`, `PageUp`, `PageDown`
- Arrows: `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`

## Testing

Quick test of the PiKVM connection:

```bash
npx tsx test-client.ts
```

## License

GPL-3.0 - See [LICENSE](LICENSE) for details.
