# scroll-page

> MCP Prompt: `scroll-page`

Guide for scrolling with `pikvm_mouse_scroll`.

## Purpose

Scroll the mouse wheel vertically or horizontally.

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| deltaY | number | *(required)* | Vertical scroll: negative = scroll up, positive = scroll down |
| deltaX | number | 0 | Horizontal scroll: negative = scroll left, positive = scroll right |

## Example Calls

```json
{ "name": "pikvm_mouse_scroll", "arguments": { "deltaY": -3 } }

{ "name": "pikvm_mouse_scroll", "arguments": { "deltaY": 5, "deltaX": 2 } }
```

## Tips

- A deltaY of **-3 to -5** is a reasonable "scroll up one section" amount; **3 to 5** for scrolling down.
- Move the cursor over the target area first if the scroll should apply to a specific pane or element.
- For long pages, use multiple scroll calls with screenshots in between to verify you've reached the desired content.
- Horizontal scrolling is less commonly supported — verify it works on the target application.
