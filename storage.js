// Handles persistent user preferences for playback using chrome.storage
const Storage = {
    settings: {
        playbackRate: 1.0,
        volume: 1.0,
        muted: false
    },
    
    _getDomainKey() {
        return `instaplayer_settings_${window.location.hostname}`;
    },
    
    async init() {
        return new Promise((resolve) => {
            if (!chrome || !chrome.storage) {
                resolve(this.settings);
                return;
            }
            const domainKey = this._getDomainKey();
            chrome.storage.local.get([domainKey], (result) => {
                const storedSettings = result[domainKey];
                if (storedSettings) {
                    if (storedSettings.playbackRate !== undefined) this.settings.playbackRate = storedSettings.playbackRate;
                    if (storedSettings.volume !== undefined) this.settings.volume = storedSettings.volume;
                    if (storedSettings.muted !== undefined) this.settings.muted = storedSettings.muted;
                }
                resolve(this.settings);
            });
        });
    },

    save(key, value) {
        this.settings[key] = value;
        if (chrome && chrome.storage) {
            const domainKey = this._getDomainKey();
            chrome.storage.local.set({ [domainKey]: this.settings });
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
