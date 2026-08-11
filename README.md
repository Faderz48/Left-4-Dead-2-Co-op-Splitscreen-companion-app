# L4D2 Native Split Screen

<img width="1908" height="1027" alt="left4" src="https://github.com/user-attachments/assets/1e9eed5c-f337-4299-81b1-d98a93262f70" />

![L4D2 Native Split Screen launcher](https://github.com/user-attachments/assets/b908d75c-3448-4144-8497-87a6e95b50d7)

A modern launcher for the hidden native two-player split-screen mode in the
Steam version of Left 4 Dead 2. Windows and native Linux use the same interface
and generate the same isolated game configuration.

Download the current Windows and Linux builds from the
[latest GitHub release](https://github.com/Faderz48/Left-4-Dead-2-Co-op-Splitscreen-companion-app/releases/latest).

## Features

- Two Xbox-compatible controllers with explicit Player 1 / Player 2 routing
- Big-picture campaign browser designed for controller, keyboard, or mouse
- Saved fullscreen Big Picture / normal window toggle, with F11 shortcut
- Permanent fullscreen-safe Exit button, plus Ctrl+Q and controller View-to-focus
- D-pad/left-stick navigation with A/B, LB/RB page switching, and Start-to-launch
- Large game-mode buttons and controller-friendly chapter stepping
- All 57 official campaign chapters in a grouped dropdown
- Official campaign key art sourced from archival originals
- Clean, front-facing campaign key art with proportion-safe display
- Custom add-on map scanning and manual map IDs
- Horizontal or vertical split-screen
- Campaign, realism, survival, versus, and scavenge modes
- Separate vertical and horizontal camera inversion for each player
- Separate look sensitivity, vibration, and stick layout for each player
- Complete controller button remapping
- Automatic Steam-library discovery in a dedicated Settings page
- Reversible configuration; existing `360controller.cfg` is not replaced

Left 4 Dead campaign artwork is copyright Valve Corporation and is not covered
by the launcher's MIT license.

## Windows

Run `L4D2-Native-Split-Screen-0.4.4-Windows-x64.exe`. It is a portable app and
does not need installation or administrator access. The current community
build is not code-signed, so Windows may show an Unknown Publisher warning.

## Linux

Make the AppImage executable and run it:

```text
chmod +x L4D2-Native-Split-Screen-0.4.4-x86_64.AppImage
./L4D2-Native-Split-Screen-0.4.4-x86_64.AppImage
```

If FUSE is unavailable, use the built-in extraction fallback:

```text
APPIMAGE_EXTRACT_AND_RUN=1 ./L4D2-Native-Split-Screen-0.4.4-x86_64.AppImage
```

If Linux reports that the Chromium sandbox is unavailable, use the opt-in
fallback below. The launcher normally keeps the sandbox enabled:

```text
L4D2_LAUNCHER_NO_SANDBOX=1 ./L4D2-Native-Split-Screen-0.4.4-x86_64.AppImage
```

Linux startup diagnostics are saved in the app's configuration directory as
`launcher.log` if the interface cannot load.

The launcher targets the native Linux version of L4D2, not the Windows build
through Proton.

## Controller routing

Connect both controllers before starting the game. With two Xbox controllers,
start with Steam Input disabled for L4D2. On Linux, try Steam Input enabled with
the standard Gamepad layout if direct input does not expose Player 2.

If Player 2 joins but cannot aim vertically, open the game console and enter
`cmd2 +jlook`. If Player 2 does not join, enter `mss_reconnect`.

## Files written into L4D2

- `left4dead2/cfg/modern_ss_controllers.cfg`
- `left4dead2/cfg/modern_ss_session.cfg`

Delete those two files to remove the generated game configuration.
