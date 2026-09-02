// Only run on Instagram as per user requirement
if (window.location.hostname.includes('instagram.com')) {

    const playerHost = document.createElement('div');
    playerHost.id = 'insta-custom-player-host';
    playerHost.style.position = 'absolute';
    playerHost.style.bottom = '0';
    playerHost.style.left = '0';
    playerHost.style.width = '100%';
    playerHost.style.zIndex = '999999';
    playerHost.style.pointerEvents = 'none'; // Let clicks pass through if we're not hovering the bar itself

    const shadow = playerHost.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
        :host {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            --primary: #ffffff;
            --bg: rgba(15, 15, 15, 0.65);
            --bg-hover: rgba(25, 25, 25, 0.8);
            --accent: #E0E0E0;
        }

        .player-container {
            position: absolute;
            bottom: 40px; /* Float above native captions */
            left: 5%;
            width: 90%;
            background: var(--bg);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 12px 16px;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            gap: 10px;
            opacity: 0;
            transform: translateY(10px);
            transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            pointer-events: auto;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        }

        .player-container.visible, .player-container:hover {
            opacity: 1;
            transform: translateY(0);
        }

        .controls-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .controls-left, .controls-right {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        button {
            background: none;
            border: none;
            padding: 4px;
            margin: 0;
            cursor: pointer;
            color: var(--primary);
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.7;
            transition: opacity 0.2s, transform 0.1s;
        }
        
        button:hover {
            opacity: 1;
            transform: scale(1.1);
        }

        svg {
            width: 22px;
            height: 22px;
            fill: currentColor;
            filter: drop-shadow(0px 1px 2px rgba(0,0,0,0.3));
        }

        .time-display {
            color: var(--primary);
            font-size: 13px;
            font-variant-numeric: tabular-nums;
            font-weight: 500;
            opacity: 0.9;
            letter-spacing: 0.3px;
        }

        /* Scrubber */
        .scrubber-wrapper {
            position: relative;
            width: 100%;
            height: 16px;
            display: flex;
            align-items: center;
            cursor: pointer;
            border-radius: 8px;
        }

        .scrubber-track {
            position: absolute;
            left: 0;
            width: 100%;
            height: 4px;
            background: rgba(255, 255, 255, 0.25);
            border-radius: 2px;
            transition: height 0.2s;
        }

        .scrubber-progress {
            position: absolute;
            left: 0;
            height: 4px;
            background: var(--primary);
            border-radius: 2px;
            width: 0%;
            transition: height 0.2s;
        }

        .scrubber-thumb {
            position: absolute;
            width: 12px;
            height: 12px;
            background: var(--primary);
            border-radius: 50%;
            left: 0%;
            transform: translateX(-50%) scale(0);
            transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            pointer-events: none;
            box-shadow: 0 1px 4px rgba(0,0,0,0.4);
        }

        .scrubber-wrapper:hover .scrubber-track,
        .scrubber-wrapper:hover .scrubber-progress {
            height: 6px;
        }

        .scrubber-wrapper:hover .scrubber-thumb {
            transform: translateX(-50%) scale(1.2);
        }

        /* Volume Slider Popup */
        .volume-container {
            position: relative;
            display: flex;
            align-items: center;
        }

        .volume-popup {
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%) translateY(10px);
            background: var(--bg-hover);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 12px 0;
            opacity: 0;
            visibility: hidden;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.3);
        }

        .volume-container:hover .volume-popup {
            opacity: 1;
            visibility: visible;
            transform: translateX(-50%) translateY(-12px);
        }

        .volume-slider {
            -webkit-appearance: slider-vertical;
            appearance: slider-vertical;
            width: 6px;
            height: 80px;
            cursor: pointer;
            background: rgba(255,255,255,0.2);
            border-radius: 3px;
            outline: none;
        }
        
        .volume-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 14px;
            height: 14px;
            background: #fff;
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 1px 3px rgba(0,0,0,0.5);
        }
    `;

    const container = document.createElement('div');
    container.className = 'player-container';
    
    // SVGs
    const icons = {
        play: '<path d="M8 5v14l11-7z"/>',
        pause: '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>',
        mute: '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>',
        unmute: '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>',
        pip: '<path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"/>',
        fullscreen: '<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>',
        exitFullscreen: '<path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>'
    };

    const makeSvg = (path) => `<svg viewBox="0 0 24 24">${path}</svg>`;

    container.innerHTML = `
        <div class="scrubber-wrapper">
            <div class="scrubber-track"></div>
            <div class="scrubber-progress"></div>
            <div class="scrubber-thumb"></div>
        </div>
        <div class="controls-row">
            <div class="controls-left">
                <button class="btn-play-pause">${makeSvg(icons.play)}</button>
                <div class="volume-container">
                    <button class="btn-mute">${makeSvg(icons.unmute)}</button>
                    <div class="volume-popup">
                        <input type="range" class="volume-slider" min="0" max="1" step="0.01" value="1" orient="vertical">
                    </div>
                </div>
                <div class="time-display">0:00 / 0:00</div>
            </div>
            <div class="controls-right">
                <button class="btn-pip">${makeSvg(icons.pip)}</button>
                <button class="btn-fullscreen">${makeSvg(icons.fullscreen)}</button>
            </div>
        </div>
    `;

    shadow.appendChild(style);
    shadow.appendChild(container);

    // Elements
    const btnPlayPause = container.querySelector('.btn-play-pause');
    const btnMute = container.querySelector('.btn-mute');
    const btnPip = container.querySelector('.btn-pip');
    const btnFullscreen = container.querySelector('.btn-fullscreen');
    const timeDisplay = container.querySelector('.time-display');
    const scrubberWrapper = container.querySelector('.scrubber-wrapper');
    const scrubberProgress = container.querySelector('.scrubber-progress');
    const scrubberThumb = container.querySelector('.scrubber-thumb');
    const volumeSlider = container.querySelector('.volume-slider');

    let currentVideo = null;
    let isDragging = false;
    let isDraggingVolume = false;
    let visibilityTimeout = null;

    // Helpers
    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    function updateUI() {
        if (!currentVideo) return;
        
        // Play/Pause
        btnPlayPause.innerHTML = makeSvg(currentVideo.paused ? icons.play : icons.pause);
        
        // Mute & Volume
        const isMuted = currentVideo.muted || currentVideo.volume === 0;
        btnMute.innerHTML = makeSvg(isMuted ? icons.mute : icons.unmute);
        if (!isDraggingVolume) {
            volumeSlider.value = isMuted ? 0 : currentVideo.volume;
        }
        
        // Time & Scrubber (only if not dragging)
        if (!isDragging) {
            const cur = currentVideo.currentTime;
            const dur = currentVideo.duration;
            timeDisplay.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
            
            if (dur > 0) {
                const percent = (cur / dur) * 100;
                scrubberProgress.style.width = `${percent}%`;
                scrubberThumb.style.left = `${percent}%`;
            }
        }
    }

    function showControls() {
        container.classList.add('visible');
        clearTimeout(visibilityTimeout);
        visibilityTimeout = setTimeout(() => {
            if (!currentVideo?.paused && !isDragging && !isDraggingVolume) {
                container.classList.remove('visible');
            }
        }, 2500);
    }

    // Interactions
    btnPlayPause.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!currentVideo) return;
        currentVideo.paused ? currentVideo.play() : currentVideo.pause();
    });

    btnMute.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!currentVideo) return;
        currentVideo.muted = !currentVideo.muted;
        if (!currentVideo.muted && currentVideo.volume === 0) {
            currentVideo.volume = 1;
        }
    });

    volumeSlider.addEventListener('mousedown', () => isDraggingVolume = true);
    volumeSlider.addEventListener('mouseup', () => isDraggingVolume = false);
    volumeSlider.addEventListener('input', (e) => {
        if (!currentVideo) return;
        const val = parseFloat(e.target.value);
        currentVideo.volume = val;
        currentVideo.muted = val === 0;
    });

    btnPip.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.InstaPiP) window.InstaPiP.toggle();
    });

    btnFullscreen.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!currentVideo) return;
        const parent = currentVideo.closest('article') || currentVideo.parentNode;
        if (document.fullscreenElement) {
            document.exitFullscreen();
            btnFullscreen.innerHTML = makeSvg(icons.fullscreen);
        } else {
            parent.requestFullscreen();
            btnFullscreen.innerHTML = makeSvg(icons.exitFullscreen);
        }
    });

    // Scrubber Logic
    function handleScrub(e) {
        if (!currentVideo || !currentVideo.duration) return;
        const rect = scrubberWrapper.getBoundingClientRect();
        const pos = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percent = pos / rect.width;
        
        scrubberProgress.style.width = `${percent * 100}%`;
        scrubberThumb.style.left = `${percent * 100}%`;
        
        if (!isDragging) {
            currentVideo.currentTime = percent * currentVideo.duration;
        } else {
            timeDisplay.textContent = `${formatTime(percent * currentVideo.duration)} / ${formatTime(currentVideo.duration)}`;
        }
    }

    scrubberWrapper.addEventListener('mousedown', (e) => {
        isDragging = true;
        handleScrub(e);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
        if (isDragging) handleScrub(e);
    }

    function onMouseUp(e) {
        if (isDragging) {
            isDragging = false;
            const rect = scrubberWrapper.getBoundingClientRect();
            const pos = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
            if (currentVideo && currentVideo.duration) {
                currentVideo.currentTime = (pos / rect.width) * currentVideo.duration;
            }
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }
    }

    // Attach to active video
    function attachToVideo(video) {
        if (currentVideo) {
            currentVideo.removeEventListener('timeupdate', updateUI);
            currentVideo.removeEventListener('play', updateUI);
            currentVideo.removeEventListener('pause', updateUI);
            currentVideo.removeEventListener('volumechange', updateUI);
            currentVideo.removeEventListener('loadedmetadata', updateUI);
        }

        currentVideo = video;
        if (!video) {
            if (playerHost.parentNode) playerHost.parentNode.removeChild(playerHost);
            return;
        }

        // Always attach to body to avoid clipping and stacking context issues
        if (playerHost.parentNode !== document.body) {
            document.body.appendChild(playerHost);
        }
        playerHost.style.position = 'fixed';
        playerHost.style.zIndex = '2147483647'; // Max z-index

        video.addEventListener('timeupdate', updateUI);
        video.addEventListener('play', () => { updateUI(); showControls(); });
        video.addEventListener('pause', () => { updateUI(); showControls(); });
        video.addEventListener('volumechange', updateUI);
        video.addEventListener('loadedmetadata', updateUI);
        
        // Show controls on mouse move over the video container
        const targetContainer = video.closest('article') || video.parentNode;
        targetContainer.addEventListener('mousemove', showControls);
        targetContainer.addEventListener('mouseleave', () => {
            if (!currentVideo?.paused && !isDragging && !isDraggingVolume) {
                container.classList.remove('visible');
            }
        });
        
        // Ensure player host captures mouse movements to stay visible
        playerHost.addEventListener('mousemove', showControls);
        playerHost.addEventListener('mouseleave', () => {
            if (!currentVideo?.paused && !isDragging && !isDraggingVolume) {
                container.classList.remove('visible');
            }
        });

        updateUI();
        showControls();
    }

    // Sync position of the control bar to the video
    function syncPosition() {
        if (currentVideo && currentVideo.isConnected && container.classList.contains('visible')) {
            const rect = currentVideo.getBoundingClientRect();
            // Only show if video is somewhat visible
            if (rect.width > 50 && rect.height > 50 && rect.bottom > 0 && rect.top < window.innerHeight) {
                playerHost.style.left = `${rect.left}px`;
                playerHost.style.width = `${rect.width}px`;
                
                // Anchor playerHost exactly at the bottom of the video
                playerHost.style.top = `${rect.bottom}px`;
                playerHost.style.bottom = 'auto';
                playerHost.style.display = 'block';
            } else {
                playerHost.style.display = 'none';
            }
        }
        requestAnimationFrame(syncPosition);
    }
    requestAnimationFrame(syncPosition);

    document.addEventListener('insta-player:active-video-changed', (e) => {
        attachToVideo(e.detail.video);
    });

    // Initial check
    if (window.InstaVideoFinder) {
        attachToVideo(window.InstaVideoFinder.getActiveVideo());
    }

}
