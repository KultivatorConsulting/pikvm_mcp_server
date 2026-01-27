# CLAUDE.md - PiKVM MCP Server

## Project Overview

This project implements an MCP (Model Context Protocol) server that provides direct API access to PiKVM devices. This allows Claude Code and other MCP clients to control remote machines via PiKVM without going through browser automation.

## Why This Exists

Browser automation through PiKVM's web interface has keyboard input issues - special characters get mangled because the automation layer sends characters rather than proper key events. This MCP server communicates directly with PiKVM's REST API, which handles character-to-keycode conversion properly.

## Project Structure

```
pikvm_mcp_server/
├── CLAUDE.md           # This file - instructions for Claude
├── CONTEXT.md          # Background research and design notes
├── API_REFERENCE.md    # PiKVM API documentation
├── src/                # Source code
│   ├── index.ts        # Main MCP server entry point (includes all tool handlers)
│   ├── config.ts       # Configuration handling
│   └── pikvm/          # PiKVM API client
│       └── client.ts
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

- `PIKVM_HOST` - PiKVM URL (e.g., `https://192.168.1.71`)
- `PIKVM_USERNAME` - Auth username (default: `admin`)
- `PIKVM_PASSWORD` - Auth password
- `PIKVM_VERIFY_SSL` - Whether to verify SSL certs (default: `false` for self-signed)
- `PIKVM_DEFAULT_KEYMAP` - Default keyboard layout (default: `en-us`)

## MCP Tools Provided

1. **`pikvm_screenshot`** - Capture current screen as JPEG
2. **`pikvm_get_resolution`** - Get current screen resolution (useful for mouse coordinates)
3. **`pikvm_type`** - Type text (handles special chars correctly via keymap)
4. **`pikvm_key`** - Send key/combo (e.g., Ctrl+Alt+Del)
5. **`pikvm_shortcut`** - Send keyboard shortcut (multiple keys pressed simultaneously)
6. **`pikvm_mouse_move`** - Move mouse cursor (absolute or relative)
7. **`pikvm_mouse_click`** - Click mouse button
8. **`pikvm_mouse_scroll`** - Scroll wheel

## Key Implementation Notes

- PiKVM often uses self-signed SSL certificates - disable verification or add CA
- The `/api/hid/print` endpoint is the best way to type text - it handles keymap conversion
- Mouse coordinates are absolute (0-based, screen resolution dependent)
- Some operations may need delays between them for the target system to process

## Testing

Test against a real PiKVM device. The test PiKVM is at:
- URL: `https://192.168.1.71`
- Access via: PiKVM web interface at `/kvm/`

## References

- See `CONTEXT.md` for background research
- See `API_REFERENCE.md` for PiKVM API details
- PiKVM GitHub: https://github.com/pikvm/kvmd
- MCP SDK: https://github.com/modelcontextprotocol
