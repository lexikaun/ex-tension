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
        'togglePiP': 'p',
        'toggleHUD': 'v'
    },
    customPresets: []
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
    'togglePiP': 'Mini Player (PiP)',
    'toggleHUD': 'Toggle On-Screen HUD'
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
    resetSettingsBtn: document.getElementById('reset-settings-btn'),

    addPresetBtn: document.getElementById('add-preset-btn'),
    presetCreator: document.getElementById('preset-creator'),
    newPresetType: document.getElementById('new-preset-type'),
    newPresetVal: document.getElementById('new-preset-val'),
    newPresetValLabel: document.getElementById('new-preset-val-label'),
    newPresetKeyBtn: document.getElementById('new-preset-key-btn'),
    savePresetBtn: document.getElementById('save-preset-btn'),
    cancelPresetBtn: document.getElementById('cancel-preset-btn'),
    presetList: document.getElementById('preset-list')
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
    if (!str) return 'None';
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
    
    // 1. Render Custom Presets
    els.presetList.innerHTML = '';
    if (!prefs.customPresets || prefs.customPresets.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'micro-copy';
        empty.style.textAlign = 'left';
        empty.style.padding = '4px 0';
        empty.textContent = 'No custom presets added. Click "+ Add New" to create one.';
        els.presetList.appendChild(empty);
    } else {
        prefs.customPresets.forEach((preset) => {
            const row = document.createElement('div');
            row.className = 'keybind-item';
            
            const left = document.createElement('div');
            left.className = 'preset-item-left';
            
            const badge = document.createElement('span');
            badge.className = `preset-badge ${preset.type}`;
            badge.textContent = preset.type === 'speed' ? 'Speed' : 'Boost';
            
            const label = document.createElement('span');
            label.className = 'keybind-label';
            label.textContent = preset.type === 'speed' ? `${Number(preset.value).toFixed(2)}x` : `${preset.value}%`;
            
            left.appendChild(badge);
            left.appendChild(label);
            
            const right = document.createElement('div');
            right.className = 'preset-item-right';
            
            const keyBtn = document.createElement('button');
            keyBtn.className = 'keybind-btn';
            keyBtn.textContent = formatHotkeyDisplay(preset.key);
            keyBtn.addEventListener('click', () => startRebind({ type: 'preset', id: preset.id }, keyBtn));
            
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.title = 'Delete Preset';
            delBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
            delBtn.addEventListener('click', () => {
                prefs.customPresets = prefs.customPresets.filter(p => p.id !== preset.id);
                savePrefs();
                renderSettings();
            });
            
            right.appendChild(keyBtn);
            right.appendChild(delBtn);
            
            row.appendChild(left);
            row.appendChild(right);
            els.presetList.appendChild(row);
        });
    }

    // 2. Render Standard Keybindings
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
        
        btn.addEventListener('click', () => startRebind({ type: 'action', action }, btn));
        
        row.appendChild(label);
        row.appendChild(btn);
        els.keybindGrid.appendChild(row);
    }
}

// Rebinding state
let bindingTarget = null;
let bindingBtn = null;
let newPresetKey = null;

function startRebind(target, btn) {
    if (bindingBtn) {
        cancelRebind();
    }
    bindingTarget = target;
    bindingBtn = btn;
    btn.textContent = 'Listening...';
    btn.classList.add('listening');
    els.rebindError.classList.add('hidden');
}

function cancelRebind() {
    if (!bindingBtn || !bindingTarget) return;
    bindingBtn.classList.remove('listening');
    if (bindingTarget.type === 'action') {
        bindingBtn.textContent = formatHotkeyDisplay(prefs.keybinds[bindingTarget.action]);
    } else if (bindingTarget.type === 'preset') {
        const p = prefs.customPresets.find(item => item.id === bindingTarget.id);
        bindingBtn.textContent = formatHotkeyDisplay(p ? p.key : '');
    } else if (bindingTarget.type === 'newPreset') {
        bindingBtn.textContent = formatHotkeyDisplay(newPresetKey || 'Click to Bind');
    }
    bindingTarget = null;
    bindingBtn = null;
}

function getConflict(hotkeyStr, currentTarget) {
    // Check standard actions
    for (const [act, key] of Object.entries(prefs.keybinds)) {
        if (key === hotkeyStr) {
            if (currentTarget && currentTarget.type === 'action' && currentTarget.action === act) continue;
            return ACTION_LABELS[act] || act;
        }
    }
    // Check custom presets
    for (const p of (prefs.customPresets || [])) {
        if (p.key === hotkeyStr) {
            if (currentTarget && currentTarget.type === 'preset' && currentTarget.id === p.id) continue;
            return p.type === 'speed' ? `Speed ${Number(p.value).toFixed(2)}x preset` : `Audio Boost ${p.value}% preset`;
        }
    }
    return null;
}

document.addEventListener('keydown', (e) => {
    if (!bindingTarget) return;
    e.preventDefault();
    e.stopPropagation();
    
    if (e.key === 'Escape') {
        cancelRebind();
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
    const conflict = getConflict(hotkeyStr, bindingTarget);
    
    if (conflict) {
        els.rebindError.textContent = `"${formatHotkeyDisplay(hotkeyStr)}" is already assigned to ${conflict}.`;
        els.rebindError.classList.remove('hidden');
        cancelRebind();
    } else {
        els.rebindError.classList.add('hidden');
        if (bindingTarget.type === 'action') {
            prefs.keybinds[bindingTarget.action] = hotkeyStr;
            bindingBtn.textContent = formatHotkeyDisplay(hotkeyStr);
            savePrefs();
        } else if (bindingTarget.type === 'preset') {
            const p = (prefs.customPresets || []).find(item => item.id === bindingTarget.id);
            if (p) p.key = hotkeyStr;
            bindingBtn.textContent = formatHotkeyDisplay(hotkeyStr);
            savePrefs();
        } else if (bindingTarget.type === 'newPreset') {
            newPresetKey = hotkeyStr;
            bindingBtn.textContent = formatHotkeyDisplay(hotkeyStr);
        }
        bindingBtn.classList.remove('listening');
        bindingTarget = null;
        bindingBtn = null;
    }
}, { capture: true });

function resetPresetCreator() {
    newPresetKey = null;
    els.newPresetKeyBtn.textContent = 'Click to Bind';
    els.newPresetKeyBtn.classList.remove('listening');
    els.newPresetType.value = 'speed';
    els.newPresetValLabel.textContent = 'Target Speed (x)';
    els.newPresetVal.min = '0.25';
    els.newPresetVal.max = '5.0';
    els.newPresetVal.step = '0.25';
    els.newPresetVal.value = '2.0';
    els.rebindError.classList.add('hidden');
}

// Preset Creator Events
els.addPresetBtn.addEventListener('click', () => {
    els.presetCreator.classList.toggle('hidden');
    if (!els.presetCreator.classList.contains('hidden')) {
        resetPresetCreator();
    }
});

els.cancelPresetBtn.addEventListener('click', () => {
    els.presetCreator.classList.add('hidden');
    resetPresetCreator();
});

els.newPresetType.addEventListener('change', (e) => {
    const type = e.target.value;
    if (type === 'speed') {
        els.newPresetValLabel.textContent = 'Target Speed (x)';
        els.newPresetVal.min = '0.25';
        els.newPresetVal.max = '5.0';
        els.newPresetVal.step = '0.25';
        els.newPresetVal.value = '2.0';
    } else {
        els.newPresetValLabel.textContent = 'Target Boost (%)';
        els.newPresetVal.min = '10';
        els.newPresetVal.max = '800';
        els.newPresetVal.step = '10';
        els.newPresetVal.value = '200';
    }
});

els.newPresetKeyBtn.addEventListener('click', () => {
    startRebind({ type: 'newPreset' }, els.newPresetKeyBtn);
});

els.savePresetBtn.addEventListener('click', () => {
    if (!newPresetKey) {
        els.rebindError.textContent = 'Please click to assign a keybinding first.';
        els.rebindError.classList.remove('hidden');
        return;
    }
    const type = els.newPresetType.value;
    let val = parseFloat(els.newPresetVal.value);
    if (isNaN(val)) val = type === 'speed' ? 2.0 : 200;
    if (type === 'speed') val = Math.max(0.25, Math.min(5.0, val));
    if (type === 'volume') val = Math.max(10, Math.min(800, parseInt(val, 10)));
    
    const newPreset = {
        id: 'preset-' + Date.now(),
        type: type,
        value: val,
        key: newPresetKey
    };
    
    if (!prefs.customPresets) prefs.customPresets = [];
    prefs.customPresets.push(newPreset);
    savePrefs();
    renderSettings();
    els.presetCreator.classList.add('hidden');
    resetPresetCreator();
});

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
                keybinds: { ...DEFAULT_PREFS.keybinds, ...(res.prefs.keybinds || {}) },
                customPresets: res.prefs.customPresets || []
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
    if (pingResponse) {
        if (pingResponse.status === 'unsupported') {
            setUnsupported("Unsupported Player", "A closed shadow DOM or canvas player was detected.");
            return;
        }

        if (pingResponse.status === 'active' || pingResponse.count > 0) {
            els.statusDot.className = 'status-indicator active';
            els.statusHeading.textContent = "Player Active";
            els.statusDesc.textContent = `Tracking ${pingResponse.count || 1} media element(s).`;
        } else {
            els.statusDot.className = 'status-indicator active';
            els.statusHeading.textContent = "Player Ready";
            els.statusDesc.textContent = "Waiting for video/audio playback...";
        }

        els.controlsPanel.classList.remove('hidden');

        if (pingResponse.currentSpeed !== undefined && pingResponse.currentSpeed !== null) {
            els.speedSlider.value = pingResponse.currentSpeed;
            els.speedVal.textContent = Number(pingResponse.currentSpeed).toFixed(2) + 'x';
        }
        if (pingResponse.currentVolume !== undefined && pingResponse.currentVolume !== null) {
            els.volSlider.value = pingResponse.currentVolume;
            els.volVal.textContent = pingResponse.currentVolume + '%';
        }
        if (pingResponse.maxVolume !== undefined && pingResponse.maxVolume !== null) {
            els.volSlider.max = pingResponse.maxVolume;
        }
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
