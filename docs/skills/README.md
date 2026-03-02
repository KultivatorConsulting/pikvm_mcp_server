# PiKVM MCP Skills

This directory contains human-readable guides for the MCP prompts (skills) exposed by the PiKVM MCP server. Each file corresponds to a registered MCP prompt that agents can invoke via `prompts/get`.

## Tool Guides

Individual tool usage guides:

| Prompt Name | File | Description |
|---|---|---|
| `take-screenshot` | [take-screenshot.md](take-screenshot.md) | Capture screenshots with pikvm_screenshot |
| `check-resolution` | [check-resolution.md](check-resolution.md) | Check screen resolution with pikvm_get_resolution |
| `type-text` | [type-text.md](type-text.md) | Type text with pikvm_type |
| `send-key` | [send-key.md](send-key.md) | Send keys with pikvm_key |
| `send-shortcut` | [send-shortcut.md](send-shortcut.md) | Send keyboard shortcuts with pikvm_shortcut |
| `move-mouse` | [move-mouse.md](move-mouse.md) | Move the mouse with pikvm_mouse_move |
| `click-element` | [click-element.md](click-element.md) | Click with pikvm_mouse_click |
| `scroll-page` | [scroll-page.md](scroll-page.md) | Scroll with pikvm_mouse_scroll |

## Workflow Guides

Multi-step workflow recipes:

| Prompt Name | File | Arguments | Description |
|---|---|---|---|
| `setup-session-workflow` | [setup-session-workflow.md](setup-session-workflow.md) | None | Initialize a PiKVM session |
| `calibrate-mouse-workflow` | [calibrate-mouse-workflow.md](calibrate-mouse-workflow.md) | None | Calibrate mouse coordinates |
| `click-ui-element-workflow` | [click-ui-element-workflow.md](click-ui-element-workflow.md) | `element_description` (required) | Find and click a UI element |
| `fill-form-workflow` | [fill-form-workflow.md](fill-form-workflow.md) | `form_description` (optional) | Fill in a form on screen |
| `navigate-desktop-workflow` | [navigate-desktop-workflow.md](navigate-desktop-workflow.md) | `goal` (required) | Navigate a desktop environment |
