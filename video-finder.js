// Tracks all mounted videos and determines the "active" one
const mountedVideos = new WeakSet();
const videoList = new Set();
let activeVideo = null;

function setActiveVideo(video) {
    if (activeVideo === video) return;
    activeVideo = video;
    document.dispatchEvent(new CustomEvent('insta-player:active-video-changed', {
        detail: { video: activeVideo }
    }));
}

function reevaluateActiveVideo() {
    // 1. Highest Priority: Any video currently playing
    const playingVideos = Array.from(videoList).filter(v => v.isConnected && !v.paused);
    if (playingVideos.length > 0) {
        let bestPlaying = playingVideos[0];
        let maxPlayingVis = -1;
        for (const v of playingVideos) {
            const r = v.getBoundingClientRect();
            const vis = Math.max(0, Math.min(r.right, window.innerWidth) - Math.max(r.left, 0)) *
                        Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
            if (vis > maxPlayingVis) {
                maxPlayingVis = vis;
                bestPlaying = v;
            }
        }
        setActiveVideo(bestPlaying);
        return;
    }

    // 2. If activeVideo is still connected and decently visible, keep it instead of fluttering
    if (activeVideo && activeVideo.isConnected) {
        const r = activeVideo.getBoundingClientRect();
        const visHeight = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
        if (visHeight > 150) {
            return;
        }
    }

    // 3. Fallback: video with maximum visibility in viewport
    let bestVideo = null;
    let maxVisibility = 0;

    for (const video of videoList) {
        if (!video.isConnected) {
            videoList.delete(video);
            continue;
        }

        const rect = video.getBoundingClientRect();
        const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
        const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
        const visibilityScore = visibleWidth * visibleHeight;

        if (visibilityScore > maxVisibility) {
            maxVisibility = visibilityScore;
            bestVideo = video;
        }
    }

    if (bestVideo && maxVisibility > 1000) {
        setActiveVideo(bestVideo);
    }
}

const intersectionObserver = new IntersectionObserver((entries) => {
    let needsReevaluation = false;
    entries.forEach(entry => {
        if (entry.isIntersecting) needsReevaluation = true;
    });
    if (needsReevaluation) reevaluateActiveVideo();
}, { threshold: [0, 0.5, 1] });

function handleVideo(video) {
    if (mountedVideos.has(video)) return;
    mountedVideos.add(video);
    videoList.add(video);
    
    intersectionObserver.observe(video);
    
    video.addEventListener('play', () => setActiveVideo(video));
    video.addEventListener('playing', () => setActiveVideo(video));
    video.addEventListener('pause', () => {
        setTimeout(reevaluateActiveVideo, 50);
    });
    
    reevaluateActiveVideo();
}

const mutationObserver = new MutationObserver((mutations) => {
    let hasNewVideos = false;
    for (const m of mutations) {
        for (const node of m.addedNodes) {
            if (node.nodeType !== 1) continue;
            if (node.nodeName === 'VIDEO') {
                handleVideo(node);
                hasNewVideos = true;
            } else if (node.querySelector) {
                const vids = node.querySelectorAll('video, audio');
                if (vids.length > 0) {
                    vids.forEach(handleVideo);
                    hasNewVideos = true;
                }
            }
        }
    }
    if (hasNewVideos) reevaluateActiveVideo();
});

const initObserver = () => {
    document.querySelectorAll('video, audio').forEach(handleVideo);
    if (document.documentElement) {
        mutationObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
};

if (document.documentElement) {
    initObserver();
} else {
    document.addEventListener('DOMContentLoaded', initObserver);
}

// Global API for other scripts
window.InstaVideoFinder = {
    getActiveVideo: () => activeVideo || document.querySelector('video, audio'),
    getAllVideos: () => Array.from(videoList),
    reevaluate: reevaluateActiveVideo
};

