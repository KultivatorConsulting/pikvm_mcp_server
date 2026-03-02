# navigate-desktop-workflow

> MCP Prompt: `navigate-desktop-workflow`

Step-by-step procedure for navigating a desktop environment.

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `goal` | Yes | What you want to accomplish (e.g., "open Firefox", "find and open a file") |

## Workflow Steps

Use an **Observe-Plan-Act-Verify** loop until the goal is achieved.

### Observe

Take a screenshot with `pikvm_screenshot`. Identify:

- What OS / desktop environment is running (Windows, macOS, Linux/GNOME, Linux/KDE, etc.)
- What applications/windows are currently open
- Where relevant UI elements are (taskbar, dock, menus, desktop icons)

### Plan

Decide the next action to get closer to the goal. Common desktop patterns:

**Opening applications:**

- Taskbar/dock: click the application icon
- Start menu / application launcher: click the menu button, then search or browse
- Terminal: open a terminal and run the application command
- Desktop shortcut: double-click the icon

**Common shortcuts:**

- Open file manager: often on taskbar or via Super key
- Open terminal: Ctrl+Alt+T (many Linux DEs), or right-click desktop
- Search: Super key (Windows/GNOME), Cmd+Space (macOS)
- Switch windows: Alt+Tab
- Show desktop: Super+D (Windows/some Linux)
- Close window: Alt+F4

### Act

Execute the planned action using the appropriate PiKVM tool:

- `pikvm_mouse_click` for clicking UI elements
- `pikvm_key` or `pikvm_shortcut` for keyboard shortcuts
- `pikvm_type` for typing in search bars or terminals
- `pikvm_mouse_scroll` for scrolling through menus or file lists

### Verify

Take another screenshot to confirm the action had the expected effect. If not, reassess and try an alternative approach.

## Repeat

Continue the Observe-Plan-Act-Verify loop until the goal is achieved. If you get stuck, try a different approach (e.g., use keyboard shortcuts instead of mouse, or use a terminal command instead of the GUI).
