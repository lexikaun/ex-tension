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

    if (bestVideo) {
        setActiveVideo(bestVideo);
    } else if (videoList.size > 0) {
        // Fallback to first available attached video
        const first = Array.from(videoList).find(v => v.isConnected);
        if (first) setActiveVideo(first);
    } else {
        const anyVid = document.querySelector('video');
        if (anyVid) {
            handleVideo(anyVid);
            setActiveVideo(anyVid);
        }
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

// Global API for other scripts
window.InstaVideoFinder = {
    getActiveVideo: () => activeVideo || document.querySelector('video'),
    getAllVideos: () => Array.from(videoList),
    reevaluate: reevaluateActiveVideo
};
