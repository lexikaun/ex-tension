// Hooks OS media keys to the controller
document.addEventListener('insta-player:active-video-changed', (e) => {
    if (!e.detail.video || !window.InstaController) return;
    
    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', () => window.InstaController.play());
        navigator.mediaSession.setActionHandler('pause', () => window.InstaController.pause());
        navigator.mediaSession.setActionHandler('seekbackward', () => window.InstaController.seekBy(-5));
        navigator.mediaSession.setActionHandler('seekforward', () => window.InstaController.seekBy(5));
    }
});
