const DEFAULT_PREFS = {
    defaultSpeed: 1.0,
    defaultVolume: 100,
    maxVolume: 400,
    pitchCorrection: true,
    keybinds: {
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
        'togglePiP': 'p'
    }
};

const ACTION_LABELS = {
    'togglePlay': 'Play / Pause',
    'seekForward': 'Seek Forward',
    'seekBackward': 'Seek Backward',
    'stepFrameForward': 'Next Frame',
    'stepFrameBackward': 'Prev Frame',
    'volumeUp': 'Volume Up',
    'volumeDown': 'Volume Down',
    'toggleMute': 'Mute',
    'speedUp': 'Speed Up',
    'speedDown': 'Speed Down',
    'resetSpeed': 'Reset Speed',
    'togglePiP': 'Mini Player (PiP)'
};

const CONTENT_SCRIPTS = [
    "storage.js",
    "adapters/site-adapters.js",
    "video-finder.js",
    "controller.js",
    "hotkeys.js",
    "overlay-ui.js",
    "media-session.js",
    "mini-player.js"
];

let prefs = JSON.parse(JSON.stringify(DEFAULT_PREFS));
let activeTabId = null;

// UI Elements
const els = {
    mainView: document.getElementById('main-view'),
    settingsView: document.getElementById('settings-view'),
    navSettings: document.getElementById('nav-settings'),
    navMain: document.getElementById('nav-main'),
    
    statusDot: document.getElementById('status-dot'),
    statusHeading: document.getElementById('status-heading'),
    statusDesc: document.getElementById('status-desc'),
    actionPanel: document.getElementById('action-panel'),
    controlsPanel: document.getElementById('controls-panel'),
    enableBtn: document.getElementById('enable-btn'),
    
    speedSlider: document.getElementById('speed-slider'),
    speedVal: document.getElementById('speed-val'),
    resetSpeedBtn: document.getElementById('reset-speed-btn'),
    volSlider: document.getElementById('vol-slider'),
    volVal: document.getElementById('vol-val'),
    
    prefDefaultSpeed: document.getElementById('pref-default-speed'),
    prefDefaultVol: document.getElementById('pref-default-vol'),
    prefMaxVol: document.getElementById('pref-max-vol'),
    prefPitch: document.getElementById('pref-pitch'),
    keybindGrid: document.getElementById('keybind-grid'),
    rebindError: document.getElementById('rebind-error'),
    resetSettingsBtn: document.getElementById('reset-settings-btn')
};

// Safe tab messaging with Promise resolution
function sendTabMessage(msg) {
    return new Promise((resolve) => {
        if (!activeTabId) {
            resolve(null);
            return;
        }
        try {
            chrome.tabs.sendMessage(activeTabId, msg, (response) => {
                if (chrome.runtime.lastError) {
                    resolve(null);
                    return;
                }
                resolve(response);
            });
        } catch (e) {
            resolve(null);
        }
    });
}

// Live state updates from content script hotkeys
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "STATE_UPDATE") {
        if (msg.status === 'active' || msg.count > 0) {
            els.statusDot.className = 'status-indicator active';
            els.statusHeading.textContent = "Player Active";
            els.statusDesc.textContent = `Tracking ${msg.count || 1} media element(s).`;
        } else {
            els.statusDot.className = 'status-indicator active';
            els.statusHeading.textContent = "Player Ready";
            els.statusDesc.textContent = "Waiting for video/audio playback...";
        }
        
        if (msg.currentSpeed !== undefined && document.activeElement !== els.speedSlider) {
            els.speedSlider.value = msg.currentSpeed;
            els.speedVal.textContent = Number(msg.currentSpeed).toFixed(2) + 'x';
        }
        if (msg.currentVolume !== undefined && document.activeElement !== els.volSlider) {
            els.volSlider.value = msg.currentVolume;
            els.volVal.textContent = msg.currentVolume + '%';
        }
    }
});

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Navigation
els.navSettings.addEventListener('click', () => {
    els.mainView.classList.remove('active');
    els.settingsView.classList.add('active');
    els.settingsView.classList.remove('hidden');
    els.mainView.classList.add('hidden');
});
els.navMain.addEventListener('click', () => {
    els.settingsView.classList.remove('active');
    els.mainView.classList.add('active');
    els.mainView.classList.remove('hidden');
    els.settingsView.classList.add('hidden');
});

function setUnsupported(title, desc) {
    els.statusDot.className = 'status-indicator error';
    els.statusHeading.textContent = title;
    els.statusDesc.textContent = desc;
}

function formatHotkeyDisplay(str) {
    if (str === ' ') return 'Space';
    return str.split('+').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' + ');
}

// Settings rendering
function renderSettings() {
    els.prefDefaultSpeed.value = prefs.defaultSpeed;
    els.prefDefaultVol.value = prefs.defaultVolume;
    els.prefMaxVol.value = prefs.maxVolume;
    els.prefPitch.checked = prefs.pitchCorrection;
    
    els.volSlider.max = prefs.maxVolume;
    
    els.keybindGrid.innerHTML = '';
    for (const [action, keyStr] of Object.entries(prefs.keybinds)) {
        if (!ACTION_LABELS[action]) continue;
        
        const row = document.createElement('div');
        row.className = 'keybind-item';
        
        const label = document.createElement('span');
        label.className = 'keybind-label';
        label.textContent = ACTION_LABELS[action];
        
        const btn = document.createElement('button');
        btn.className = 'keybind-btn';
        btn.textContent = formatHotkeyDisplay(keyStr);
        
        btn.addEventListener('click', () => startRebind(action, btn));
        
        row.appendChild(label);
        row.appendChild(btn);
        els.keybindGrid.appendChild(row);
    }
}

// Rebinding logic
let bindingAction = null;
let bindingBtn = null;

function startRebind(action, btn) {
    if (bindingBtn) {
        bindingBtn.classList.remove('listening');
        bindingBtn.textContent = formatHotkeyDisplay(prefs.keybinds[bindingAction]);
    }
    bindingAction = action;
    bindingBtn = btn;
    btn.textContent = 'Listening...';
    btn.classList.add('listening');
    els.rebindError.classList.add('hidden');
}

document.addEventListener('keydown', (e) => {
    if (!bindingAction) return;
    e.preventDefault();
    e.stopPropagation();
    
    if (e.key === 'Escape') {
        bindingBtn.classList.remove('listening');
        bindingBtn.textContent = formatHotkeyDisplay(prefs.keybinds[bindingAction]);
        bindingAction = null;
        bindingBtn = null;
        return;
    }
    
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
    
    let parts = [];
    if (e.ctrlKey) parts.push('ctrl');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey) parts.push('shift');
    if (e.metaKey) parts.push('meta');
    parts.push(e.key.toLowerCase());
    
    const hotkeyStr = parts.join('+');
    
    // Conflict detection
    let conflict = null;
    for (const [act, key] of Object.entries(prefs.keybinds)) {
        if (key === hotkeyStr && act !== bindingAction) {
            conflict = ACTION_LABELS[act];
            break;
        }
    }
    
    if (conflict) {
        els.rebindError.textContent = `"${formatHotkeyDisplay(hotkeyStr)}" is already assigned to ${conflict}.`;
        els.rebindError.classList.remove('hidden');
        bindingBtn.classList.remove('listening');
        bindingBtn.textContent = formatHotkeyDisplay(prefs.keybinds[bindingAction]);
    } else {
        prefs.keybinds[bindingAction] = hotkeyStr;
        bindingBtn.classList.remove('listening');
        bindingBtn.textContent = formatHotkeyDisplay(hotkeyStr);
        savePrefs();
    }
    
    bindingAction = null;
    bindingBtn = null;
}, { capture: true });

function savePrefs() {
    chrome.storage.local.set({ prefs });
    sendTabMessage({ type: "RELOAD_PREFS", prefs });
}

// Pref event listeners
els.prefDefaultSpeed.addEventListener('change', (e) => { 
    prefs.defaultSpeed = Math.max(0.25, Math.min(5.0, parseFloat(e.target.value) || 1.0)); 
    savePrefs(); 
});
els.prefDefaultVol.addEventListener('change', (e) => { 
    prefs.defaultVolume = Math.max(0, parseInt(e.target.value, 10) || 100); 
    savePrefs(); 
});
els.prefMaxVol.addEventListener('change', (e) => { 
    prefs.maxVolume = Math.max(100, parseInt(e.target.value, 10) || 400); 
    els.volSlider.max = prefs.maxVolume;
    savePrefs(); 
});
els.prefPitch.addEventListener('change', (e) => { 
    prefs.pitchCorrection = Boolean(e.target.checked); 
    savePrefs(); 
    sendTabMessage({ type: "SET_PITCH", value: prefs.pitchCorrection });
});
els.resetSettingsBtn.addEventListener('click', () => {
    prefs = JSON.parse(JSON.stringify(DEFAULT_PREFS));
    savePrefs();
    renderSettings();
});

// Debounced message senders for sliders
const sendSpeedUpdate = debounce((val) => {
    sendTabMessage({ type: "SET_SPEED", value: val });
}, 40);

const sendVolUpdate = debounce((val) => {
    sendTabMessage({ type: "SET_VOLUME", value: val });
}, 40);

// Playback Speed Slider
els.speedSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    els.speedVal.textContent = val.toFixed(2) + 'x';
    sendSpeedUpdate(val);
});
els.speedSlider.addEventListener('change', (e) => {
    const val = parseFloat(e.target.value);
    sendTabMessage({ type: "SET_SPEED", value: val });
});

// Audio Boost Slider
els.volSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    els.volVal.textContent = val + '%';
    sendVolUpdate(val);
});
els.volSlider.addEventListener('change', (e) => {
    const val = parseInt(e.target.value, 10);
    sendTabMessage({ type: "SET_VOLUME", value: val });
});

// Reset Speed Button
els.resetSpeedBtn.addEventListener('click', () => {
    els.speedSlider.value = 1.0;
    els.speedVal.textContent = '1.00x';
    sendTabMessage({ type: "SET_SPEED", value: 1.0 });
});

// Resilient content script injection
async function injectContentScripts(tabId) {
    let success = false;
    // Primary injection into main frame
    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            files: CONTENT_SCRIPTS
        });
        success = true;
    } catch (e) {
        console.warn('[Popup] Main frame injection error:', e);
    }

    // Best-effort subframe injection (ignore errors from sandboxed iframes)
    try {
        await chrome.scripting.executeScript({
            target: { tabId, allFrames: true },
            files: CONTENT_SCRIPTS
        });
    } catch (e) {}

    return success;
}

// Main initialization flow
async function init() {
    try {
        const res = await chrome.storage.local.get(['prefs']);
        if (res.prefs) {
            prefs = { 
                ...DEFAULT_PREFS, 
                ...res.prefs, 
                keybinds: { ...DEFAULT_PREFS.keybinds, ...(res.prefs.keybinds || {}) } 
            };
        }
    } catch (e) {}
    renderSettings();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
        setUnsupported("System Page", "Extensions cannot run on this page.");
        return;
    }
    activeTabId = tab.id;

    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('brave://') || tab.url.startsWith('about:'))) {
        setUnsupported("System Page", "Extensions cannot run on this browser page.");
        return;
    }

    // 1. Check if content script is already active
    let pingResponse = await sendTabMessage({ type: "PING_PLAYER_STATUS" });

    // 2. Fallback: Inject scripts if tab was opened before extension was loaded/reloaded
    if (!pingResponse) {
        const injected = await injectContentScripts(tab.id);
        if (injected) {
            await new Promise(r => setTimeout(r, 60));
            pingResponse = await sendTabMessage({ type: "PING_PLAYER_STATUS" });
        }
    }

    // 3. Render appropriate UI state
    if (pingResponse && (pingResponse.status === 'active' || pingResponse.count > 0)) {
        els.statusDot.className = 'status-indicator active';
        els.statusHeading.textContent = "Player Active";
        els.statusDesc.textContent = `Tracking ${pingResponse.count || 1} media element(s).`;
        
        els.controlsPanel.classList.remove('hidden');
        
        if (pingResponse.currentSpeed !== undefined) {
            els.speedSlider.value = pingResponse.currentSpeed;
            els.speedVal.textContent = Number(pingResponse.currentSpeed).toFixed(2) + 'x';
        }
        if (pingResponse.currentVolume !== undefined) {
            els.volSlider.value = pingResponse.currentVolume;
            els.volVal.textContent = pingResponse.currentVolume + '%';
        }
        if (pingResponse.maxVolume !== undefined) {
            els.volSlider.max = pingResponse.maxVolume;
        }
    } else if (pingResponse && pingResponse.status === 'unsupported') {
        setUnsupported("Unsupported Player", "A closed shadow DOM or canvas player was detected.");
    } else if (pingResponse) {
        els.statusDot.className = 'status-indicator active';
        els.statusHeading.textContent = "Player Ready";
        els.statusDesc.textContent = "Waiting for video/audio playback...";
        els.controlsPanel.classList.remove('hidden');
    } else {
        // Injection failed completely (e.g. Chrome Web Store or other browser-protected pages)
        setUnsupported("Restricted Page", "Extensions cannot run on this page.");
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
