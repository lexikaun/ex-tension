// Wraps the active element and provides the DOM media methods + fightback + Web Audio
let currentVideo = null;
let desiredPlaybackRate = 1.0;
let desiredVolume = 1.0;
let desiredMuted = false;

// Web Audio tracking for volume boost
const audioGraphs = new WeakMap();
const MAX_VOLUME = 4.0; // 400% max boost

function getAudioGraph(video) {
    if (audioGraphs.has(video)) return audioGraphs.get(video);
    
    // Create lazily only when volume goes > 1.0
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const source = ctx.createMediaElementSource(video);
    const gainNode = ctx.createGain();
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    const graph = { ctx, gainNode };
    audioGraphs.set(video, graph);
    return graph;
}

function applyDesiredSettings() {
    if (!currentVideo) return;
    
    if (currentVideo.playbackRate !== desiredPlaybackRate) {
        currentVideo.playbackRate = desiredPlaybackRate;
    }
    
    if (currentVideo.muted !== desiredMuted) {
        currentVideo.muted = desiredMuted;
    }

    if (desiredVolume <= 1.0) {
        if (currentVideo.volume !== desiredVolume) currentVideo.volume = desiredVolume;
        if (audioGraphs.has(currentVideo)) {
            audioGraphs.get(currentVideo).gainNode.gain.value = 1.0;
        }
    } else {
        currentVideo.volume = 1.0; // Max out native volume
        const graph = getAudioGraph(currentVideo);
        graph.gainNode.gain.value = desiredVolume;
    }
}

function onRateChange() {
    if (currentVideo && currentVideo.playbackRate !== desiredPlaybackRate) {
        currentVideo.playbackRate = desiredPlaybackRate;
    }
}

function onVolumeChange() {
    if (!currentVideo) return;
    if (desiredVolume <= 1.0) {
        if (currentVideo.volume !== desiredVolume) currentVideo.volume = desiredVolume;
    } else {
        if (currentVideo.volume !== 1.0) currentVideo.volume = 1.0;
    }
    if (currentVideo.muted !== desiredMuted) currentVideo.muted = desiredMuted;
}

function onLoadedMetadata() {
    applyDesiredSettings();
}

function attachListeners(video) {
    video.addEventListener('ratechange', onRateChange);
    video.addEventListener('volumechange', onVolumeChange);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
}

function detachListeners(video) {
    video.removeEventListener('ratechange', onRateChange);
    video.removeEventListener('volumechange', onVolumeChange);
    video.removeEventListener('loadedmetadata', onLoadedMetadata);
}

// Load settings on init
if (window.InstaStorage) {
    window.InstaStorage.init().then(settings => {
        desiredPlaybackRate = settings.playbackRate;
        desiredVolume = settings.volume;
        desiredMuted = settings.muted;
        applyDesiredSettings();
        document.dispatchEvent(new CustomEvent('insta-player:state-updated'));
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
    getCurrentVideo: () => currentVideo,
    play: () => currentVideo?.play(),
    pause: () => currentVideo?.pause(),
    togglePlay: () => {
        if (!currentVideo) return;
        currentVideo.paused ? currentVideo.play() : currentVideo.pause();
    },
    seekBy: (seconds) => {
        if (currentVideo) currentVideo.currentTime += seconds;
    },
    stepFrame: (forward = true) => {
        if (!currentVideo) return;
        currentVideo.pause();
        const fps = 30; // Reliable fallback step size
        currentVideo.currentTime += (forward ? 1 : -1) * (1 / fps);
    },
    setPlaybackRate: (rate) => {
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
        desiredVolume = Math.max(0, Math.min(MAX_VOLUME, vol));
        if (desiredVolume > 0) desiredMuted = false;
        
        // Ensure AudioContext is resumed upon user interaction
        if (desiredVolume > 1.0 && currentVideo) {
            const ctx = getAudioGraph(currentVideo).ctx;
            if (ctx.state === 'suspended') ctx.resume();
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
