document.addEventListener('DOMContentLoaded', async () => {
    const statusDot = document.getElementById('status-dot');
    const statusHeading = document.getElementById('status-heading');
    const statusDesc = document.getElementById('status-desc');
    const actionPanel = document.getElementById('action-panel');
    const enableBtn = document.getElementById('enable-btn');

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url || tab.url.startsWith('chrome://')) {
        setUnsupported("System Page", "Extensions cannot run on this page.");
        return;
    }

    const url = new URL(tab.url);
    const origin = url.origin + "/*";

    const hasPermission = await chrome.permissions.contains({
        origins: [origin]
    });

    if (!hasPermission) {
        statusDot.className = 'status-indicator';
        statusHeading.textContent = "Site Not Enabled";
        statusDesc.textContent = "InstaPlayer is inactive on this domain.";
        actionPanel.classList.remove('hidden');

        enableBtn.addEventListener('click', async () => {
            const granted = await chrome.permissions.request({ origins: [origin] });
            if (granted) {
                chrome.tabs.reload(tab.id);
                window.close();
            }
        });
        return;
    }

    try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: "PING_PLAYER_STATUS" });
        if (response && response.status === 'active') {
            statusDot.className = 'status-indicator active';
            statusHeading.textContent = "Player Active";
            statusDesc.textContent = \`Tracking \${response.count} video(s) on page.\`;
        } else if (response && response.status === 'unsupported') {
            setUnsupported("Unsupported Player", "A closed shadow DOM or canvas player was detected.");
        } else {
            setUnsupported("No Videos Found", "Could not find any standard HTML5 videos on this page.");
        }
    } catch (err) {
        setUnsupported("Waiting for Page", "Ensure the page is fully loaded or refresh the tab.");
    }

    function setUnsupported(title, desc) {
        statusDot.className = 'status-indicator error';
        statusHeading.textContent = title;
        statusDesc.textContent = desc;
    }
});
