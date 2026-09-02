// Injects a control HUD into a closed Shadow DOM
const uiHost = document.createElement('div');
uiHost.id = 'insta-player-ui-host';
uiHost.style.position = 'fixed';
uiHost.style.top = '20px';
uiHost.style.right = '20px';
uiHost.style.zIndex = '999999';
uiHost.style.display = 'none';

const shadow = uiHost.attachShadow({ mode: 'closed' });

const style = document.createElement('style');
style.textContent = `
    .hud-container {
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 8px 12px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 14px;
        display: flex;
        gap: 12px;
        align-items: center;
        backdrop-filter: blur(4px);
        user-select: none;
        cursor: move;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    }
    .stat { font-weight: bold; }
    .stat-label { font-size: 11px; opacity: 0.8; margin-right: 4px; }
`;
shadow.appendChild(style);

const container = document.createElement('div');
container.className = 'hud-container';

const speedDisplay = document.createElement('div');
speedDisplay.innerHTML = `<span class="stat-label">SPD</span><span class="stat" id="speed-val">1.0x</span>`;

const volDisplay = document.createElement('div');
volDisplay.innerHTML = `<span class="stat-label">VOL</span><span class="stat" id="vol-val">100%</span>`;

container.appendChild(speedDisplay);
container.appendChild(volDisplay);
shadow.appendChild(container);

// Make it draggable
let isDragging = false;
let startX, startY, initialTop, initialLeft;

container.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = uiHost.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    uiHost.style.right = 'auto'; // Disable right anchoring
    uiHost.style.left = `${initialLeft + dx}px`;
    uiHost.style.top = `${initialTop + dy}px`;
});

document.addEventListener('mouseup', () => {
    isDragging = false;
});

// Mount to DOM
if (document.body) {
    document.body.appendChild(uiHost);
} else {
    document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(uiHost);
    });
}

let isHudVisible = false;

// Sync UI with controller state
function updateUI() {
    if (!window.InstaController) return;
    const speed = window.InstaController.getPlaybackRate().toFixed(2);
    const vol = Math.round(window.InstaController.getVolume() * 100);
    const muted = window.InstaController.isMuted();
    
    const speedEl = shadow.querySelector('#speed-val');
    const volEl = shadow.querySelector('#vol-val');
    if (speedEl) speedEl.textContent = `${speed}x`;
    if (volEl) volEl.textContent = muted ? 'MUTED' : `${vol}%`;
}

document.addEventListener('insta-player:state-updated', () => {
    if (isHudVisible) updateUI();
});

// Show/hide based on active video and visibility state
document.addEventListener('insta-player:active-video-changed', (e) => {
    if (e.detail.video) {
        if (isHudVisible) {
            uiHost.style.display = 'block';
            updateUI(); // Initial paint
        }
    } else {
        uiHost.style.display = 'none';
    }
});

// Toggle HUD API
function toggleHUD() {
    isHudVisible = !isHudVisible;
    if (isHudVisible) {
        uiHost.style.display = 'block';
        updateUI();
    } else {
        uiHost.style.display = 'none';
    }
}

window.InstaOverlay = {
    toggle: toggleHUD,
    show: () => {
        isHudVisible = true;
        uiHost.style.display = 'block';
        updateUI();
    },
    hide: () => {
        isHudVisible = false;
        uiHost.style.display = 'none';
    },
    isVisible: () => isHudVisible
};

// Handle fullscreen reparenting
document.addEventListener('fullscreenchange', () => {
    const fsElement = document.fullscreenElement;
    if (fsElement) {
        fsElement.appendChild(uiHost);
    } else {
        document.body.appendChild(uiHost);
    }
});
