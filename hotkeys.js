// In-page keyboard shortcuts with input-focus guarding
const defaultBindings = {
    ' ': 'togglePlay',
    'arrowright': 'seekForward',
    'arrowleft': 'seekBackward',
    'arrowup': 'volumeUp',
    'arrowdown': 'volumeDown',
    'm': 'toggleMute',
    ']': 'speedUp',
    '[': 'speedDown'
};

function isInputFocused() {
    const active = document.activeElement;
    if (!active) return false;
    
    const tagName = active.tagName.toLowerCase();
    const isTextInput = tagName === 'input' && 
        ['text', 'search', 'email', 'number', 'password', 'tel', 'url'].includes(active.type);
    const isTextArea = tagName === 'textarea';
    const isContentEditable = active.isContentEditable || active.getAttribute('role') === 'textbox';
    
    return isTextInput || isTextArea || isContentEditable;
}

document.addEventListener('keydown', (e) => {
    if (isInputFocused()) return;
    
    const key = e.key.toLowerCase();
    const action = defaultBindings[key];
    
    if (!action || !window.InstaController) return;

    switch (action) {
        case 'togglePlay':
            e.preventDefault();
            window.InstaController.togglePlay();
            break;
        case 'seekForward':
            e.preventDefault();
            window.InstaController.seekBy(5);
            break;
        case 'seekBackward':
            e.preventDefault();
            window.InstaController.seekBy(-5);
            break;
        case 'volumeUp':
            e.preventDefault();
            window.InstaController.setVolume(window.InstaController.getVolume() + 0.1);
            break;
        case 'volumeDown':
            e.preventDefault();
            window.InstaController.setVolume(window.InstaController.getVolume() - 0.1);
            break;
        case 'toggleMute':
            e.preventDefault();
            window.InstaController.toggleMute();
            break;
        case 'speedUp':
            e.preventDefault();
            window.InstaController.setPlaybackRate(window.InstaController.getPlaybackRate() + 0.25);
            break;
        case 'speedDown':
            e.preventDefault();
            window.InstaController.setPlaybackRate(window.InstaController.getPlaybackRate() - 0.25);
            break;
    }
}, { capture: true });
