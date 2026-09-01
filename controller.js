// Wraps all active video elements and provides DOM media methods + fightback + Web Audio
let desiredPlaybackRate = 1.0;
let desiredVolume = 1.0;
let desiredMuted = false;
let desiredPitch = true;
let MAX_VOLUME = 4.0;

// Web Audio tracking for volume boost (> 100%)
const audioGraphs = new WeakMap();

function getAudioGraph(video) {
    if (audioGraphs.has(video)) return audioGraphs.get(video);
    
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const source = ctx.createMediaElementSource(video);
        const gainNode = ctx.createGain();
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        const graph = { ctx, gainNode, source };
        audioGraphs.set(video, graph);
        return graph;
    } catch (err) {
        console.warn('[InstaPlayer] Web Audio boost unavailable for this element:', err);
        return null;
    }
}

function getAllVideos() {
    const vids = new Set(document.querySelectorAll('video, audio'));
    if (window.InstaVideoFinder && window.InstaVideoFinder.getAllVideos) {
        window.InstaVideoFinder.getAllVideos().forEach(v => vids.add(v));
    }
    return Array.from(vids).filter(v => v && v.isConnected);
}

function getActiveVideo() {
    const vids = getAllVideos();
    if (vids.length === 0) return null;
    // Prioritize currently playing video
    const playing = vids.find(v => !v.paused && v.readyState >= 2);
    if (playing) return playing;
    // Otherwise return first visible or finder's choice
    if (window.InstaVideoFinder && window.InstaVideoFinder.getActiveVideo) {
        const found = window.InstaVideoFinder.getActiveVideo();
        if (found && found.isConnected) return found;
    }
    return vids[0];
}

function applyDesiredSettings() {
    const videos = getAllVideos();
    if (videos.length === 0) return;

    videos.forEach(video => {
        // 1. Playback Speed
        if (video.playbackRate !== desiredPlaybackRate) {
            video.playbackRate = desiredPlaybackRate;
        }
        
        // 2. Pitch Correction
        if (video.preservesPitch !== desiredPitch) {
            video.preservesPitch = desiredPitch;
            if (video.mozPreservesPitch !== undefined) video.mozPreservesPitch = desiredPitch;
            if (video.webkitPreservesPitch !== undefined) video.webkitPreservesPitch = desiredPitch;
        }
        
        // 3. Mute state
        if (video.muted !== desiredMuted) {
            video.muted = desiredMuted;
        }

        // 4. Volume & Audio Boost
        if (desiredVolume <= 1.0) {
            if (video.volume !== desiredVolume) {
                video.volume = desiredVolume;
            }
            if (audioGraphs.has(video)) {
                const graph = audioGraphs.get(video);
                if (graph && graph.gainNode) graph.gainNode.gain.value = 1.0;
            }
        } else {
            // Standard volume maxed out for Web Audio
            video.volume = 1.0;
            const graph = getAudioGraph(video);
            if (graph && graph.gainNode) {
                graph.gainNode.gain.value = desiredVolume;
                if (graph.ctx.state === 'suspended') {
                    graph.ctx.resume().catch(() => {});
                }
            }
        }
    });
}

function onRateChange(e) {
    const video = e.target;
    if (video && video.playbackRate !== desiredPlaybackRate) {
        video.playbackRate = desiredPlaybackRate;
    }
}

function onVolumeChange(e) {
    const video = e.target;
    if (!video) return;
    if (desiredVolume <= 1.0) {
        if (video.volume !== desiredVolume) video.volume = desiredVolume;
    } else {
        if (video.volume !== 1.0) video.volume = 1.0;
    }
    if (video.muted !== desiredMuted) video.muted = desiredMuted;
}

function onLoadedMetadata(e) {
    applyDesiredSettings();
}

function attachListeners(video) {
    if (!video || video._hasInstaListeners) return;
    video._hasInstaListeners = true;
    video.addEventListener('ratechange', onRateChange);
    video.addEventListener('volumechange', onVolumeChange);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
}

// Attach listeners to all present and future videos
function scanAndBind() {
    getAllVideos().forEach(v => {
        attachListeners(v);
    });
    applyDesiredSettings();
}

// Load global settings from storage.js persistence
function reloadSettingsFromPrefs(prefs) {
    if (!prefs) return;
    if (prefs.maxVolume !== undefined) {
        MAX_VOLUME = (prefs.maxVolume || 400) / 100;
    }
    if (prefs.pitchCorrection !== undefined) {
        desiredPitch = prefs.pitchCorrection !== false;
    }
    if (prefs.defaultSpeed !== undefined && !sessionStorage.getItem('instaplayer_manual_speed')) {
        desiredPlaybackRate = prefs.defaultSpeed;
    }
    if (prefs.defaultVolume !== undefined && !sessionStorage.getItem('instaplayer_manual_vol')) {
        desiredVolume = Math.min((prefs.defaultVolume || 100) / 100, MAX_VOLUME);
    }
    desiredVolume = Math.min(desiredVolume, MAX_VOLUME);
    applyDesiredSettings();
}

// Initial setup
scanAndBind();
setInterval(scanAndBind, 1000); // Periodic check for dynamically spawned SPA video nodes

if (window.InstaStorage) {
    window.InstaStorage.init().then(settings => {
        if (settings.playbackRate !== undefined) desiredPlaybackRate = settings.playbackRate;
        if (settings.volume !== undefined) desiredVolume = settings.volume;
        if (settings.muted !== undefined) desiredMuted = settings.muted;
        
        if (chrome && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['prefs'], (res) => {
                if (res.prefs) reloadSettingsFromPrefs(res.prefs);
                applyDesiredSettings();
                document.dispatchEvent(new CustomEvent('insta-player:state-updated'));
            });
        }
    });
}

document.addEventListener('insta-player:active-video-changed', (e) => {
    const newVideo = e.detail.video;
    if (newVideo) {
        attachListeners(newVideo);
        applyDesiredSettings();
        document.dispatchEvent(new CustomEvent('insta-player:state-updated'));
    }
});

// Controller API
window.InstaController = {
    getCurrentVideo: () => getActiveVideo(),
    play: () => getActiveVideo()?.play(),
    pause: () => getActiveVideo()?.pause(),
    togglePlay: () => {
        const v = getActiveVideo();
        if (!v) return;
        v.paused ? v.play() : v.pause();
    },
    seekBy: (seconds) => {
        const v = getActiveVideo();
        if (v) v.currentTime += seconds;
    },
    stepFrame: (forward = true) => {
        const v = getActiveVideo();
        if (!v) return;
        v.pause();
        const fps = 30;
        v.currentTime += (forward ? 1 : -1) * (1 / fps);
    },
    setPlaybackRate: (rate) => {
        sessionStorage.setItem('instaplayer_manual_speed', '1');
        desiredPlaybackRate = Math.max(0.25, Math.min(5.0, rate));
        applyDesiredSettings();
        document.dispatchEvent(new CustomEvent('insta-player:state-updated'));
    },
    resetPlaybackRate: () => {
        desiredPlaybackRate = 1.0;
        applyDesiredSettings();
        document.dispatchEvent(new CustomEvent('insta-player:state-updated'));
    },
    getPlaybackRate: () => desiredPlaybackRate,
    setVolume: (vol) => {
        sessionStorage.setItem('instaplayer_manual_vol', '1');
        desiredVolume = Math.max(0, Math.min(MAX_VOLUME, vol));
        if (desiredVolume > 0) desiredMuted = false;
        
        applyDesiredSettings();
        document.dispatchEvent(new CustomEvent('insta-player:state-updated'));
    },
    getVolume: () => desiredVolume,
    toggleMute: () => {
        desiredMuted = !desiredMuted;
        applyDesiredSettings();
        document.dispatchEvent(new CustomEvent('insta-player:state-updated'));
    },
    isMuted: () => desiredMuted,
    setPitch: (pitch) => {
        desiredPitch = Boolean(pitch);
        applyDesiredSettings();
        document.dispatchEvent(new CustomEvent('insta-player:state-updated'));
    },
    getMaxVolume: () => MAX_VOLUME
};

// Message listener for popup UI controls & ping requests
if (chrome && chrome.runtime) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === "SET_SPEED") {
            window.InstaController.setPlaybackRate(request.value);
            sendResponse({ success: true, currentSpeed: desiredPlaybackRate });
            return true;
        } else if (request.type === "SET_VOLUME") {
            window.InstaController.setVolume(request.value / 100);
            sendResponse({ success: true, currentVolume: Math.round(desiredVolume * 100) });
            return true;
        } else if (request.type === "SET_PITCH") {
            desiredPitch = Boolean(request.value);
            applyDesiredSettings();
            sendResponse({ success: true, pitchCorrection: desiredPitch });
            return true;
        } else if (request.type === "RELOAD_PREFS") {
            reloadSettingsFromPrefs(request.prefs);
            sendResponse({ success: true });
            return true;
        } else if (request.type === "PING_PLAYER_STATUS") {
            const vids = getAllVideos();
            const hasCanvasPlayer = document.querySelector('canvas') && vids.length === 0;
            if (hasCanvasPlayer) {
                sendResponse({ status: 'unsupported' });
                return true;
            }

            sendResponse({
                status: vids.length > 0 ? 'active' : 'inactive',
                count: vids.length,
                currentSpeed: desiredPlaybackRate,
                currentVolume: Math.round(desiredVolume * 100),
                muted: desiredMuted,
                pitchCorrection: desiredPitch,
                maxVolume: Math.round(MAX_VOLUME * 100)
            });
            return true;
        }
    });
}



function broadcastStateToPopup() {
    if (chrome && chrome.runtime) {
        const vids = getAllVideos();
        chrome.runtime.sendMessage({
            type: 'STATE_UPDATE',
            status: vids.length > 0 ? 'active' : 'inactive',
            count: vids.length,
            currentSpeed: desiredPlaybackRate,
            currentVolume: Math.round(desiredVolume * 100),
            muted: desiredMuted,
            pitchCorrection: desiredPitch,
            maxVolume: Math.round(MAX_VOLUME * 100)
        }).catch(() => {});
    }
}
document.addEventListener('insta-player:state-updated', broadcastStateToPopup);

