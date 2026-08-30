// Handles persistent user preferences for playback using chrome.storage
const Storage = {
    settings: {
        playbackRate: 1.0,
        volume: 1.0,
        muted: false
    },
    
    async init() {
        return new Promise((resolve) => {
            if (!chrome || !chrome.storage) {
                resolve(this.settings);
                return;
            }
            chrome.storage.local.get(['playbackRate', 'volume', 'muted'], (result) => {
                if (result.playbackRate !== undefined) this.settings.playbackRate = result.playbackRate;
                if (result.volume !== undefined) this.settings.volume = result.volume;
                if (result.muted !== undefined) this.settings.muted = result.muted;
                resolve(this.settings);
            });
        });
    },

    save(key, value) {
        this.settings[key] = value;
        if (chrome && chrome.storage) {
            chrome.storage.local.set({ [key]: value });
        }
    }
};

window.InstaStorage = Storage;

// Wait for controller to initialize then listen for changes
document.addEventListener('insta-player:state-updated', () => {
    if (!window.InstaController) return;
    Storage.save('playbackRate', window.InstaController.getPlaybackRate());
    Storage.save('volume', window.InstaController.getVolume());
    Storage.save('muted', window.InstaController.isMuted());
});
