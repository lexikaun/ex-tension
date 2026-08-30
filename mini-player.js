// Document PiP mini-player
let pipWindow = null;
let originalParent = null;
let videoPlaceholder = null;

window.InstaPiP = {
    async toggle() {
        if (!window.InstaController) return;
        const video = window.InstaController.getCurrentVideo();
        if (!video) return;

        if (pipWindow) {
            pipWindow.close();
            return;
        }

        if ('documentPictureInPicture' in window) {
            try {
                pipWindow = await documentPictureInPicture.requestWindow({
                    width: Math.max(300, video.clientWidth),
                    height: Math.max(500, video.clientHeight)
                });

                originalParent = video.parentNode;
                videoPlaceholder = document.createElement('div');
                videoPlaceholder.style.width = video.clientWidth + 'px';
                videoPlaceholder.style.height = video.clientHeight + 'px';
                videoPlaceholder.style.background = '#111';
                originalParent.insertBefore(videoPlaceholder, video);

                pipWindow.document.body.style.margin = '0';
                pipWindow.document.body.style.background = '#000';
                pipWindow.document.body.style.display = 'flex';
                pipWindow.document.body.style.height = '100vh';
                
                video.style.width = '100%';
                video.style.height = '100%';
                video.style.objectFit = 'contain';
                
                pipWindow.document.body.appendChild(video);
                
                // Re-parent overlay UI to PiP
                const uiHost = document.getElementById('insta-player-ui-host');
                if (uiHost) pipWindow.document.body.appendChild(uiHost);

                pipWindow.addEventListener('pagehide', () => {
                    if (originalParent && videoPlaceholder.parentNode) {
                        originalParent.replaceChild(video, videoPlaceholder);
                        video.style.width = '';
                        video.style.height = '';
                        video.style.objectFit = '';
                    }
                    if (uiHost) document.body.appendChild(uiHost);
                    pipWindow = null;
                });
            } catch (err) {
                console.error('Document PiP error:', err);
                // Fallback to standard PiP
                if (video.requestPictureInPicture) video.requestPictureInPicture();
            }
        } else if (video.requestPictureInPicture) {
            // Fallback to standard PiP
            if (document.pictureInPictureElement) {
                document.exitPictureInPicture();
            } else {
                video.requestPictureInPicture();
            }
        }
    }
};
