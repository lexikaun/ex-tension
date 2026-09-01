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
    
    controlsPanel: document.getElementById('controls-panel'),
    
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

// Broadcaster for real-time slider/button actions (pierces iframes)
async function executeOnAllFrames(func, args = []) {
    if (!activeTabId) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.id) activeTabId = tab.id;
        } catch (e) {}
    }
    if (!activeTabId) return null;

    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: activeTabId, allFrames: true },
            func: func,
            args: args
        });
        return results;
    } catch (e) {
        return null;
    }
}

// Live state updates from content script hotkeys
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "STATE_UPDATE") {
        if (msg.currentSpeed !== undefined && document.activeElement !== els.speedSlider) {
            els.speedSlider.value = msg.currentSpeed;
            els.speedVal.textContent = msg.currentSpeed.toFixed(2) + 'x';
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
    // Notify all frames to reload prefs
    if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, { type: "RELOAD_PREFS", prefs }).catch(() => {});
    }
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
    executeOnAllFrames((pitch) => {
        if (window.InstaController && window.InstaController.setPitch) window.InstaController.setPitch(pitch);
    }, [prefs.pitchCorrection]);
});
els.resetSettingsBtn.addEventListener('click', () => {
    prefs = JSON.parse(JSON.stringify(DEFAULT_PREFS));
    savePrefs();
    renderSettings();
});

// Playback Speed Slider
const sendSpeedUpdate = debounce((val) => {
    executeOnAllFrames((rate) => {
        if (window.InstaController) window.InstaController.setPlaybackRate(rate);
    }, [val]);
}, 40);

els.speedSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    els.speedVal.textContent = val.toFixed(2) + 'x';
    sendSpeedUpdate(val);
});
els.speedSlider.addEventListener('change', (e) => {
    const val = parseFloat(e.target.value);
    executeOnAllFrames((rate) => {
        if (window.InstaController) window.InstaController.setPlaybackRate(rate);
    }, [val]);
});

// Audio Boost Slider
const sendVolUpdate = debounce((val) => {
    executeOnAllFrames((vol) => {
        if (window.InstaController) window.InstaController.setVolume(vol / 100);
    }, [val]);
}, 40);

els.volSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    els.volVal.textContent = val + '%';
    sendVolUpdate(val);
});
els.volSlider.addEventListener('change', (e) => {
    const val = parseInt(e.target.value, 10);
    executeOnAllFrames((vol) => {
        if (window.InstaController) window.InstaController.setVolume(vol / 100);
    }, [val]);
});

// Reset Speed Button
els.resetSpeedBtn.addEventListener('click', () => {
    els.speedSlider.value = 1.0;
    els.speedVal.textContent = '1.00x';
    executeOnAllFrames((rate) => {
        if (window.InstaController) window.InstaController.resetPlaybackRate();
    });
});

async function injectContentScripts(tabId) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId, allFrames: true },
            files: [
                "storage.js",
                "adapters/site-adapters.js",
                "video-finder.js",
                "controller.js",
                "hotkeys.js",
                "overlay-ui.js",
                "media-session.js",
                "mini-player.js"
            ]
        });
        return true;
    } catch (e) {
        return false;
    }
}

async function pingAllFrames() {
    const results = await executeOnAllFrames(() => {
        if (!window.InstaController) return null;
        
        let vids = Array.from(document.querySelectorAll('video, audio'));
        if (window.InstaVideoFinder && window.InstaVideoFinder.getAllVideos) {
            window.InstaVideoFinder.getAllVideos().forEach(v => {
                if (!vids.includes(v) && v.isConnected) vids.push(v);
            });
        }
        
        const hasCanvasPlayer = document.querySelector('canvas') && vids.length === 0;
        if (hasCanvasPlayer) return { status: 'unsupported' };

        return {
            status: vids.length > 0 ? 'active' : 'inactive',
            count: vids.length,
            currentSpeed: window.InstaController.getPlaybackRate(),
            currentVolume: Math.round(window.InstaController.getVolume() * 100),
            muted: window.InstaController.isMuted(),
            maxVolume: 400
        };
    });

    if (!results) return null;
    
    // Find the frame with actual videos
    const validResult = results.find(r => r.result && r.result.count > 0);
    if (validResult) return validResult.result;
    
    const anyResult = results.find(r => r.result);
    return anyResult ? anyResult.result : null;
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

    // Set UI to defaults immediately (stateless)
    els.speedSlider.value = prefs.defaultSpeed;
    els.speedVal.textContent = prefs.defaultSpeed.toFixed(2) + 'x';
    els.volSlider.value = prefs.defaultVolume;
    els.volVal.textContent = prefs.defaultVolume + '%';
    els.volSlider.max = prefs.maxVolume;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;
    activeTabId = tab.id;

    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('brave://') || tab.url.startsWith('about:'))) {
        return; // UI stays rendered, but sending commands will just fail silently
    }

    let pingResponse = await pingAllFrames();
    if (!pingResponse) {
        const injected = await injectContentScripts(tab.id);
        if (injected) {
            pingResponse = await pingAllFrames();
        }
    }

    if (pingResponse) {
        if (pingResponse.currentSpeed !== undefined) {
            els.speedSlider.value = pingResponse.currentSpeed;
            els.speedVal.textContent = pingResponse.currentSpeed.toFixed(2) + 'x';
        }
        if (pingResponse.currentVolume !== undefined) {
            els.volSlider.value = pingResponse.currentVolume;
            els.volVal.textContent = pingResponse.currentVolume + '%';
        }
        if (pingResponse.maxVolume !== undefined) {
            els.volSlider.max = pingResponse.maxVolume;
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

