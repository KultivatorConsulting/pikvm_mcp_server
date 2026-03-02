# check-resolution

> MCP Prompt: `check-resolution`

Guide for checking screen resolution with `pikvm_get_resolution`.

## Purpose

Return the current width and height of the remote screen in pixels. The result defines the valid coordinate space for all mouse operations.

## Parameters

None.

## Example Call

```json
{ "name": "pikvm_get_resolution" }
```

## When to Call

- At the **start of a session** so you know the coordinate space before any mouse interaction.
- After the remote machine might have **changed resolution** (e.g., opening a game, switching display settings).
- Before **calibration** — the calibrate workflow uses this value.

## Tips

- Valid mouse coordinates range from (0, 0) to (width-1, height-1).
- If the resolution changes after you have calibrated, calibration is **automatically invalidated** — you will need to recalibrate.
