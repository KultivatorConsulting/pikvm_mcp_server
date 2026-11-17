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
│   │   ├── client.ts
│   │   ├── auto-calibrate.ts  # Vision-based auto-calibration (screenshot diffing)
│   │   ├── display-area.ts    # Black-bar (letterbox/pillarbox) detection
│   │   └── lock.ts         # Busy lock that blocks other tools during auto-calibration
│   └── prompts/        # MCP prompt definitions
│       ├── types.ts    # PromptDefinition interface
│       ├── tool-guides.ts  # 9 individual tool guide prompts
│       ├── workflows.ts    # 6 multi-step workflow prompts
│       ├── skill-tools.ts  # Auto-generated skill_* tools from prompts
│       └── index.ts    # Barrel export + lookup function
├── docs/skills/        # Human-readable skill guides (mirrors prompts)
├── package.json
└── tsconfig.json
```

## Development Commands

```bash
# Install dependencies (exact versions from package-lock.json)
npm ci

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
- `PIKVM_CALIBRATION_ROUNDS` - Auto-calibration sampling rounds (default: `5`)
- `PIKVM_CALIBRATION_VERIFY_ROUNDS` - Auto-calibration verification rounds (default: `5`)
- `PIKVM_CALIBRATION_MOVE_DELAY` - Delay in ms after each mouse move during auto-calibration (default: `300`)

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
13. **`pikvm_auto_calibrate`** - Automatically detect the cursor via screenshot diffing and set calibration factors (preferred over manual calibration)

## MCP Prompts & Skill Tools

The server exposes 15 skills as both MCP prompts (`prompts/list` / `prompts/get`) and read-only `skill_*` tools (`tools/list` / `tools/call`). The skill tools are auto-generated from prompt definitions for marketplace visibility (e.g. LobeHub indexes tools, not prompts).

**Total tools: 28** (13 `pikvm_*` hardware tools + 15 `skill_*` guidance tools)

### Tool Guides
| Prompt | Skill Tool | Covers |
|---|---|---|
| `take-screenshot` | `skill_take_screenshot` | pikvm_screenshot |
| `check-resolution` | `skill_check_resolution` | pikvm_get_resolution |
| `type-text` | `skill_type_text` | pikvm_type |
| `send-key` | `skill_send_key` | pikvm_key |
| `send-shortcut` | `skill_send_shortcut` | pikvm_shortcut |
| `move-mouse` | `skill_move_mouse` | pikvm_mouse_move |
| `click-element` | `skill_click_element` | pikvm_mouse_click |
| `scroll-page` | `skill_scroll_page` | pikvm_mouse_scroll |
| `auto-calibrate` | `skill_auto_calibrate` | pikvm_auto_calibrate |

### Workflow Recipes
| Prompt | Skill Tool | Arguments | Description |
|---|---|---|---|
| `setup-session-workflow` | `skill_setup_session_workflow` | — | Initialize session: resolution, screenshot, calibrate |
| `calibrate-mouse-workflow` | `skill_calibrate_mouse_workflow` | — | Full mouse calibration procedure |
| `click-ui-element-workflow` | `skill_click_ui_element_workflow` | element_description (required) | Find and click a UI element |
| `fill-form-workflow` | `skill_fill_form_workflow` | form_description (optional) | Fill in form fields |
| `navigate-desktop-workflow` | `skill_navigate_desktop_workflow` | goal (required) | Navigate desktop with Observe-Plan-Act-Verify loop |
| `auto-calibrate-mouse-workflow` | `skill_auto_calibrate_mouse_workflow` | — | Automatic mouse calibration with pikvm_auto_calibrate |

Implementation: `src/prompts/` (types.ts, tool-guides.ts, workflows.ts, skill-tools.ts, index.ts). Human-readable guides: `docs/skills/`.

## Key Implementation Notes

- PiKVM often uses self-signed SSL certificates - disable verification or add CA
- The `/api/hid/print` endpoint is the best way to type text - it handles keymap conversion
- Mouse coordinates are absolute (0-based, screen resolution dependent)
- Some operations may need delays between them for the target system to process
- **Black bars**: When the target's output doesn't match the capture resolution (e.g. a 16:10 desktop captured at 1280x720), PiKVM shows it with black bars, but the absolute mouse range spans the target's desktop, not the capture. `src/pikvm/display-area.ts` detects the active area on every full-resolution capture (bars must be symmetric; the narrower side wins so dark content at one edge isn't mistaken for a bar; the remaining area must have a standard aspect ratio, otherwise the previous result is kept). `pixelToNormalized` maps from that area, so screenshot coordinates work as-is. Without this, clicks drift by up to the bar width (~45px seen at 1280x720 with 64px bars) and the scale-only calibration can't correct it. The area resets when resolution changes; if a mouse move happens before any screenshot, the client captures a frame internally (never returned) to detect it.
- **Snapshot retries**: The streamer returns 503 when snapshots are requested back to back (e.g. during auto-calibration). `requestSnapshot` in `client.ts` retries 503s with backoff (250/500/1000/2000ms); all `/streamer/snapshot` calls go through it.
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
