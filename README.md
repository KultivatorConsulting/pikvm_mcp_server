# PiKVM MCP Server


[![MCP Badge](https://lobehub.com/badge/mcp/kultivatorconsulting-pikvm_mcp_server?style=plastic)](https://lobehub.com/mcp/kultivatorconsulting-pikvm_mcp_server)




Give AI agents hands. This MCP server connects Claude Code (or any MCP client) directly to a [PiKVM](https://pikvm.org/) device, giving AI full keyboard, mouse, and screen access to a physical machine -- no browser automation, no virtual desktops, no emulators.

Point it at real hardware. Let the AI see the screen, type commands, click buttons, and navigate GUIs on a machine it could never otherwise touch.

<p align="center">
  <img src="assets/simple_setup.jpg" alt="Raspberry Pi 5 connected to a PiKVM V4 Plus" width="600">
  <br>
  <em>A Raspberry Pi 5 controlled via PiKVM V4 Plus -- the AI's physical interface to the real world.</em>
</p>

### See it in action

The video below shows Claude Code using this MCP server to autonomously interact with a Raspberry Pi desktop: taking a screenshot to identify the OS, opening a text editor from the menu, typing text, and closing the application -- all through the PiKVM hardware interface.

[Watch the demo video](assets/example_prompt.mp4)

## Features

- **Screenshot capture** - Get current screen as JPEG image
- **Text typing** - Type text with proper special character handling via keymaps
- **Keyboard control** - Send individual keys or key combinations (e.g., Ctrl+Alt+Delete)
- **Mouse control** - Move, click, and scroll with automatic coordinate calibration

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
PIKVM_HOST=https://<your-pikvm-ip>
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
        "PIKVM_HOST": "https://<your-pikvm-ip>",
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

### Display
- **`pikvm_screenshot`** - Capture current screen as JPEG (optional: maxWidth, maxHeight, quality)
- **`pikvm_get_resolution`** - Get screen resolution and valid coordinate ranges

### Keyboard
- **`pikvm_type`** - Type text with keymap-aware special character handling (required: text; optional: keymap, slow, delay)
- **`pikvm_key`** - Send a key or key combo, e.g. Ctrl+Alt+Del (required: key; optional: modifiers, state)
- **`pikvm_shortcut`** - Send multiple keys pressed simultaneously (required: keys array)

### Mouse
- **`pikvm_mouse_move`** - Move cursor to absolute pixel position or relative delta (required: x, y; optional: relative)
- **`pikvm_mouse_click`** - Click a mouse button, optionally at a position (optional: button, x, y, state)
- **`pikvm_mouse_scroll`** - Scroll the mouse wheel (required: deltaY; optional: deltaX)

### Calibration
- **`pikvm_calibrate`** - Start calibration by moving cursor to screen center for visual verification
- **`pikvm_set_calibration`** - Apply correction factors calculated from calibration (required: factorX, factorY)
- **`pikvm_get_calibration`** - Get current calibration state
- **`pikvm_clear_calibration`** - Reset to uncalibrated mode

## Skills (MCP Prompts)

The server exposes 13 MCP prompts that provide structured guidance for agents. Use `prompts/list` to discover them or `prompts/get` to retrieve a specific guide.

### Tool Guides
- **`take-screenshot`** — Capturing screenshots with pikvm_screenshot
- **`check-resolution`** — Checking screen resolution with pikvm_get_resolution
- **`type-text`** — Typing text with pikvm_type
- **`send-key`** — Sending keys with pikvm_key
- **`send-shortcut`** — Sending keyboard shortcuts with pikvm_shortcut
- **`move-mouse`** — Moving the mouse with pikvm_mouse_move
- **`click-element`** — Clicking with pikvm_mouse_click
- **`scroll-page`** — Scrolling with pikvm_mouse_scroll

### Workflow Recipes
- **`setup-session-workflow`** — Initialize a PiKVM session (resolution, screenshot, calibration)
- **`calibrate-mouse-workflow`** — Calibrate mouse coordinates for accurate clicking
- **`click-ui-element-workflow`** — Find and click a specific UI element *(arg: element_description)*
- **`fill-form-workflow`** — Fill in a form on screen *(arg: form_description)*
- **`navigate-desktop-workflow`** — Navigate a desktop environment *(arg: goal)*

See [`docs/skills/`](docs/skills/) for detailed human-readable guides.

## Key Codes Reference

Common key codes for `pikvm_key` and `pikvm_shortcut`:

- Letters: `KeyA`, `KeyB`, ... `KeyZ`
- Numbers: `Digit0`, `Digit1`, ... `Digit9`
- Function keys: `F1`, `F2`, ... `F12`
- Modifiers: `ShiftLeft`, `ShiftRight`, `ControlLeft`, `ControlRight`, `AltLeft`, `AltRight`, `MetaLeft`, `MetaRight`
- Special: `Enter`, `Escape`, `Backspace`, `Tab`, `Space`, `Delete`, `Insert`, `Home`, `End`, `PageUp`, `PageDown`
- Arrows: `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`

## License

GPL-3.0 - See [LICENSE](LICENSE) for details.
