const videoInput = document.getElementById("videoInput");
const uploadCard = document.getElementById("uploadCard");
const editor = document.getElementById("editor");
const uploadError = document.getElementById("uploadError");

const stage = document.getElementById("stage");
const canvas = document.getElementById("previewCanvas");
const ctx = canvas.getContext("2d");

const sourceVideo = document.getElementById("sourceVideo");
const stageHint = document.getElementById("stageHint");

const zoomSlider = document.getElementById("zoom");
const zoomValue = document.getElementById("zoomValue");

const resetBtn = document.getElementById("resetBtn");
const playBtn = document.getElementById("playBtn");
const downloadBtn = document.getElementById("downloadBtn");

const progressBox = document.getElementById("progressBox");
const progressText = document.getElementById("progressText");
const progressPct = document.getElementById("progressPct");
const progressBar = document.getElementById("progressBar");

const downloadLink = document.getElementById("downloadLink");


/* =========================================================
   TWIBBON
========================================================= */

const twibbon = new Image();
twibbon.src = "assets/twibbon-overlay.png";


/* =========================================================
   CANVAS
========================================================= */

canvas.width = 1080;
canvas.height = 1920;

ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";


/* =========================================================
   STATE
========================================================= */

const state = {
    videoURL: null,
    downloadURL: null,

    videoReady: false,

    zoom: 1,
    offsetX: 0,
    offsetY: 0,

    dragging: false,

    dragStartX: 0,
    dragStartY: 0,

    startOffsetX: 0,
    startOffsetY: 0,

    animationFrame: null,

    exporting: false,
    exportTimer: null,

    ffmpeg: null,
    ffmpegLoaded: false,
    ffmpegLoading: false,

    audioContext: null,
    audioSource: null,
    audioDestination: null
};


/* =========================================================
   HELPERS
========================================================= */

function showError(message) {

    uploadError.textContent = message;
    uploadError.hidden = false;
}


function clearError() {

    uploadError.textContent = "";
    uploadError.hidden = true;
}


function clamp(value, min, max) {

    return Math.min(
        Math.max(value, min),
        max
    );
}


function sleep(ms) {

    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}


/* =========================================================
   TWIBBON LOADED
========================================================= */

twibbon.onload = () => {

    renderFrame();
};


/* =========================================================
   UPLOAD VIDEO
========================================================= */

videoInput.addEventListener(
    "change",
    () => {

        const file =
            videoInput.files?.[0];

        clearError();

        if (!file) return;


        if (!file.type.startsWith("video/")) {

            showError(
                "File yang dipilih bukan video."
            );

            videoInput.value = "";

            return;
        }


        loadVideo(file);
    }
);


/* =========================================================
   LOAD VIDEO
========================================================= */

function loadVideo(file) {

    if (state.videoURL) {

        URL.revokeObjectURL(
            state.videoURL
        );
    }


    if (state.downloadURL) {

        URL.revokeObjectURL(
            state.downloadURL
        );

        state.downloadURL = null;
    }


    state.videoURL =
        URL.createObjectURL(file);

    state.videoReady = false;


    sourceVideo.pause();

    sourceVideo.src =
        state.videoURL;

    sourceVideo.playsInline = true;

    sourceVideo.setAttribute(
        "playsinline",
        ""
    );

    sourceVideo.preload = "auto";

    sourceVideo.muted = false;
    sourceVideo.volume = 1;

    sourceVideo.load();


    sourceVideo.addEventListener(
        "loadedmetadata",
        handleVideoMetadata,
        { once: true }
    );


    sourceVideo.addEventListener(
        "error",
        handleVideoError,
        { once: true }
    );
}


/* =========================================================
   VIDEO ERROR
========================================================= */

function handleVideoError() {

    showError(
        "Video tidak dapat dibaca oleh browser."
    );
}


/* =========================================================
   VIDEO METADATA
========================================================= */

function handleVideoMetadata() {

    const duration =
        sourceVideo.duration;


    if (
        !Number.isFinite(duration) ||
        duration <= 0
    ) {

        showError(
            "Durasi video tidak dapat dibaca."
        );

        return;
    }


    if (duration > 30) {

        showError(
            "Video maksimal 30 detik."
        );

        sourceVideo.pause();

        sourceVideo.removeAttribute(
            "src"
        );

        sourceVideo.load();

        state.videoReady = false;

        return;
    }


    state.zoom = 1;

    state.offsetX = 0;
    state.offsetY = 0;


    zoomSlider.value = 100;

    zoomValue.textContent =
        "100%";


    uploadCard.hidden = true;

    editor.hidden = false;


    stageHint.hidden = false;

    progressBox.hidden = true;

    downloadLink.hidden = true;


    state.videoReady = true;


    sourceVideo.currentTime = 0;


    sourceVideo.addEventListener(
        "loadeddata",
        () => {

            renderFrame();

        },
        { once: true }
    );
}


/* =========================================================
   VIDEO DRAW SIZE
========================================================= */

function getVideoDrawDimensions() {

    const videoWidth =
        sourceVideo.videoWidth;

    const videoHeight =
        sourceVideo.videoHeight;


    if (
        !videoWidth ||
        !videoHeight
    ) {

        return null;
    }


    const canvasRatio =
        canvas.width /
        canvas.height;


    const videoRatio =
        videoWidth /
        videoHeight;


    let drawWidth;
    let drawHeight;


    if (videoRatio > canvasRatio) {

        drawHeight =
            canvas.height;

        drawWidth =
            drawHeight *
            videoRatio;

    } else {

        drawWidth =
            canvas.width;

        drawHeight =
            drawWidth /
            videoRatio;
    }


    drawWidth *=
        state.zoom;

    drawHeight *=
        state.zoom;


    return {
        width: drawWidth,
        height: drawHeight
    };
}


/* =========================================================
   RENDER FRAME
========================================================= */

function renderFrame() {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    ctx.fillStyle =
        "#000";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    if (
        state.videoReady &&
        sourceVideo.readyState >= 2
    ) {

        const dimensions =
            getVideoDrawDimensions();


        if (dimensions) {

            const x =
                (
                    canvas.width -
                    dimensions.width
                ) / 2 +
                state.offsetX;


            const y =
                (
                    canvas.height -
                    dimensions.height
                ) / 2 +
                state.offsetY;


            ctx.drawImage(
                sourceVideo,
                x,
                y,
                dimensions.width,
                dimensions.height
            );
        }
    }


    if (
        twibbon.complete &&
        twibbon.naturalWidth > 0
    ) {

        ctx.drawImage(
            twibbon,
            0,
            0,
            canvas.width,
            canvas.height
        );
    }
}


/* =========================================================
   PREVIEW LOOP
========================================================= */

function startPreviewLoop() {

    if (state.animationFrame) {

        cancelAnimationFrame(
            state.animationFrame
        );
    }


    function loop() {

        renderFrame();


        if (
            !sourceVideo.paused &&
            !sourceVideo.ended
        ) {

            state.animationFrame =
                requestAnimationFrame(
                    loop
                );

        } else {

            state.animationFrame =
                null;
        }
    }


    loop();
}


/* =========================================================
   ZOOM
========================================================= */

zoomSlider.addEventListener(
    "input",
    () => {

        state.zoom =
            Number(
                zoomSlider.value
            ) / 100;


        zoomValue.textContent =
            `${zoomSlider.value}%`;


        renderFrame();
    }
);


/* =========================================================
   RESET
========================================================= */

resetBtn.addEventListener(
    "click",
    () => {

        if (state.exporting) return;


        state.zoom = 1;

        state.offsetX = 0;
        state.offsetY = 0;


        zoomSlider.value = 100;

        zoomValue.textContent =
            "100%";


        sourceVideo.currentTime = 0;


        stageHint.hidden = false;


        renderFrame();
    }
);


/* =========================================================
   DRAG START
========================================================= */

stage.addEventListener(
    "pointerdown",
    event => {

        if (!state.videoReady) return;

        if (state.exporting) return;


        state.dragging = true;


        stage.setPointerCapture(
            event.pointerId
        );


        state.dragStartX =
            event.clientX;

        state.dragStartY =
            event.clientY;


        state.startOffsetX =
            state.offsetX;

        state.startOffsetY =
            state.offsetY;


        stageHint.hidden = true;


        stage.style.cursor =
            "grabbing";
    }
);


/* =========================================================
   DRAG MOVE
========================================================= */

stage.addEventListener(
    "pointermove",
    event => {

        if (!state.dragging) {
            return;
        }


        const rect =
            stage.getBoundingClientRect();


        const scaleX =
            canvas.width /
            rect.width;


        const scaleY =
            canvas.height /
            rect.height;


        const deltaX =
            (
                event.clientX -
                state.dragStartX
            ) * scaleX;


        const deltaY =
            (
                event.clientY -
                state.dragStartY
            ) * scaleY;


        state.offsetX =
            state.startOffsetX +
            deltaX;


        state.offsetY =
            state.startOffsetY +
            deltaY;


        renderFrame();
    }
);


/* =========================================================
   DRAG END
========================================================= */

function stopDragging(event) {

    if (!state.dragging) {
        return;
    }


    state.dragging = false;


    try {

        stage.releasePointerCapture(
            event.pointerId
        );

    } catch (error) {}


    stage.style.cursor =
        "grab";
}


stage.addEventListener(
    "pointerup",
    stopDragging
);


stage.addEventListener(
    "pointercancel",
    stopDragging
);


/* =========================================================
   PREVIEW BUTTON
========================================================= */

playBtn.addEventListener(
    "click",
    async () => {

        if (!state.videoReady) {
            return;
        }


        if (state.exporting) {
            return;
        }


        if (
            sourceVideo.paused ||
            sourceVideo.ended
        ) {

            if (sourceVideo.ended) {

                sourceVideo.currentTime = 0;

                await waitForSeek();
            }


            try {

                sourceVideo.muted = false;

                await sourceVideo.play();


                playBtn.textContent =
                    "⏸ Pause Preview";


                stageHint.hidden =
                    true;


                startPreviewLoop();

            } catch (error) {

                console.error(error);

                showError(
                    "Video tidak dapat diputar."
                );
            }

        } else {

            sourceVideo.pause();


            playBtn.textContent =
                "▶ Lihat Preview";


            renderFrame();
        }
    }
);


/* =========================================================
   VIDEO ENDED
========================================================= */

sourceVideo.addEventListener(
    "ended",
    () => {

        playBtn.textContent =
            "▶ Lihat Preview";


        renderFrame();
    }
);


/* =========================================================
   FFMPEG LOADER
========================================================= */

async function loadFFmpeg() {

    if (state.ffmpegLoaded) {

        return state.ffmpeg;
    }


    if (state.ffmpegLoading) {

        while (
            state.ffmpegLoading
        ) {

            await sleep(100);
        }


        return state.ffmpeg;
    }


    state.ffmpegLoading = true;


    try {

        progressText.textContent =
            "Menyiapkan mesin video...";


        progressPct.textContent =
            "0%";


        progressBar.style.width =
            "0%";


        /*
         * @ffmpeg/ffmpeg 0.12.x
         * exposes FFmpeg through:
         *
         * window.FFmpegWASM.FFmpeg
         */

        if (
            !window.FFmpegWASM ||
            !window.FFmpegWASM.FFmpeg
        ) {

            throw new Error(
                "FFmpeg wrapper tidak ditemukan. Pastikan ffmpeg/ffmpeg.js dimuat di index.html."
            );
        }


        const FFmpegClass =
            window.FFmpegWASM.FFmpeg;


        const ffmpeg =
            new FFmpegClass();


        ffmpeg.on(
            "log",
            ({ message }) => {

                console.log(
                    "[FFmpeg]",
                    message
                );
            }
        );


        ffmpeg.on(
            "progress",
            ({ progress }) => {

                if (!state.exporting) {
                    return;
                }


                const percent =
                    Math.round(
                        clamp(
                            progress,
                            0,
                            1
                        ) * 100
                    );


                /*
                 * FFmpeg stage = 50% → 100%
                 */

                const displayPercent =
                    50 +
                    Math.round(
                        percent / 2
                    );


                progressText.textContent =
                    "Mengubah video menjadi MP4...";


                progressPct.textContent =
                    `${displayPercent}%`;


                progressBar.style.width =
                    `${displayPercent}%`;
            }
        );


        /*
         * IMPORTANT:
         * Single-thread core.
         *
         * No classWorkerURL here.
         */

        await ffmpeg.load({

            coreURL:
                "ffmpeg/ffmpeg-core.js",

            wasmURL:
                "ffmpeg/ffmpeg-core.wasm"
        });


        state.ffmpeg =
            ffmpeg;


        state.ffmpegLoaded =
            true;


        progressText.textContent =
            "Mesin video siap.";


        return ffmpeg;

    } catch (error) {

        console.error(
            "FFmpeg load error:",
            error
        );


        throw error;

    } finally {

        state.ffmpegLoading =
            false;
    }
}


/* =========================================================
   AUDIO FALLBACK
========================================================= */

function getAudioTracks() {

    /*
     * First choice:
     * captureStream from video.
     */

    if (
        typeof sourceVideo.captureStream ===
        "function"
    ) {

        try {

            const capturedStream =
                sourceVideo.captureStream();


            const tracks =
                capturedStream.getAudioTracks();


            if (tracks.length > 0) {

                return tracks;
            }

        } catch (error) {

            console.warn(
                "captureStream audio gagal:",
                error
            );
        }
    }


    /*
     * Fallback:
     * Web Audio API.
     */

    try {

        const AudioContext =
            window.AudioContext ||
            window.webkitAudioContext;


        if (!AudioContext) {

            return [];
        }


        if (!state.audioContext) {

            state.audioContext =
                new AudioContext();


            state.audioSource =
                state.audioContext
                    .createMediaElementSource(
                        sourceVideo
                    );


            state.audioDestination =
                state.audioContext
                    .createMediaStreamDestination();


            /*
             * Keep audio audible during preview.
             */

            state.audioSource.connect(
                state.audioContext.destination
            );


            /*
             * Send audio to recorder.
             */

            state.audioSource.connect(
                state.audioDestination
            );
        }


        if (
            state.audioContext.state ===
            "suspended"
        ) {

            state.audioContext.resume();
        }


        return (
            state.audioDestination
                ?.stream
                ?.getAudioTracks() || []
        );

    } catch (error) {

        console.warn(
            "Web Audio fallback gagal:",
            error
        );


        return [];
    }
}


/* =========================================================
   DOWNLOAD BUTTON
========================================================= */

downloadBtn.addEventListener(
    "click",
    async () => {

        if (!state.videoReady) {
            return;
        }


        if (state.exporting) {
            return;
        }


        clearError();


        try {

            await exportVideo();

        } catch (error) {

            console.error(
                "Export error:",
                error
            );


            finishExport();


            showError(
                "Gagal memproses video. Silakan coba lagi."
            );
        }
    }
);


/* =========================================================
   EXPORT VIDEO
========================================================= */

async function exportVideo() {

    state.exporting = true;


    downloadBtn.disabled =
        true;

    resetBtn.disabled =
        true;

    zoomSlider.disabled =
        true;


    progressBox.hidden =
        false;


    downloadLink.hidden =
        true;


    progressText.textContent =
        "Menyiapkan video...";


    progressPct.textContent =
        "0%";


    progressBar.style.width =
        "0%";


    sourceVideo.pause();


    if (state.animationFrame) {

        cancelAnimationFrame(
            state.animationFrame
        );

        state.animationFrame =
            null;
    }


    sourceVideo.muted =
        false;

    sourceVideo.volume =
        1;


    sourceVideo.currentTime =
        0;


    await waitForSeek();


    renderFrame();


    /*
     * Canvas video stream.
     */

    const canvasStream =
        canvas.captureStream(30);


    /*
     * Get original audio.
     */

    let audioTracks =
        getAudioTracks();


    /*
     * Resume AudioContext if needed.
     */

    if (
        state.audioContext &&
        state.audioContext.state ===
        "suspended"
    ) {

        try {

            await state.audioContext.resume();

        } catch (error) {

            console.warn(
                "AudioContext resume gagal:",
                error
            );
        }
    }


    /*
     * Add audio tracks.
     */

    audioTracks.forEach(
        track => {

            try {

                canvasStream.addTrack(
                    track
                );

            } catch (error) {

                console.warn(
                    "Gagal menambahkan audio track:",
                    error
                );
            }
        }
    );


    /*
     * Temporary WebM format.
     */

    const mimeType =
        getSupportedMimeType();


    if (!mimeType) {

        cleanupStream(
            canvasStream
        );


        finishExport();


        showError(
            "Browser ini tidak mendukung perekaman video sementara."
        );


        return;
    }


    let recorder;


    try {

        recorder =
            new MediaRecorder(
                canvasStream,
                {
                    mimeType:
                        mimeType,

                    videoBitsPerSecond:
                        8_000_000
                }
            );

    } catch (error) {

        cleanupStream(
            canvasStream
        );


        finishExport();


        throw error;
    }


    const chunks = [];


    recorder.ondataavailable =
        event => {

            if (
                event.data &&
                event.data.size > 0
            ) {

                chunks.push(
                    event.data
                );
            }
        };


    recorder.onerror =
        event => {

            console.error(
                "MediaRecorder error:",
                event
            );


            if (state.exportTimer) {

                clearTimeout(
                    state.exportTimer
                );

                state.exportTimer =
                    null;
            }


            cleanupStream(
                canvasStream
            );


            finishExport();


            showError(
                "Terjadi kesalahan saat membuat video sementara."
            );
        };


    recorder.onstop =
        async () => {

            if (state.exportTimer) {

                clearTimeout(
                    state.exportTimer
                );

                state.exportTimer =
                    null;
            }


            cleanupStream(
                canvasStream
            );


            const temporaryBlob =
                new Blob(
                    chunks,
                    {
                        type:
                            mimeType
                    }
                );


            if (
                temporaryBlob.size === 0
            ) {

                finishExport();


                showError(
                    "Video sementara kosong."
                );


                return;
            }


            try {

                await convertToMP4(
                    temporaryBlob
                );

            } catch (error) {

                console.error(
                    "FFmpeg conversion error:",
                    error
                );


                finishExport();


                showError(
                    "Gagal mengubah video menjadi MP4."
                );
            }
        };


    /*
     * Start recording.
     */

    recorder.start(250);


    await sleep(300);


    try {

        sourceVideo.currentTime =
            0;


        await waitForSeek();


        await sourceVideo.play();

    } catch (error) {

        console.error(
            "Export playback error:",
            error
        );


        if (
            recorder.state !==
            "inactive"
        ) {

            recorder.stop();
        }


        finishExport();


        throw error;
    }


    startExportRenderLoop();


    const duration =
        sourceVideo.duration;


    const exportTime =
        Math.ceil(
            duration * 1000
        ) + 1200;


    state.exportTimer =
        setTimeout(
            () => {

                if (
                    recorder.state !==
                    "inactive"
                ) {

                    sourceVideo.pause();


                    renderFrame();


                    recorder.stop();
                }

            },
            exportTime
        );
}


/* =========================================================
   SUPPORTED TEMPORARY MIME
========================================================= */

function getSupportedMimeType() {

    const types = [

        "video/webm;codecs=vp9,opus",

        "video/webm;codecs=vp8,opus",

        "video/webm"
    ];


    for (const type of types) {

        if (
            MediaRecorder.isTypeSupported(
                type
            )
        ) {

            return type;
        }
    }


    return "";
}


/* =========================================================
   EXPORT RENDER LOOP
========================================================= */

function startExportRenderLoop() {

    function loop() {

        if (!state.exporting) {
            return;
        }


        renderFrame();


        updateProgress();


        state.animationFrame =
            requestAnimationFrame(
                loop
            );
    }


    loop();
}


/* =========================================================
   RECORDING PROGRESS
========================================================= */

function updateProgress() {

    const duration =
        sourceVideo.duration;


    const current =
        sourceVideo.currentTime;


    if (
        !Number.isFinite(duration) ||
        duration <= 0
    ) {

        return;
    }


    const percent =
        clamp(
            (
                current /
                duration
            ) * 100,
            0,
            100
        );


    /*
     * Recording stage:
     * 0% → 50%
     */

    const displayPercent =
        Math.round(
            percent * 0.5
        );


    progressBar.style.width =
        `${displayPercent}%`;


    progressPct.textContent =
        `${displayPercent}%`;


    progressText.textContent =
        "Membuat video sementara...";
}


/* =========================================================
   CONVERT WEBM → MP4
========================================================= */

async function convertToMP4(
    temporaryBlob
) {

    progressText.textContent =
        "Menyiapkan mesin MP4...";


    progressPct.textContent =
        "50%";


    progressBar.style.width =
        "50%";


    /*
     * Load FFmpeg.
     */

    const ffmpeg =
        await loadFFmpeg();


    /*
     * Blob → Uint8Array.
     */

    const inputBuffer =
        await temporaryBlob.arrayBuffer();


    const inputData =
        new Uint8Array(
            inputBuffer
        );


    /*
     * Write input.
     */

    await ffmpeg.writeFile(
        "input.webm",
        inputData
    );


    progressText.textContent =
        "Mengubah video menjadi MP4...";


    /*
     * Convert to MP4.
     *
     * H.264 video
     * AAC audio
     * YUV420P for compatibility
     * Faststart for sharing/playback
     */

    const exitCode =
        await ffmpeg.exec([

            "-i",
            "input.webm",

            "-c:v",
            "libx264",

            "-preset",
            "veryfast",

            "-crf",
            "23",

            "-pix_fmt",
            "yuv420p",

            "-c:a",
            "aac",

            "-b:a",
            "128k",

            "-movflags",
            "+faststart",

            "output.mp4"
        ]);


    if (exitCode !== 0) {

        throw new Error(
            `FFmpeg gagal. Exit code: ${exitCode}`
        );
    }


    /*
     * Read MP4.
     */

    const outputData =
        await ffmpeg.readFile(
            "output.mp4"
        );


    const outputBytes =
        outputData instanceof Uint8Array
            ? outputData
            : new Uint8Array(
                outputData
            );


    const mp4Blob =
        new Blob(
            [outputBytes],
            {
                type:
                    "video/mp4"
            }
        );


    if (
        mp4Blob.size === 0
    ) {

        throw new Error(
            "File MP4 kosong."
        );
    }


    /*
     * Cleanup FFmpeg filesystem.
     */

    try {

        await ffmpeg.deleteFile(
            "input.webm"
        );

    } catch (error) {}


    try {

        await ffmpeg.deleteFile(
            "output.mp4"
        );

    } catch (error) {}


    /*
     * Create download.
     */

    createDownloadLink(
        mp4Blob
    );


    finishExport();
}


/* =========================================================
   WAIT FOR SEEK
========================================================= */

function waitForSeek() {

    return new Promise(
        resolve => {

            if (
                sourceVideo.readyState >= 2 &&
                Math.abs(
                    sourceVideo.currentTime
                ) < 0.01
            ) {

                resolve();

                return;
            }


            let finished = false;


            const done = () => {

                if (finished) {
                    return;
                }


                finished = true;


                sourceVideo.removeEventListener(
                    "seeked",
                    done
                );


                resolve();
            };


            sourceVideo.addEventListener(
                "seeked",
                done
            );


            setTimeout(
                done,
                1500
            );
        }
    );
}


/* =========================================================
   CREATE DOWNLOAD LINK
========================================================= */

function createDownloadLink(
    blob
) {

    if (state.downloadURL) {

        URL.revokeObjectURL(
            state.downloadURL
        );
    }


    state.downloadURL =
        URL.createObjectURL(
            blob
        );


    downloadLink.href =
        state.downloadURL;


    downloadLink.download =
        "mustika-pradapati-video.mp4";


    downloadLink.textContent =
        "✅ Video MP4 selesai — klik untuk mengunduh";


    downloadLink.hidden =
        false;


    progressBar.style.width =
        "100%";


    progressPct.textContent =
        "100%";


    progressText.textContent =
        "Video MP4 selesai.";
}


/* =========================================================
   CLEANUP STREAM
========================================================= */

function cleanupStream(
    stream
) {

    if (!stream) {
        return;
    }


    stream.getTracks().forEach(
        track => {

            try {

                track.stop();

            } catch (error) {}
        }
    );
}


/* =========================================================
   FINISH EXPORT
========================================================= */

function finishExport() {

    state.exporting =
        false;


    downloadBtn.disabled =
        false;


    resetBtn.disabled =
        false;


    zoomSlider.disabled =
        false;


    if (state.exportTimer) {

        clearTimeout(
            state.exportTimer
        );

        state.exportTimer =
            null;
    }


    if (state.animationFrame) {

        cancelAnimationFrame(
            state.animationFrame
        );

        state.animationFrame =
            null;
    }


    sourceVideo.pause();


    playBtn.textContent =
        "▶ Lihat Preview";


    renderFrame();
}


/* =========================================================
   PAGE CLEANUP
========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        if (state.videoURL) {

            URL.revokeObjectURL(
                state.videoURL
            );
        }


        if (state.downloadURL) {

            URL.revokeObjectURL(
                state.downloadURL
            );
        }


        if (state.ffmpeg) {

            try {

                state.ffmpeg.terminate();

            } catch (error) {}
        }


        if (state.audioContext) {

            try {

                state.audioContext.close();

            } catch (error) {}
        }
    }
);


/* =========================================================
   INITIAL STATE
========================================================= */

editor.hidden = true;

downloadLink.hidden = true;

progressBox.hidden = true;

stage.style.cursor =
    "grab";

renderFrame();
