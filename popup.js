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

// Safe tab message sender
function sendTabMessage(msg, callback) {
    if (!activeTabId) return;
    try {
        chrome.tabs.sendMessage(activeTabId, msg, (response) => {
            if (chrome.runtime.lastError) {
                // Connection error, tab might not have content script yet
                return;
            }
            if (callback && response) callback(response);
        });
    } catch (e) {
        console.warn('[Popup] Message send failed:', e);
    }
}

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

// Format hotkeys for display
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
    
    // Update max constraint on vol slider
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

// Rebinding logic (input-systems)
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
}, 50);

const sendVolUpdate = debounce((val) => {
    sendTabMessage({ type: "SET_VOLUME", value: val });
}, 50);

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

// Main initialization flow
async function init() {
    // 1. Load preferences
    try {
        const res = await chrome.storage.local.get(['prefs']);
        if (res.prefs) {
            prefs = { 
                ...DEFAULT_PREFS, 
                ...res.prefs, 
                keybinds: { ...DEFAULT_PREFS.keybinds, ...(res.prefs.keybinds || {}) } 
            };
        }
    } catch (e) {
        console.warn('[Popup] Error reading storage:', e);
    }
    renderSettings();

    // 2. Query active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || tab.url.startsWith('chrome://')) {
        setUnsupported("System Page", "Extensions cannot run on this page.");
        return;
    }
    activeTabId = tab.id;

    const url = new URL(tab.url);
    const origin = url.origin + "/*";
    const hasPermission = await chrome.permissions.contains({ origins: [origin] });

    if (!hasPermission) {
        // Probe using activeTab
        let hasMedia = false;
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => document.querySelectorAll('video, audio').length > 0
            });
            hasMedia = results && results[0] && results[0].result;
        } catch (e) {
            setUnsupported("Probe Failed", "Cannot access this page.");
            return;
        }

        if (hasMedia) {
            els.statusDot.className = 'status-indicator';
            els.statusHeading.textContent = "Media Detected";
            els.statusDesc.textContent = "InstaPlayer requires permission to activate.";
            els.actionPanel.classList.remove('hidden');
            
            els.enableBtn.addEventListener('click', async () => {
                const granted = await chrome.permissions.request({ origins: [origin] });
                if (granted) {
                    chrome.tabs.reload(tab.id);
                    window.close();
                }
            });
        } else {
            setUnsupported("No Media Found", "No HTML5 video or audio elements detected on this page.");
        }
        return;
    }

    // 3. Ping content script for live status
    sendTabMessage({ type: "PING_PLAYER_STATUS" }, (response) => {
        if (response && (response.status === 'active' || response.count > 0)) {
            els.statusDot.className = 'status-indicator active';
            els.statusHeading.textContent = "Player Active";
            els.statusDesc.textContent = `Tracking ${response.count || 1} video(s).`;
            
            els.controlsPanel.classList.remove('hidden');
            
            if (response.currentSpeed !== undefined) {
                els.speedSlider.value = response.currentSpeed;
                els.speedVal.textContent = response.currentSpeed.toFixed(2) + 'x';
            }
            if (response.currentVolume !== undefined) {
                els.volSlider.value = response.currentVolume;
                els.volVal.textContent = response.currentVolume + '%';
            }
            if (response.maxVolume !== undefined) {
                els.volSlider.max = response.maxVolume;
            }
        } else if (response && response.status === 'unsupported') {
            setUnsupported("Unsupported Player", "A closed shadow DOM or canvas player was detected.");
        } else {
            // Still show controls panel if permission is active so user can adjust defaults
            els.statusDot.className = 'status-indicator active';
            els.statusHeading.textContent = "Player Ready";
            els.statusDesc.textContent = "Waiting for video playback...";
            els.controlsPanel.classList.remove('hidden');
        }
    });
}

document.addEventListener('DOMContentLoaded', init);
