/* =========================================================
   MUSTIKA PRADAPATI KE-IV
   VIDEO TWIBBON EDITOR
========================================================= */

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

const twibbon = new Image();

twibbon.src = "assets/twibbon-overlay.png";


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

    audioContext: null,
    mediaSource: null,
    audioDestination: null
};


/* =========================================================
   CANVAS
========================================================= */

canvas.width = 1080;
canvas.height = 1920;

ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";


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
   TWIBBON
========================================================= */

twibbon.onload = () => {

    renderFrame();
};


/* =========================================================
   VIDEO INPUT
========================================================= */

videoInput.addEventListener(
    "change",
    () => {

        const file =
            videoInput.files?.[0];

        clearError();

        if (!file) {
            return;
        }


        if (
            !file.type.startsWith("video/")
        ) {

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

    /*
        Jangan mute video.
        Audio diperlukan saat export.
    */

    sourceVideo.muted = false;

    sourceVideo.volume = 1;

    sourceVideo.preload = "auto";

    sourceVideo.load();


    sourceVideo.addEventListener(
        "loadedmetadata",
        handleVideoMetadata,
        {
            once: true
        }
    );


    sourceVideo.addEventListener(
        "error",
        handleVideoError,
        {
            once: true
        }
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


    /*
        Maksimal 30 detik.
    */

    if (duration > 30) {

        showError(
            "Video maksimal 30 detik. Silakan pilih video yang lebih pendek."
        );

        sourceVideo.pause();

        sourceVideo.removeAttribute(
            "src"
        );

        sourceVideo.load();

        state.videoReady = false;

        return;
    }


    /*
        Reset editor.
    */

    state.zoom = 1;

    state.offsetX = 0;

    state.offsetY = 0;


    zoomSlider.value = 100;

    zoomValue.textContent =
        "100%";


    /*
        Tampilkan editor.
    */

    uploadCard.hidden = true;

    editor.hidden = false;

    stageHint.hidden = false;

    downloadLink.hidden = true;

    progressBox.hidden = true;


    state.videoReady = true;


    /*
        Pastikan berada di frame pertama.
    */

    sourceVideo.currentTime = 0;


    sourceVideo.addEventListener(
        "loadeddata",
        () => {

            renderFrame();

        },
        {
            once: true
        }
    );
}


/* =========================================================
   VIDEO DIMENSIONS
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


    /*
        Cover.
    */

    if (
        videoRatio > canvasRatio
    ) {

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


    /*
        Zoom.
    */

    drawWidth *= state.zoom;
    drawHeight *= state.zoom;


    return {
        width: drawWidth,
        height: drawHeight
    };
}


/* =========================================================
   RENDER FRAME
========================================================= */

function renderFrame() {

    /*
        Background.
    */

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    ctx.fillStyle = "#000";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    /*
        VIDEO
    */

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


    /*
        TWIBBON
    */

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

        if (state.exporting) {
            return;
        }


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
   DRAG - POINTER DOWN
========================================================= */

stage.addEventListener(
    "pointerdown",
    event => {

        if (!state.videoReady) {
            return;
        }


        if (state.exporting) {
            return;
        }


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
   DRAG - POINTER MOVE
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
   DRAG - STOP
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

    } catch (error) {

        // Tidak masalah.
    }


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
   PREVIEW PLAY / PAUSE
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

                /*
                    User interaction terjadi di sini,
                    sehingga browser HP mengizinkan audio.
                */

                sourceVideo.muted = false;

                await sourceVideo.play();


                playBtn.textContent =
                    "⏸ Pause Preview";


                stageHint.hidden = true;


                startPreviewLoop();

            } catch (error) {

                console.error(
                    error
                );


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
   MIME TYPE
========================================================= */

function getSupportedMimeType() {

    const types = [

        "video/webm;codecs=vp9,opus",

        "video/webm;codecs=vp8,opus",

        "video/webm",

        "video/mp4;codecs=avc1.42E01E,mp4a.40.2",

        "video/mp4"
    ];


    for (
        const type of types
    ) {

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
   AUDIO STREAM
========================================================= */

function getAudioStream() {

    /*
        Cara utama:
        ambil audio langsung dari video.
    */

    if (
        typeof sourceVideo.captureStream ===
        "function"
    ) {

        try {

            const videoStream =
                sourceVideo.captureStream();


            const audioTracks =
                videoStream.getAudioTracks();


            if (
                audioTracks.length > 0
            ) {

                const audioOnlyStream =
                    new MediaStream();


                audioTracks.forEach(
                    track => {

                        audioOnlyStream.addTrack(
                            track
                        );
                    }
                );


                return audioOnlyStream;
            }

        } catch (error) {

            console.warn(
                "captureStream audio gagal:",
                error
            );
        }
    }


    /*
        Fallback:
        AudioContext.
    */

    try {

        if (
            !state.audioContext
        ) {

            const AudioContext =
                window.AudioContext ||
                window.webkitAudioContext;


            if (!AudioContext) {
                return null;
            }


            state.audioContext =
                new AudioContext();


            state.audioDestination =
                state.audioContext
                    .createMediaStreamDestination();


            state.mediaSource =
                state.audioContext
                    .createMediaElementSource(
                        sourceVideo
                    );


            state.mediaSource.connect(
                state.audioDestination
            );
        }


        return state.audioDestination.stream;

    } catch (error) {

        console.warn(
            "AudioContext gagal:",
            error
        );


        return null;
    }
}


/* =========================================================
   DOWNLOAD
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


        await exportVideo();
    }
);


/* =========================================================
   EXPORT VIDEO
========================================================= */

async function exportVideo() {

    state.exporting = true;


    /*
        Disable controls.
    */

    downloadBtn.disabled = true;

    resetBtn.disabled = true;

    zoomSlider.disabled = true;


    /*
        UI.
    */

    progressBox.hidden = false;

    downloadLink.hidden = true;


    progressText.textContent =
        "Menyiapkan video...";


    progressPct.textContent =
        "0%";


    progressBar.style.width =
        "0%";


    /*
        Stop preview.
    */

    sourceVideo.pause();


    if (state.animationFrame) {

        cancelAnimationFrame(
            state.animationFrame
        );

        state.animationFrame = null;
    }


    /*
        Pastikan audio tidak mute.
    */

    sourceVideo.muted = false;

    sourceVideo.volume = 1;


    /*
        Reset ke awal.
    */

    sourceVideo.currentTime = 0;


    await waitForSeek();


    /*
        Render frame pertama.
    */

    renderFrame();


    /*
        Canvas stream.
    */

    const canvasStream =
        canvas.captureStream(30);


    /*
        Audio.
    */

    let audioStream =
        getAudioStream();


    /*
        Resume AudioContext jika diperlukan.
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
                "AudioContext resume gagal."
            );
        }
    }


    /*
        Tambahkan audio track.
    */

    if (audioStream) {

        const tracks =
            audioStream.getAudioTracks();


        tracks.forEach(
            track => {

                canvasStream.addTrack(
                    track
                );
            }
        );
    }


    /*
        MIME.
    */

    const mimeType =
        getSupportedMimeType();


    if (!mimeType) {

        cleanupStream(
            canvasStream
        );


        finishExport();


        showError(
            "Browser ini tidak mendukung export video."
        );


        return;
    }


    /*
        MediaRecorder.
    */

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


        showError(
            "Gagal membuat video."
        );


        return;
    }


    const chunks = [];


    /*
        Data.
    */

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


    /*
        Error.
    */

    recorder.onerror =
        event => {

            console.error(
                "MediaRecorder error:",
                event
            );


            if (
                state.exportTimer
            ) {

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
                "Terjadi kesalahan saat memproses video."
            );
        };


    /*
        Stop.
    */

    recorder.onstop =
        () => {

            if (
                state.exportTimer
            ) {

                clearTimeout(
                    state.exportTimer
                );

                state.exportTimer =
                    null;
            }


            const blob =
                new Blob(
                    chunks,
                    {
                        type: mimeType
                    }
                );


            cleanupStream(
                canvasStream
            );


            if (
                blob.size === 0
            ) {

                finishExport();


                showError(
                    "Video hasil export kosong. Silakan coba lagi."
                );


                return;
            }


            createDownloadLink(
                blob,
                mimeType
            );


            finishExport();
        };


    /*
        ============================================
        START RECORDING
        ============================================
    */

    recorder.start(250);


    /*
        Tunggu sebentar agar recorder benar-benar
        aktif sebelum video dimainkan.
    */

    await sleep(300);


    /*
        Mulai video.
    */

    try {

        sourceVideo.currentTime = 0;

        await waitForSeek();


        await sourceVideo.play();

    } catch (error) {

        console.error(
            "Export play error:",
            error
        );


        if (
            recorder.state !==
            "inactive"
        ) {

            recorder.stop();
        }


        finishExport();


        showError(
            "Video tidak dapat diputar untuk export."
        );


        return;
    }


    /*
        Render loop.
    */

    startExportRenderLoop();


    /*
        ============================================
        TIMER UTAMA
        ============================================

        Kita tidak mengandalkan currentTime
        untuk menghentikan recorder.

        Durasi asli video yang menentukan kapan
        recorder berhenti.
    */

    const duration =
        sourceVideo.duration;


    const exportTime =
        Math.ceil(
            duration * 1000
        ) + 1000;


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
   UPDATE PROGRESS
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


    progressBar.style.width =
        `${percent}%`;


    progressPct.textContent =
        `${Math.round(percent)}%`;


    progressText.textContent =
        percent >= 99
            ? "Menyelesaikan video..."
            : "Memproses video...";
}


/* =========================================================
   WAIT FOR SEEK
========================================================= */

function waitForSeek() {

    return new Promise(resolve => {

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
    });
}


/* =========================================================
   CLEANUP STREAM
========================================================= */

function cleanupStream(stream) {

    if (!stream) {
        return;
    }


    stream
        .getTracks()
        .forEach(
            track => {

                track.stop();
            }
        );
}


/* =========================================================
   CREATE DOWNLOAD LINK
========================================================= */

function createDownloadLink(
    blob,
    mimeType
) {

    if (state.downloadURL) {

        URL.revokeObjectURL(
            state.downloadURL
        );
    }


    state.downloadURL =
        URL.createObjectURL(blob);


    const extension =
        mimeType.includes("mp4")
            ? "mp4"
            : "webm";


    const filename =
        `mustika-pradapati-video.${extension}`;


    downloadLink.href =
        state.downloadURL;


    downloadLink.download =
        filename;


    downloadLink.textContent =
        "✅ Video selesai — klik untuk mengunduh";


    downloadLink.hidden = false;


    progressBar.style.width =
        "100%";


    progressPct.textContent =
        "100%";


    progressText.textContent =
        "Video selesai diproses.";
}


/* =========================================================
   FINISH EXPORT
========================================================= */

function finishExport() {

    state.exporting = false;


    downloadBtn.disabled = false;

    resetBtn.disabled = false;

    zoomSlider.disabled = false;


    if (
        state.exportTimer
    ) {

        clearTimeout(
            state.exportTimer
        );

        state.exportTimer = null;
    }


    if (state.animationFrame) {

        cancelAnimationFrame(
            state.animationFrame
        );

        state.animationFrame = null;
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


        if (state.audioContext) {

            state.audioContext.close();
        }
    }
);


/* =========================================================
   INITIAL UI
========================================================= */

editor.hidden = true;

downloadLink.hidden = true;

progressBox.hidden = true;

stage.style.cursor =
    "grab";


renderFrame();
