# InstaPlayer Pro (ex-tension)

A high-performance Chromium Manifest V3 browser extension engineered for advanced HTML5 video playback controls, specifically optimized for Instagram's React SPA environment.

## Features

### Phase 1: MVP Core Controls
- **Smart Video Discovery**: \MutationObserver\ + \IntersectionObserver\ pipeline tracking active video nodes across endless-scroll feeds and Reels.
- **Direct DOM Media Control**: Instant play/pause, seek (+/- 5s), volume, mute, and playback speed adjustments.
- **Fightback Pattern**: Intercepts React DOM resets on \atechange\ and \loadedmetadata\ to persist user settings across SPA navigation.
- **Isolated Shadow DOM HUD**: Floating, draggable control bar rendered in a closed Shadow DOM to eliminate CSS bleeding.
- **Input Guarding**: Prevents hotkey execution when typing inside comment boxes, search inputs, or contenteditable areas.

### Phase 2: Depth & Media APIs
- **Web Audio GainNode Boost**: Volume amplification beyond 100% (up to 400%) using lazily initialized \AudioContext\ and \GainNode\ routing.
- **Frame-by-Frame Stepping**: Precision scrubbing via \Shift + ArrowLeft\ and \Shift + ArrowRight\.
- **Persistent Storage**: \chrome.storage.local\ synchronization maintaining preferred playback rates and volume levels.
- **Media Session API**: Full integration with OS lock screen and hardware media keys.
- **Document Picture-in-Picture**: Dedicated floating mini-player window with active video and controls.

## Keyboard Shortcuts

| Action | Shortcut |
| :--- | :--- |
| **Play / Pause** | \Space\ |
| **Seek Forward / Backward** | \ArrowRight\ / \ArrowLeft\ |
| **Frame Step (+/- 1 frame)** | \Shift + ArrowRight\ / \Shift + ArrowLeft\ |
| **Volume Up / Down** | \ArrowUp\ / \ArrowDown\ |
| **Toggle Mute** | \M\ |
| **Speed Up / Down** | \]\ / \[\ |
| **Reset Speed (1.0x)** | \R\ |
| **Toggle Picture-in-Picture** | \P\ |

## Installation (Unpacked)

1. Clone this repository or download the source code.
2. Open Chromium (Chrome, Edge, Brave) and navigate to \chrome://extensions\.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the \ex-tension\ project folder.
5. Open [Instagram](https://www.instagram.com) and start watching Reels/videos.

## Architecture

\\\	ext
├── manifest.json       # Manifest V3 configuration & permission scoping
├── video-finder.js     # Observers for active video detection in React SPA
├── controller.js       # Media controller, Web Audio graph & fightback listeners
├── hotkeys.js          # In-page keyboard event handler with input guarding
├── overlay-ui.js       # Shadow DOM draggable HUD overlay
├── storage.js          # chrome.storage.local persistence manager
├── media-session.js    # navigator.mediaSession hardware key integrations
├── mini-player.js      # Document Picture-in-Picture window manager
└── icons/              # Extension icon assets (16x16, 48x48, 128x128)
\\\

## License
MIT
