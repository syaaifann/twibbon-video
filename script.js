/* =========================================================
   MUSTIKA PRADAPATI KE-IV
   Video Twibbon Editor
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

    audioContext: null,
    mediaSource: null,
    audioDestination: null
};


/* =========================================================
   INITIAL CANVAS
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


function formatPercent(value) {
    return `${Math.round(value)}%`;
}


/* =========================================================
   LOAD TWIBBON
========================================================= */

twibbon.onload = () => {
    renderFrame();
};


/* =========================================================
   VIDEO INPUT
========================================================= */

videoInput.addEventListener("change", () => {

    const file = videoInput.files?.[0];

    clearError();

    if (!file) {
        return;
    }

    if (!file.type.startsWith("video/")) {
        showError("File yang dipilih bukan video.");
        videoInput.value = "";
        return;
    }

    loadVideo(file);
});


function loadVideo(file) {

    if (state.videoURL) {
        URL.revokeObjectURL(state.videoURL);
    }

    state.videoURL = URL.createObjectURL(file);

    sourceVideo.src = state.videoURL;

    sourceVideo.playsInline = true;

    sourceVideo.muted = true;

    sourceVideo.preload = "auto";

    sourceVideo.load();

    sourceVideo.addEventListener(
        "loadedmetadata",
        handleVideoMetadata,
        { once: true }
    );

    sourceVideo.addEventListener(
        "error",
        () => {
            showError(
                "Video tidak dapat dibaca oleh browser."
            );
        },
        { once: true }
    );
}


/* =========================================================
   VIDEO METADATA
========================================================= */

function handleVideoMetadata() {

    const duration = sourceVideo.duration;

    if (!Number.isFinite(duration)) {
        showError("Durasi video tidak dapat dibaca.");
        return;
    }

    if (duration > 30) {
        showError(
            "Video maksimal 30 detik. Silakan pilih video yang lebih pendek."
        );

        sourceVideo.removeAttribute("src");
        sourceVideo.load();

        return;
    }

    state.videoReady = true;

    state.zoom = 1;
    state.offsetX = 0;
    state.offsetY = 0;

    zoomSlider.value = 100;
    zoomValue.textContent = "100%";

    uploadCard.hidden = true;
    editor.hidden = false;

    stageHint.hidden = false;

    downloadLink.hidden = true;

    if (state.downloadURL) {
        URL.revokeObjectURL(state.downloadURL);
        state.downloadURL = null;
    }

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
   VIDEO → CANVAS
========================================================= */

function getVideoDrawDimensions() {

    const videoWidth = sourceVideo.videoWidth;
    const videoHeight = sourceVideo.videoHeight;

    if (
        !videoWidth ||
        !videoHeight
    ) {
        return null;
    }

    const canvasRatio =
        canvas.width / canvas.height;

    const videoRatio =
        videoWidth / videoHeight;

    let drawWidth;
    let drawHeight;

    /*
        Cover:
        Video memenuhi seluruh area 9:16.
    */

    if (videoRatio > canvasRatio) {

        drawHeight = canvas.height;

        drawWidth =
            drawHeight * videoRatio;

    } else {

        drawWidth = canvas.width;

        drawHeight =
            drawWidth / videoRatio;
    }

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

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    /*
        Background
    */

    ctx.fillStyle = "#000";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    /*
        Video
    */

    if (
        state.videoReady &&
        sourceVideo.readyState >= 2
    ) {

        const dimensions =
            getVideoDrawDimensions();

        if (dimensions) {

            const x =
                (canvas.width - dimensions.width) / 2
                + state.offsetX;

            const y =
                (canvas.height - dimensions.height) / 2
                + state.offsetY;

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
        Twibbon
    */

    if (twibbon.complete) {

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
   VIDEO FRAME LOOP
========================================================= */

function startRenderLoop() {

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
                requestAnimationFrame(loop);
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
            Number(zoomSlider.value) / 100;

        zoomValue.textContent =
            formatPercent(
                Number(zoomSlider.value)
            );

        renderFrame();
    }
);


/* =========================================================
   RESET
========================================================= */

resetBtn.addEventListener(
    "click",
    () => {

        state.zoom = 1;

        state.offsetX = 0;
        state.offsetY = 0;

        zoomSlider.value = 100;

        zoomValue.textContent = "100%";

        sourceVideo.currentTime = 0;

        stageHint.hidden = false;

        renderFrame();
    }
);


/* =========================================================
   POINTER DRAG
========================================================= */

stage.addEventListener(
    "pointerdown",
    (event) => {

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

        stage.style.cursor = "grabbing";
    }
);


stage.addEventListener(
    "pointermove",
    (event) => {

        if (!state.dragging) {
            return;
        }

        /*
            Konversi koordinat layar
            menjadi koordinat canvas.
        */

        const rect =
            stage.getBoundingClientRect();

        const scaleX =
            canvas.width / rect.width;

        const scaleY =
            canvas.height / rect.height;

        const deltaX =
            (event.clientX - state.dragStartX)
            * scaleX;

        const deltaY =
            (event.clientY - state.dragStartY)
            * scaleY;

        state.offsetX =
            state.startOffsetX + deltaX;

        state.offsetY =
            state.startOffsetY + deltaY;

        renderFrame();
    }
);


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
        // Tidak masalah jika pointer sudah dilepas.
    }

    stage.style.cursor = "grab";
}


stage.addEventListener(
    "pointerup",
    stopDragging
);

stage.addEventListener(
    "pointercancel",
    stopDragging
);

stage.addEventListener(
    "pointerleave",
    (event) => {

        if (
            state.dragging &&
            event.pointerType === "mouse"
        ) {
            stopDragging(event);
        }
    }
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

        if (sourceVideo.paused) {

            try {

                await sourceVideo.play();

                playBtn.textContent =
                    "⏸ Pause Preview";

                stageHint.hidden = true;

                startRenderLoop();

            } catch (error) {

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

        "video/mp4;codecs=avc1,mp4a.40.2",

        "video/mp4"
    ];

    for (const type of types) {

        if (
            MediaRecorder.isTypeSupported(type)
        ) {
            return type;
        }
    }

    return "";
}


/* =========================================================
   AUDIO CAPTURE
========================================================= */

function setupAudioCapture() {

    if (!sourceVideo.src) {
        return null;
    }

    /*
        AudioContext hanya dibuat sekali
        untuk element video ini.
    */

    if (!state.audioContext) {

        const AudioContext =
            window.AudioContext ||
            window.webkitAudioContext;

        if (!AudioContext) {
            return null;
        }

        state.audioContext =
            new AudioContext();

        state.audioDestination =
            state.audioContext.createMediaStreamDestination();

        state.mediaSource =
            state.audioContext.createMediaElementSource(
                sourceVideo
            );

        state.mediaSource.connect(
            state.audioDestination
        );
    }

    return state.audioDestination.stream;
}


/* =========================================================
   DOWNLOAD VIDEO
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

        await exportVideo();
    }
);


/* =========================================================
   EXPORT
========================================================= */

async function exportVideo() {

    state.exporting = true;

    downloadBtn.disabled = true;
    resetBtn.disabled = true;
    zoomSlider.disabled = true;

    progressBox.hidden = false;
    downloadLink.hidden = true;

    progressText.textContent =
        "Menyiapkan video...";

    progressPct.textContent =
        "0%";

    progressBar.style.width =
        "0%";


    /*
        Pastikan video berhenti
        sebelum export.
    */

    sourceVideo.pause();

    if (state.animationFrame) {

        cancelAnimationFrame(
            state.animationFrame
        );

        state.animationFrame = null;
    }


    /*
        Mulai dari awal.
    */

    sourceVideo.currentTime = 0;

    await waitForVideoSeek();


    /*
        Canvas stream.
    */

    const canvasStream =
        canvas.captureStream(30);


    /*
        Audio stream.
    */

    let audioStream = null;

    try {

        audioStream =
            setupAudioCapture();

        if (
            state.audioContext &&
            state.audioContext.state === "suspended"
        ) {
            await state.audioContext.resume();
        }

    } catch (error) {

        console.warn(
            "Audio capture tidak tersedia:",
            error
        );

        audioStream = null;
    }


    /*
        Gabungkan video + audio.
    */

    if (audioStream) {

        const audioTracks =
            audioStream.getAudioTracks();

        for (const track of audioTracks) {

            canvasStream.addTrack(track);
        }
    }


    const mimeType =
        getSupportedMimeType();


    if (!mimeType) {

        finishExport();

        showError(
            "Browser ini tidak mendukung perekaman video. Coba gunakan Chrome atau Edge terbaru."
        );

        return;
    }


    let recorder;

    try {

        recorder =
            new MediaRecorder(
                canvasStream,
                {
                    mimeType,
                    videoBitsPerSecond:
                        8_000_000
                }
            );

    } catch (error) {

        finishExport();

        showError(
            "Browser gagal membuat video hasil export."
        );

        return;
    }


    const chunks = [];


    recorder.ondataavailable =
        (event) => {

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
        () => {

            finishExport();

            showError(
                "Terjadi kesalahan ketika memproses video."
            );
        };


    recorder.onstop =
        () => {

            const blob =
                new Blob(
                    chunks,
                    {
                        type: mimeType
                    }
                );

            createDownloadLink(
                blob,
                mimeType
            );

            /*
                Bersihkan track canvas.
            */

            canvasStream
                .getTracks()
                .forEach(
                    track => track.stop()
                );

            finishExport();
        };


    /*
        Render + record.
    */

    recorder.start(
        250
    );


    sourceVideo.currentTime = 0;

    await waitForVideoSeek();


    try {

        await sourceVideo.play();

    } catch (error) {

        recorder.stop();

        finishExport();

        showError(
            "Video tidak dapat diputar untuk proses export."
        );

        return;
    }


    renderExportLoop(
        recorder
    );
}


/* =========================================================
   EXPORT LOOP
========================================================= */

function renderExportLoop(
    recorder
) {

    renderFrame();


    if (
        sourceVideo.ended ||
        sourceVideo.currentTime >=
        sourceVideo.duration
    ) {

        sourceVideo.pause();

        renderFrame();

        setTimeout(
            () => {

                if (
                    recorder.state !==
                    "inactive"
                ) {
                    recorder.stop();
                }

            },
            300
        );

        return;
    }


    updateProgress();


    requestAnimationFrame(
        () => renderExportLoop(
            recorder
        )
    );
}


/* =========================================================
   EXPORT PROGRESS
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
            (current / duration) * 100,
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
   WAIT VIDEO SEEK
========================================================= */

function waitForVideoSeek() {

    return new Promise(
        resolve => {

            if (
                Math.abs(
                    sourceVideo.currentTime
                ) < 0.01
            ) {
                resolve();
                return;
            }

            const handler = () => {

                sourceVideo.removeEventListener(
                    "seeked",
                    handler
                );

                resolve();
            };

            sourceVideo.addEventListener(
                "seeked",
                handler
            );

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


    downloadLink.href =
        state.downloadURL;


    downloadLink.download =
        `mustika-pradapati-video.${extension}`;


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

renderFrame();