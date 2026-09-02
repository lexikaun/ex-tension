// In-page keyboard shortcuts with input-focus guarding and dynamic configuration
const DEFAULT_KEYBINDS = {
    'togglePlay': ' ',
    'seekForward': 'arrowright',
    'seekBackward': 'arrowleft',
    'stepFrameForward': 'shift+arrowright',
    'stepFrameBackward': 'shift+arrowleft',
    'volumeUp': 'arrowup',
    'volumeDown': 'arrowdown',
    'toggleMute': 'm',
    'speedUp': ']',
    'speedDown': '[',
    'resetSpeed': 'r',
    'togglePiP': 'p',
    'toggleHUD': 'v'
};

let activeKeybinds = { ...DEFAULT_KEYBINDS };
let activeCustomPresets = [];

// Load initially from storage
if (chrome && chrome.storage) {
    chrome.storage.local.get(['prefs'], (res) => {
        if (res.prefs) {
            if (res.prefs.keybinds) activeKeybinds = { ...DEFAULT_KEYBINDS, ...res.prefs.keybinds };
            if (res.prefs.customPresets) activeCustomPresets = res.prefs.customPresets;
        }
    });

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.prefs && changes.prefs.newValue) {
            if (changes.prefs.newValue.keybinds) {
                activeKeybinds = { ...DEFAULT_KEYBINDS, ...changes.prefs.newValue.keybinds };
            }
            if (changes.prefs.newValue.customPresets) {
                activeCustomPresets = changes.prefs.newValue.customPresets;
            }
        }
    });
}

function isInputFocused() {
    const active = document.activeElement;
    if (!active) return false;
    
    const tagName = active.tagName.toLowerCase();
    const isTextInput = tagName === 'input' && 
        ['text', 'search', 'email', 'number', 'password', 'tel', 'url'].includes(active.type);
    const isTextArea = tagName === 'textarea';
    const isContentEditable = active.isContentEditable || active.getAttribute('role') === 'textbox';
    
    return isTextInput || isTextArea || isContentEditable;
}

function getHotkeyString(e) {
    let parts = [];
    if (e.ctrlKey) parts.push('ctrl');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey) parts.push('shift');
    if (e.metaKey) parts.push('meta');
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return null;
    parts.push(e.key.toLowerCase());
    return parts.join('+');
}

document.addEventListener('keydown', (e) => {
    // Guard against typing in comment boxes
    if (isInputFocused()) return;
    
    const hotkeyStr = getHotkeyString(e);
    if (!hotkeyStr) return;
    if (!window.InstaController) return;

    // 1. Check custom presets first
    const matchedPreset = activeCustomPresets.find(p => p.key === hotkeyStr);
    if (matchedPreset) {
        e.preventDefault();
        if (matchedPreset.type === 'speed') {
            window.InstaController.setPlaybackRate(parseFloat(matchedPreset.value));
        } else if (matchedPreset.type === 'volume') {
            window.InstaController.setVolume(parseFloat(matchedPreset.value) / 100);
        }
        return;
    }

    // 2. Reverse lookup: Find which standard action matches this hotkey string
    let action = null;
    for (const [act, key] of Object.entries(activeKeybinds)) {
        if (key === hotkeyStr) {
            action = act;
            break;
        }
    }
    
    if (!action) return;

    switch (action) {
        case 'togglePlay':
            e.preventDefault();
            window.InstaController.togglePlay();
            break;
        case 'seekForward':
            e.preventDefault();
            window.InstaController.seekBy(5);
            break;
        case 'seekBackward':
            e.preventDefault();
            window.InstaController.seekBy(-5);
            break;
        case 'stepFrameForward':
            e.preventDefault();
            window.InstaController.stepFrame(true);
            break;
        case 'stepFrameBackward':
            e.preventDefault();
            window.InstaController.stepFrame(false);
            break;
        case 'volumeUp':
            e.preventDefault();
            window.InstaController.setVolume(window.InstaController.getVolume() + 0.1);
            break;
        case 'volumeDown':
            e.preventDefault();
            window.InstaController.setVolume(window.InstaController.getVolume() - 0.1);
            break;
        case 'toggleMute':
            e.preventDefault();
            window.InstaController.toggleMute();
            break;
        case 'speedUp':
            e.preventDefault();
            window.InstaController.setPlaybackRate(window.InstaController.getPlaybackRate() + 0.25);
            break;
        case 'speedDown':
            e.preventDefault();
            window.InstaController.setPlaybackRate(window.InstaController.getPlaybackRate() - 0.25);
            break;
        case 'resetSpeed':
            e.preventDefault();
            window.InstaController.resetPlaybackRate();
            break;
        case 'togglePiP':
            e.preventDefault();
            if (window.InstaPiP) window.InstaPiP.toggle();
            break;
        case 'toggleHUD':
            e.preventDefault();
            if (window.InstaOverlay) window.InstaOverlay.toggle();
            break;
    }
}, { capture: true }); // Intercept before host site handlers
