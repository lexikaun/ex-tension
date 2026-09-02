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
    if (window.location.pathname.startsWith('/direct')) {
        setActiveVideo(null);
        return;
    }

    let playingVideo = null;
    let maxPlayingVisibility = 0;

    let bestVideo = null;
    let maxVisibility = 0;

    for (const video of videoList) {
        if (!video.isConnected || video.nodeName !== 'VIDEO') {
            videoList.delete(video);
            continue;
        }

        const rect = video.getBoundingClientRect();
        const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
        const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
        const visibilityScore = visibleWidth * visibleHeight;

        // Skip if not meaningfully visible
        if (visibilityScore < 2000 || rect.width < 50 || rect.height < 50) {
            continue;
        }

        // Check if actively playing
        const isPlaying = !video.paused && !video.ended && video.readyState > 1;
        if (isPlaying) {
            if (visibilityScore > maxPlayingVisibility) {
                maxPlayingVisibility = visibilityScore;
                playingVideo = video;
            }
        }

        if (visibilityScore > maxVisibility) {
            maxVisibility = visibilityScore;
            bestVideo = video;
        }
    }

    // Always prefer the video currently playing
    const selected = playingVideo || bestVideo || null;
    setActiveVideo(selected);
}

const intersectionObserver = new IntersectionObserver((entries) => {
    let needsReevaluation = false;
    entries.forEach(entry => {
        if (entry.isIntersecting) needsReevaluation = true;
    });
    if (needsReevaluation) reevaluateActiveVideo();
}, { threshold: [0, 0.25, 0.5, 0.75, 1] });

function handleVideo(video) {
    if (!video || video.nodeName !== 'VIDEO' || mountedVideos.has(video)) return;
    mountedVideos.add(video);
    videoList.add(video);
    
    intersectionObserver.observe(video);
    
    video.addEventListener('play', () => setActiveVideo(video));
    video.addEventListener('playing', () => setActiveVideo(video));
    video.addEventListener('pause', () => reevaluateActiveVideo());
    video.addEventListener('ended', () => reevaluateActiveVideo());
    
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
                const vids = node.querySelectorAll('video');
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
    document.querySelectorAll('video').forEach(handleVideo);
    if (document.documentElement) {
        mutationObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
};

if (document.documentElement) {
    initObserver();
} else {
    document.addEventListener('DOMContentLoaded', initObserver);
}

// Re-evaluate on scroll & navigation
window.addEventListener('scroll', () => {
    reevaluateActiveVideo();
}, { passive: true });

window.addEventListener('popstate', reevaluateActiveVideo);

// Global API for other scripts
window.InstaVideoFinder = {
    getActiveVideo: () => activeVideo,
    getAllVideos: () => Array.from(videoList).filter(v => v.isConnected && v.nodeName === 'VIDEO'),
    reevaluate: reevaluateActiveVideo
};

