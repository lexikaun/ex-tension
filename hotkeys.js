// In-page keyboard shortcuts with input-focus guarding and modifiers
const defaultBindings = {
    ' ': 'togglePlay',
    'arrowright': 'seekForward',
    'arrowleft': 'seekBackward',
    'arrowup': 'volumeUp',
    'arrowdown': 'volumeDown',
    'm': 'toggleMute',
    ']': 'speedUp',
    '[': 'speedDown',
    'r': 'resetSpeed',
    'p': 'togglePiP'
};

const shiftBindings = {
    'arrowright': 'stepFrameForward',
    'arrowleft': 'stepFrameBackward'
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
    // Guard against typing in comment boxes
    if (isInputFocused()) return;
    
    const key = e.key.toLowerCase();
    
    let action = null;
    if (e.shiftKey && shiftBindings[key]) {
        action = shiftBindings[key];
    } else if (!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        action = defaultBindings[key];
    }
    
    if (!action) return;
    if (!window.InstaController) return;

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
        case 'stepFrameForward':
            e.preventDefault();
            window.InstaController.stepFrame(true);
            break;
        case 'stepFrameBackward':
            e.preventDefault();
            window.InstaController.stepFrame(false);
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
        case 'resetSpeed':
            e.preventDefault();
            window.InstaController.resetPlaybackRate();
            break;
        case 'togglePiP':
            e.preventDefault();
            if (window.InstaPiP) window.InstaPiP.toggle();
            break;
    }
}, { capture: true }); // Intercept before host site handlers
