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


/* =========================================================
   TWIBBON LOADED
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

    sourceVideo.muted = false;

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
        !Number.isFinite(duration)
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

        sourceVideo.removeAttribute("src");

        sourceVideo.load();

        state.videoReady = false;

        return;
    }


    /*
        Reset posisi video.
    */

    state.zoom = 1;

    state.offsetX = 0;

    state.offsetY = 0;

    zoomSlider.value = 100;

    zoomValue.textContent = "100%";


    /*
        Tampilkan editor.
    */

    uploadCard.hidden = true;

    editor.hidden = false;

    stageHint.hidden = false;

    downloadLink.hidden = true;

    progressBox.hidden = true;


    /*
        Video siap.
    */

    state.videoReady = true;


    /*
        Render frame pertama.
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
   VIDEO DRAW DIMENSIONS
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
        Cover:
        video memenuhi canvas 9:16.
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
        Bersihkan canvas.
    */

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    /*
        Background hitam.
    */

    ctx.fillStyle = "#000";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    /*
        Gambar video.
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
        Gambar Twibbon di atas video.
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
   NORMAL PREVIEW LOOP
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
                requestAnimationFrame(loop);

        } else {

            state.animationFrame = null;
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
   POINTER DOWN
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
   POINTER MOVE
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
   STOP DRAG
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

        // Pointer sudah dilepas.
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
   PLAY / PAUSE PREVIEW
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

                await sourceVideo.play();

                playBtn.textContent =
                    "⏸ Pause Preview";

                stageHint.hidden = true;

                startPreviewLoop();

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
   AUDIO CAPTURE
========================================================= */

function setupAudioCapture() {

    if (!sourceVideo.src) {
        return null;
    }


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
            state.audioContext
                .createMediaStreamDestination();


        state.mediaSource =
            state.audioContext
                .createMediaElementSource(
                    sourceVideo
                );


        /*
            Audio hanya diarahkan ke stream
            untuk hasil export.

            Tidak diarahkan ke speaker,
            jadi tidak terjadi suara dobel.
        */

        state.mediaSource.connect(
            state.audioDestination
        );
    }


    return state.audioDestination.stream;
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
        UI progress.
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
        Hentikan preview.
    */

    sourceVideo.pause();


    if (state.animationFrame) {

        cancelAnimationFrame(
            state.animationFrame
        );

        state.animationFrame = null;
    }


    /*
        Pastikan video kembali ke awal.
    */

    sourceVideo.currentTime = 0;

    await waitForSeek();


    /*
        Render frame pertama.
    */

    renderFrame();


    /*
        Canvas stream 30 FPS.
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
            state.audioContext.state ===
                "suspended"
        ) {

            await state.audioContext.resume();
        }

    } catch (error) {

        console.warn(
            "Audio capture gagal:",
            error
        );

        audioStream = null;
    }


    /*
        Tambahkan audio track.
    */

    if (audioStream) {

        const audioTracks =
            audioStream.getAudioTracks();


        audioTracks.forEach(
            track => {

                canvasStream.addTrack(
                    track
                );
            }
        );
    }


    /*
        Format output.
    */

    const mimeType =
        getSupportedMimeType();


    if (!mimeType) {

        cleanupCanvasStream(
            canvasStream
        );

        finishExport();


        showError(
            "Browser ini tidak mendukung export video. Gunakan Chrome atau Edge terbaru."
        );

        return;
    }


    /*
        Buat MediaRecorder.
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

        cleanupCanvasStream(
            canvasStream
        );

        finishExport();


        showError(
            "Gagal membuat proses export video."
        );

        return;
    }


    const chunks = [];


    /* =====================================================
       DATA AVAILABLE
    ===================================================== */

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


    /* =====================================================
       ERROR
    ===================================================== */

    recorder.onerror =
        event => {

            console.error(
                "MediaRecorder error:",
                event
            );


            cleanupCanvasStream(
                canvasStream
            );


            finishExport();


            showError(
                "Terjadi kesalahan saat memproses video."
            );
        };


    /* =====================================================
       STOP
    ===================================================== */

    recorder.onstop =
        () => {

            const blob =
                new Blob(
                    chunks,
                    {
                        type: mimeType
                    }
                );


            cleanupCanvasStream(
                canvasStream
            );


            createDownloadLink(
                blob,
                mimeType
            );


            finishExport();
        };


    /*
        Mulai recorder TERLEBIH DAHULU.
    */

    recorder.start(250);


    /*
        Beri waktu sedikit agar recorder
        benar-benar aktif.
    */

    await sleep(100);


    /*
        Mulai video.
    */

    try {

        await sourceVideo.play();

    } catch (error) {

        console.error(
            "Play export gagal:",
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
            "Video tidak dapat diputar untuk proses export."
        );

        return;
    }


    /*
        Jalankan render loop.
    */

    exportRenderLoop(
        recorder
    );
}


/* =========================================================
   EXPORT RENDER LOOP
========================================================= */

function exportRenderLoop(
    recorder
) {

    /*
        Render frame terbaru.
    */

    renderFrame();


    /*
        Update progress.
    */

    updateProgress();


    /*
        Jika video benar-benar sudah selesai,
        baru hentikan recorder.
    */

    if (
        sourceVideo.ended
    ) {

        /*
            Render frame terakhir sekali lagi.
        */

        renderFrame();


        /*
            Beri waktu MediaRecorder mengambil
            frame terakhir.
        */

        setTimeout(
            () => {

                if (
                    recorder.state !==
                    "inactive"
                ) {

                    recorder.stop();
                }

            },
            500
        );


        return;
    }


    /*
        Lanjut render sampai video selesai.
    */

    state.animationFrame =
        requestAnimationFrame(
            () => {

                exportRenderLoop(
                    recorder
                );

            }
        );
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


    if (percent >= 99) {

        progressText.textContent =
            "Menyelesaikan video...";

    } else {

        progressText.textContent =
            "Memproses video...";
    }
}


/* =========================================================
   WAIT FOR SEEK
========================================================= */

function waitForSeek() {

    return new Promise(resolve => {

        /*
            Jika sudah di posisi 0 dan
            frame sudah tersedia.
        */

        if (
            sourceVideo.currentTime === 0 &&
            sourceVideo.readyState >= 2
        ) {

            resolve();

            return;
        }


        let finished = false;


        function done() {

            if (finished) {
                return;
            }

            finished = true;


            sourceVideo.removeEventListener(
                "seeked",
                done
            );


            resolve();
        }


        sourceVideo.addEventListener(
            "seeked",
            done
        );


        /*
            Safety fallback.
        */

        setTimeout(
            done,
            1000
        );
    });
}


/* =========================================================
   SLEEP
========================================================= */

function sleep(ms) {

    return new Promise(
        resolve => {
            setTimeout(
                resolve,
                ms
            );
        }
    );
}


/* =========================================================
   CLEANUP CANVAS STREAM
========================================================= */

function cleanupCanvasStream(
    stream
) {

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

    /*
        Hapus URL lama.
    */

    if (state.downloadURL) {

        URL.revokeObjectURL(
            state.downloadURL
        );
    }


    state.downloadURL =
        URL.createObjectURL(blob);


    /*
        Tentukan ekstensi.
    */

    const extension =
        mimeType.includes("mp4")
            ? "mp4"
            : "webm";


    /*
        Buat nama file.
    */

    const filename =
        `mustika-pradapati-video.${extension}`;


    downloadLink.href =
        state.downloadURL;


    downloadLink.download =
        filename;


    downloadLink.textContent =
        "✅ Video selesai — klik untuk mengunduh";


    downloadLink.hidden = false;


    /*
        Progress 100%.
    */

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


    if (state.animationFrame) {

        cancelAnimationFrame(
            state.animationFrame
        );

        state.animationFrame = null;
    }


    renderFrame();
}


/* =========================================================
   CLEANUP WHEN PAGE CLOSED
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
   INITIAL STATE
========================================================= */

editor.hidden = true;

downloadLink.hidden = true;

progressBox.hidden = true;

stage.style.cursor = "grab";

renderFrame();
