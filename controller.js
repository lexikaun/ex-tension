// Wraps the active element and provides the DOM media methods + fightback + Web Audio
let currentVideo = null;
let desiredPlaybackRate = 1.0;
let desiredVolume = 1.0;
let desiredMuted = false;
let desiredPitch = true;
let MAX_VOLUME = 4.0;

// Web Audio tracking for volume boost
const audioGraphs = new WeakMap();

function getAudioGraph(video) {
    if (audioGraphs.has(video)) return audioGraphs.get(video);
    
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const source = ctx.createMediaElementSource(video);
        const gainNode = ctx.createGain();
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        const graph = { ctx, gainNode };
        audioGraphs.set(video, graph);
        return graph;
    } catch (err) {
        console.warn('[InstaPlayer] Web Audio boost unavailable for this media element:', err);
        return null;
    }
}

function getActiveOrFallbackVideo() {
    if (currentVideo && currentVideo.isConnected) return currentVideo;
    if (window.InstaVideoFinder && window.InstaVideoFinder.getActiveVideo()) {
        currentVideo = window.InstaVideoFinder.getActiveVideo();
    } else {
        currentVideo = document.querySelector('video');
    }
    return currentVideo;
}

function applyDesiredSettings() {
    const video = getActiveOrFallbackVideo();
    if (!video) return;
    
    if (video.playbackRate !== desiredPlaybackRate) {
        video.playbackRate = desiredPlaybackRate;
    }
    
    if (video.preservesPitch !== desiredPitch) {
        video.preservesPitch = desiredPitch;
        if (video.mozPreservesPitch !== undefined) video.mozPreservesPitch = desiredPitch;
        if (video.webkitPreservesPitch !== undefined) video.webkitPreservesPitch = desiredPitch;
    }
    
    if (video.muted !== desiredMuted) {
        video.muted = desiredMuted;
    }

    if (desiredVolume <= 1.0) {
        if (video.volume !== desiredVolume) video.volume = desiredVolume;
        if (audioGraphs.has(video)) {
            const graph = audioGraphs.get(video);
            if (graph && graph.gainNode) graph.gainNode.gain.value = 1.0;
        }
    } else {
        video.volume = 1.0;
        const graph = getAudioGraph(video);
        if (graph && graph.gainNode) {
            graph.gainNode.gain.value = desiredVolume;
            if (graph.ctx.state === 'suspended') {
                graph.ctx.resume().catch(() => {});
            }
        }
    }
}

function onRateChange() {
    const video = getActiveOrFallbackVideo();
    if (video && video.playbackRate !== desiredPlaybackRate) {
        video.playbackRate = desiredPlaybackRate;
    }
}

function onVolumeChange() {
    const video = getActiveOrFallbackVideo();
    if (!video) return;
    if (desiredVolume <= 1.0) {
        if (video.volume !== desiredVolume) video.volume = desiredVolume;
    } else {
        if (video.volume !== 1.0) video.volume = 1.0;
    }
    if (video.muted !== desiredMuted) video.muted = desiredMuted;
}

function onLoadedMetadata() {
    applyDesiredSettings();
}

function attachListeners(video) {
    if (!video) return;
    video.addEventListener('ratechange', onRateChange);
    video.addEventListener('volumechange', onVolumeChange);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
}

function detachListeners(video) {
    if (!video) return;
    video.removeEventListener('ratechange', onRateChange);
    video.removeEventListener('volumechange', onVolumeChange);
    video.removeEventListener('loadedmetadata', onLoadedMetadata);
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

// Initial video pickup
const initialVid = getActiveOrFallbackVideo();
if (initialVid) {
    attachListeners(initialVid);
    applyDesiredSettings();
}

if (window.InstaStorage) {
    window.InstaStorage.init().then(settings => {
        if (settings.playbackRate !== undefined) desiredPlaybackRate = settings.playbackRate;
        if (settings.volume !== undefined) desiredVolume = settings.volume;
        if (settings.muted !== undefined) desiredMuted = settings.muted;
        
        // Fetch full prefs for maxVolume, defaults and pitch
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
    if (currentVideo === newVideo) return;
    
    if (currentVideo) {
        detachListeners(currentVideo);
    }
    
    currentVideo = newVideo;
    
    if (currentVideo) {
        attachListeners(currentVideo);
        applyDesiredSettings();
    }
});

window.InstaController = {
    getCurrentVideo: () => getActiveOrFallbackVideo(),
    play: () => {
        const v = getActiveOrFallbackVideo();
        return v?.play();
    },
    pause: () => {
        const v = getActiveOrFallbackVideo();
        return v?.pause();
    },
    togglePlay: () => {
        const v = getActiveOrFallbackVideo();
        if (!v) return;
        v.paused ? v.play() : v.pause();
    },
    seekBy: (seconds) => {
        const v = getActiveOrFallbackVideo();
        if (v) v.currentTime += seconds;
    },
    stepFrame: (forward = true) => {
        const v = getActiveOrFallbackVideo();
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
        
        const v = getActiveOrFallbackVideo();
        if (desiredVolume > 1.0 && v) {
            const graph = getAudioGraph(v);
            if (graph && graph.ctx && graph.ctx.state === 'suspended') {
                graph.ctx.resume().catch(() => {});
            }
        }
        
        applyDesiredSettings();
        document.dispatchEvent(new CustomEvent('insta-player:state-updated'));
    },
    getVolume: () => desiredVolume,
    toggleMute: () => {
        desiredMuted = !desiredMuted;
        applyDesiredSettings();
        document.dispatchEvent(new CustomEvent('insta-player:state-updated'));
    },
    isMuted: () => desiredMuted
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
            const vid = getActiveOrFallbackVideo();
            const hasCanvasPlayer = document.querySelector('canvas') && !document.querySelector('video');
            if (hasCanvasPlayer) {
                sendResponse({ status: 'unsupported' });
                return true;
            }

            const allVids = document.querySelectorAll('video');
            sendResponse({
                status: (vid || allVids.length > 0) ? 'active' : 'inactive',
                count: allVids.length,
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
