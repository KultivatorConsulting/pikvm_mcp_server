# AGENTS.md - PiKVM MCP Server

## Project Overview

This project implements an MCP (Model Context Protocol) server that provides direct API access to PiKVM devices. This allows Claude Code and other MCP clients to control remote machines via PiKVM without going through browser automation.

## Why This Exists

Browser automation through PiKVM's web interface has keyboard input issues - special characters get mangled because the automation layer sends characters rather than proper key events. This MCP server communicates directly with PiKVM's REST API, which handles character-to-keycode conversion properly.

## Project Structure

```
pikvm_mcp_server/
├── AGENTS.md           # This file - instructions for AI agents
├── CONTEXT.md          # Background research and design notes
├── API_REFERENCE.md    # PiKVM API documentation
├── src/                # Source code
│   ├── index.ts        # Main MCP server entry point (tool + prompt handlers)
│   ├── config.ts       # Configuration handling
│   ├── pikvm/          # PiKVM API client
│   │   └── client.ts
│   └── prompts/        # MCP prompt definitions
│       ├── types.ts    # PromptDefinition interface
│       ├── tool-guides.ts  # 8 individual tool guide prompts
│       ├── workflows.ts    # 5 multi-step workflow prompts
│       └── index.ts    # Barrel export + lookup function
├── docs/skills/        # Human-readable skill guides (mirrors prompts)
├── package.json
└── tsconfig.json
```

## Development Commands

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development
npm run dev

# Type checking
npm run typecheck
```

## Configuration

The server is configured via environment variables or a config file:

- `PIKVM_HOST` - PiKVM URL (e.g., `https://<your-pikvm-ip>`)
- `PIKVM_USERNAME` - Auth username (default: `admin`)
- `PIKVM_PASSWORD` - Auth password
- `PIKVM_VERIFY_SSL` - Whether to verify SSL certs (default: `false` for self-signed)
- `PIKVM_DEFAULT_KEYMAP` - Default keyboard layout (default: `en-us`)

## MCP Tools Provided

### Display
1. **`pikvm_screenshot`** - Capture current screen as JPEG
2. **`pikvm_get_resolution`** - Get current screen resolution (useful for mouse coordinates)

### Keyboard
3. **`pikvm_type`** - Type text (handles special chars correctly via keymap)
4. **`pikvm_key`** - Send key/combo (e.g., Ctrl+Alt+Del)
5. **`pikvm_shortcut`** - Send keyboard shortcut (multiple keys pressed simultaneously)

### Mouse
6. **`pikvm_mouse_move`** - Move mouse cursor (absolute or relative)
7. **`pikvm_mouse_click`** - Click mouse button
8. **`pikvm_mouse_scroll`** - Scroll wheel

### Calibration
9. **`pikvm_calibrate`** - Start mouse coordinate calibration (moves cursor to screen center)
10. **`pikvm_set_calibration`** - Set calibration correction factors after visual verification
11. **`pikvm_get_calibration`** - Get current calibration state
12. **`pikvm_clear_calibration`** - Clear calibration, revert to uncalibrated mode

## MCP Prompts (Skills)

The server exposes 13 MCP prompts via `prompts/list` and `prompts/get`. These provide structured guidance for tool usage and multi-step workflows.

### Tool Guides
| Prompt | Covers |
|---|---|
| `take-screenshot` | pikvm_screenshot |
| `check-resolution` | pikvm_get_resolution |
| `type-text` | pikvm_type |
| `send-key` | pikvm_key |
| `send-shortcut` | pikvm_shortcut |
| `move-mouse` | pikvm_mouse_move |
| `click-element` | pikvm_mouse_click |
| `scroll-page` | pikvm_mouse_scroll |

### Workflow Recipes
| Prompt | Arguments | Description |
|---|---|---|
| `setup-session-workflow` | — | Initialize session: resolution, screenshot, calibrate |
| `calibrate-mouse-workflow` | — | Full mouse calibration procedure |
| `click-ui-element-workflow` | element_description (required) | Find and click a UI element |
| `fill-form-workflow` | form_description (optional) | Fill in form fields |
| `navigate-desktop-workflow` | goal (required) | Navigate desktop with Observe-Plan-Act-Verify loop |

Implementation: `src/prompts/` (types.ts, tool-guides.ts, workflows.ts, index.ts). Human-readable guides: `docs/skills/`.

## Key Implementation Notes

- PiKVM often uses self-signed SSL certificates - disable verification or add CA
- The `/api/hid/print` endpoint is the best way to type text - it handles keymap conversion
- Mouse coordinates are absolute (0-based, screen resolution dependent)
- Some operations may need delays between them for the target system to process
- **Calibration**: Mouse coordinates often need calibration at different resolutions. The calibration workflow is: call `pikvm_calibrate` to move cursor to center, take a screenshot to verify actual position, then call `pikvm_set_calibration` with correction factors. Calibration is automatically invalidated when resolution changes.

## Testing

Test against a real PiKVM device:
- URL: `https://<your-pikvm-ip>`
- Access via: PiKVM web interface at `/kvm/`

## References

- See `CONTEXT.md` for background research
- See `API_REFERENCE.md` for PiKVM API details
- PiKVM GitHub: https://github.com/pikvm/kvmd
- MCP SDK: https://github.com/modelcontextprotocol
