// Wraps the active element and provides the DOM media methods + fightback
let currentVideo = null;
let desiredPlaybackRate = 1.0;
let desiredVolume = 1.0;
let desiredMuted = false;

function applyDesiredSettings() {
    if (!currentVideo) return;
    
    if (currentVideo.playbackRate !== desiredPlaybackRate) {
        currentVideo.playbackRate = desiredPlaybackRate;
    }
    if (currentVideo.volume !== desiredVolume) {
        currentVideo.volume = desiredVolume;
    }
    if (currentVideo.muted !== desiredMuted) {
        currentVideo.muted = desiredMuted;
    }
}

function onRateChange() {
    if (currentVideo && currentVideo.playbackRate !== desiredPlaybackRate) {
        currentVideo.playbackRate = desiredPlaybackRate;
    }
}

function onVolumeChange() {
    if (currentVideo) {
        if (currentVideo.volume !== desiredVolume) currentVideo.volume = desiredVolume;
        if (currentVideo.muted !== desiredMuted) currentVideo.muted = desiredMuted;
    }
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
    play: () => currentVideo?.play(),
    pause: () => currentVideo?.pause(),
    togglePlay: () => {
        if (!currentVideo) return;
        currentVideo.paused ? currentVideo.play() : currentVideo.pause();
    },
    seekBy: (seconds) => {
        if (currentVideo) currentVideo.currentTime += seconds;
    },
    setPlaybackRate: (rate) => {
        desiredPlaybackRate = Math.max(0.25, Math.min(5.0, rate));
        applyDesiredSettings();
        document.dispatchEvent(new CustomEvent('insta-player:state-updated'));
    },
    resetPlaybackRate: () => { desiredPlaybackRate = 1.0; applyDesiredSettings(); document.dispatchEvent(new CustomEvent('insta-player:state-updated')); },
    getPlaybackRate: () => desiredPlaybackRate,
    setVolume: (vol) => {
        desiredVolume = Math.max(0, Math.min(1.0, vol));
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
    isMuted: () => desiredMuted
};

