// background.js

const CONTENT_SCRIPTS = [
    "storage.js",
    "adapters/site-adapters.js",
    "video-finder.js",
    "controller.js",
    "hotkeys.js",
    "overlay-ui.js",
    "media-session.js",
    "mini-player.js"
];

// Dynamically inject content scripts on newly granted origins
chrome.permissions.onAdded.addListener(async (permissions) => {
    if (permissions.origins && permissions.origins.length > 0) {
        try {
            await chrome.scripting.registerContentScripts([{
                id: "instaplayer-dynamic-" + Date.now(),
                matches: permissions.origins,
                js: CONTENT_SCRIPTS,
                allFrames: true,
                runAt: "document_start"
            }]);
            console.log("Successfully registered content scripts for", permissions.origins);
        } catch (err) {
            console.error("Failed to register content scripts:", err);
        }
    }
});

// Also allow executing scripts immediately if needed (optional)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Handling generic background messages
});
