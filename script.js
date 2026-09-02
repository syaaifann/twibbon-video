// ============================================================
// MUSTIKA PRADAPATI KE-IV
// VIDEO TWIBBON EDITOR
//
// Preview  : Native HTML Video
// Export   : Canvas + MediaRecorder
// Format   : MP4 H.264/AAC -> WebM fallback
// ============================================================


// ============================================================
// DOM
// ============================================================

const videoInput = document.getElementById("videoInput");
const uploadCard = document.getElementById("uploadCard");
const editor = document.getElementById("editor");
const uploadError = document.getElementById("uploadError");

const stage = document.getElementById("stage");
const canvas = document.getElementById("previewCanvas");
const sourceVideo = document.getElementById("sourceVideo");

const stageHint = document.getElementById("stageHint");

const zoom = document.getElementById("zoom");
const zoomValue = document.getElementById("zoomValue");

const resetBtn = document.getElementById("resetBtn");
const playBtn = document.getElementById("playBtn");
const downloadBtn = document.getElementById("downloadBtn");

const progressBox = document.getElementById("progressBox");
const progressText = document.getElementById("progressText");
const progressPct = document.getElementById("progressPct");
const progressBar = document.getElementById("progressBar");

const downloadLink = document.getElementById("downloadLink");


// ============================================================
// KONFIGURASI
// ============================================================

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;

const OUTPUT_FPS = 30;

const MAX_DURATION = 30;

const VIDEO_BITRATE = 5_000_000;
const AUDIO_BITRATE = 128_000;


// ============================================================
// CANVAS
// ============================================================

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const ctx = canvas.getContext("2d", {
    alpha: false
});

ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";


// ============================================================
// STATE
// ============================================================

let videoURL = null;
let outputURL = null;

let overlayImage = null;

let zoomLevel = 1;

let positionX = 0;
let positionY = 0;

let isDragging = false;

let dragStartX = 0;
let dragStartY = 0;

let isExporting = false;

let recordAnimationFrame = null;

let currentFile = null;


// ============================================================
// TWIBBON
// ============================================================

overlayImage = new Image();

overlayImage.onload = () => {
    updatePreviewVideoStyle();
    drawExportCanvas();
};

overlayImage.onerror = () => {
    console.warn(
        "twibbon-overlay.png gagal dimuat."
    );
};

overlayImage.src = "assets/twibbon-overlay.png";


// ============================================================
// ERROR
// ============================================================

function showError(message) {
    uploadError.textContent = message;
    uploadError.hidden = false;
}

function hideError() {
    uploadError.textContent = "";
    uploadError.hidden = true;
}


// ============================================================
// PROGRESS
// ============================================================

function setProgress(percent, message) {
    const value = Math.max(
        0,
        Math.min(100, percent)
    );

    progressPct.textContent =
        `${Math.round(value)}%`;

    progressBar.style.width =
        `${value}%`;

    if (message) {
        progressText.textContent = message;
    }
}


// ============================================================
// CLEANUP URL
// ============================================================

function revokeVideoURL() {
    if (videoURL) {
        URL.revokeObjectURL(videoURL);
        videoURL = null;
    }
}

function revokeOutputURL() {
    if (outputURL) {
        URL.revokeObjectURL(outputURL);
        outputURL = null;
    }
}


// ============================================================
// PREVIEW VIDEO
//
// Canvas TIDAK dipakai untuk preview.
// Video asli langsung ditampilkan di stage.
// Ini menghindari kedip dan playback terlalu cepat.
// ============================================================

function setupNativePreview() {

    sourceVideo.hidden = false;

    sourceVideo.controls = false;

    sourceVideo.playsInline = true;

    sourceVideo.preload = "auto";

    sourceVideo.style.position = "absolute";
    sourceVideo.style.left = "50%";
    sourceVideo.style.top = "50%";

    sourceVideo.style.width = "100%";
    sourceVideo.style.height = "100%";

    sourceVideo.style.objectFit = "cover";

    sourceVideo.style.transformOrigin =
        "center center";

    sourceVideo.style.zIndex = "1";

    sourceVideo.style.display = "block";

    sourceVideo.style.pointerEvents = "none";

    // Canvas hanya digunakan untuk export.
    canvas.style.display = "none";

    // Pastikan stage menjadi container.
    stage.style.position = "relative";

    // Overlay dibuat satu kali.
    let previewOverlay =
        document.getElementById(
            "previewOverlay"
        );

    if (!previewOverlay) {

        previewOverlay =
            document.createElement("img");

        previewOverlay.id =
            "previewOverlay";

        previewOverlay.src =
            "assets/twibbon-overlay.png";

        previewOverlay.alt = "";

        previewOverlay.draggable = false;

        previewOverlay.style.position =
            "absolute";

        previewOverlay.style.inset = "0";

        previewOverlay.style.width =
            "100%";

        previewOverlay.style.height =
            "100%";

        previewOverlay.style.objectFit =
            "fill";

        previewOverlay.style.zIndex =
            "2";

        previewOverlay.style.pointerEvents =
            "none";

        stage.appendChild(previewOverlay);
    }
}


// ============================================================
// UPDATE POSISI VIDEO PREVIEW
// ============================================================

function updatePreviewVideoStyle() {

    if (!sourceVideo.videoWidth) {
        return;
    }

    const rect =
        stage.getBoundingClientRect();

    if (!rect.width || !rect.height) {
        return;
    }

    const cssX =
        positionX *
        (rect.width / CANVAS_WIDTH);

    const cssY =
        positionY *
        (rect.height / CANVAS_HEIGHT);

    sourceVideo.style.transform =
        `translate(-50%, -50%) ` +
        `translate(${cssX}px, ${cssY}px) ` +
        `scale(${zoomLevel})`;
}


// ============================================================
// HITUNG POSISI VIDEO UNTUK CANVAS
// ============================================================

function getVideoDrawRect() {

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

    // Cover 9:16.
    const scale =
        Math.max(
            CANVAS_WIDTH / videoWidth,
            CANVAS_HEIGHT / videoHeight
        );

    const width =
        videoWidth *
        scale *
        zoomLevel;

    const height =
        videoHeight *
        scale *
        zoomLevel;

    const x =
        (CANVAS_WIDTH - width) / 2 +
        positionX;

    const y =
        (CANVAS_HEIGHT - height) / 2 +
        positionY;

    return {
        x,
        y,
        width,
        height
    };
}


// ============================================================
// DRAW UNTUK EXPORT
// ============================================================

function drawExportCanvas() {

    if (
        !sourceVideo.videoWidth ||
        !sourceVideo.videoHeight
    ) {
        return;
    }

    const rect =
        getVideoDrawRect();

    if (!rect) {
        return;
    }

    // Background.
    ctx.fillStyle = "#000000";

    ctx.fillRect(
        0,
        0,
        CANVAS_WIDTH,
        CANVAS_HEIGHT
    );

    // Video.
    ctx.drawImage(
        sourceVideo,
        rect.x,
        rect.y,
        rect.width,
        rect.height
    );

    // Twibbon.
    if (
        overlayImage &&
        overlayImage.complete &&
        overlayImage.naturalWidth
    ) {

        ctx.drawImage(
            overlayImage,
            0,
            0,
            CANVAS_WIDTH,
            CANVAS_HEIGHT
        );
    }
}


// ============================================================
// VIDEO INPUT
// ============================================================

videoInput.addEventListener(
    "change",
    async () => {

        hideError();

        const file =
            videoInput.files &&
            videoInput.files[0];

        if (!file) {
            return;
        }

        if (
            !file.type ||
            !file.type.startsWith("video/")
        ) {

            showError(
                "File yang dipilih bukan video."
            );

            return;
        }

        // Bersihkan video sebelumnya.
        revokeVideoURL();

        // Bersihkan hasil sebelumnya.
        revokeOutputURL();

        downloadLink.hidden = true;
        downloadLink.removeAttribute("href");

        currentFile = file;

        videoURL =
            URL.createObjectURL(file);

        sourceVideo.pause();

        sourceVideo.removeAttribute(
            "src"
        );

        sourceVideo.load();

        sourceVideo.src =
            videoURL;

        sourceVideo.load();

        sourceVideo.onloadedmetadata =
            async () => {

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

                if (
                    duration >
                    MAX_DURATION
                ) {

                    showError(
                        `Video terlalu panjang. ` +
                        `Maksimal ${MAX_DURATION} detik.`
                    );

                    sourceVideo.pause();

                    revokeVideoURL();

                    sourceVideo.removeAttribute(
                        "src"
                    );

                    sourceVideo.load();

                    return;
                }

                // Reset posisi.
                positionX = 0;
                positionY = 0;

                zoomLevel = 1;

                zoom.value = "100";
                zoomValue.textContent =
                    "100%";

                setupNativePreview();

                uploadCard.hidden = true;
                editor.hidden = false;

                if (stageHint) {
                    stageHint.hidden = false;

                    setTimeout(() => {
                        stageHint.hidden = true;
                    }, 3000);
                }
            };
    }
);


// ============================================================
// VIDEO READY
// ============================================================

sourceVideo.addEventListener(
    "loadeddata",
    () => {

        updatePreviewVideoStyle();

        drawExportCanvas();
    }
);

sourceVideo.addEventListener(
    "loadedmetadata",
    () => {

        updatePreviewVideoStyle();
    }
);


// ============================================================
// RESIZE
// ============================================================

window.addEventListener(
    "resize",
    () => {

        updatePreviewVideoStyle();
    }
);


// ============================================================
// ZOOM
// ============================================================

zoom.addEventListener(
    "input",
    () => {

        zoomLevel =
            Number(zoom.value) / 100;

        zoomValue.textContent =
            `${zoom.value}%`;

        updatePreviewVideoStyle();

        drawExportCanvas();
    }
);


// ============================================================
// RESET
// ============================================================

resetBtn.addEventListener(
    "click",
    () => {

        if (isExporting) {
            return;
        }

        positionX = 0;
        positionY = 0;

        zoomLevel = 1;

        zoom.value = "100";

        zoomValue.textContent =
            "100%";

        updatePreviewVideoStyle();

        drawExportCanvas();
    }
);


// ============================================================
// DRAG
// ============================================================

function getPointerCanvasPosition(event) {

    const rect =
        stage.getBoundingClientRect();

    const x =
        (event.clientX - rect.left) *
        (CANVAS_WIDTH / rect.width);

    const y =
        (event.clientY - rect.top) *
        (CANVAS_HEIGHT / rect.height);

    return {
        x,
        y
    };
}


stage.addEventListener(
    "pointerdown",
    event => {

        if (isExporting) {
            return;
        }

        if (!sourceVideo.src) {
            return;
        }

        isDragging = true;

        stage.setPointerCapture(
            event.pointerId
        );

        const point =
            getPointerCanvasPosition(
                event
            );

        dragStartX =
            point.x - positionX;

        dragStartY =
            point.y - positionY;

        stage.classList.add(
            "dragging"
        );
    }
);


stage.addEventListener(
    "pointermove",
    event => {

        if (
            !isDragging ||
            isExporting
        ) {
            return;
        }

        const point =
            getPointerCanvasPosition(
                event
            );

        positionX =
            point.x - dragStartX;

        positionY =
            point.y - dragStartY;

        updatePreviewVideoStyle();

        drawExportCanvas();
    }
);


function stopDragging(event) {

    if (!isDragging) {
        return;
    }

    isDragging = false;

    stage.classList.remove(
        "dragging"
    );

    try {

        stage.releasePointerCapture(
            event.pointerId
        );

    } catch (error) {
        // Tidak masalah.
    }
}


stage.addEventListener(
    "pointerup",
    stopDragging
);

stage.addEventListener(
    "pointercancel",
    stopDragging
);


// ============================================================
// PREVIEW PLAY
//
// PENTING:
// Tidak ada requestAnimationFrame.
// Tidak ada requestVideoFrameCallback.
// Browser langsung menangani playback video.
// ============================================================

playBtn.addEventListener(
    "click",
    async () => {

        if (
            !sourceVideo.src ||
            isExporting
        ) {
            return;
        }

        hideError();

        try {

            if (
                sourceVideo.paused ||
                sourceVideo.ended
            ) {

                if (sourceVideo.ended) {
                    sourceVideo.currentTime = 0;
                }

                // Pastikan playback normal.
                sourceVideo.playbackRate = 1;
                sourceVideo.defaultPlaybackRate = 1;

                await sourceVideo.play();

                playBtn.textContent =
                    "⏸ Jeda Preview";

            } else {

                sourceVideo.pause();

                playBtn.textContent =
                    "▶ Lihat Preview";
            }

        } catch (error) {

            console.error(
                "Preview error:",
                error
            );

            showError(
                "Video tidak dapat diputar."
            );
        }
    }
);


sourceVideo.addEventListener(
    "ended",
    () => {

        playBtn.textContent =
            "▶ Lihat Preview";
    }
);


// ============================================================
// MIME TYPE
// ============================================================

function getSupportedFormats() {

    if (
        typeof MediaRecorder ===
        "undefined"
    ) {
        return [];
    }

    const candidates = [

        // ----------------------------------------------------
        // MP4 H.264 + AAC
        // ----------------------------------------------------

        {
            mime:
                'video/mp4;codecs="avc1.424028,mp4a.40.2"',
            extension:
                "mp4",
            label:
                "MP4 H.264 + AAC"
        },

        {
            mime:
                'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
            extension:
                "mp4",
            label:
                "MP4 H.264 + AAC"
        },

        {
            mime:
                'video/mp4;codecs="avc1.4D401E,mp4a.40.2"',
            extension:
                "mp4",
            label:
                "MP4 H.264 + AAC"
        },

        {
            mime:
                "video/mp4",
            extension:
                "mp4",
            label:
                "MP4"
        },

        // ----------------------------------------------------
        // WEBM
        // ----------------------------------------------------

        {
            mime:
                "video/webm;codecs=vp8,opus",
            extension:
                "webm",
            label:
                "WebM VP8 + Opus"
        },

        {
            mime:
                "video/webm;codecs=vp9,opus",
            extension:
                "webm",
            label:
                "WebM VP9 + Opus"
        },

        {
            mime:
                "video/webm",
            extension:
                "webm",
            label:
                "WebM"
        }
    ];

    return candidates.filter(
        format => {

            try {

                return MediaRecorder
                    .isTypeSupported(
                        format.mime
                    );

            } catch (error) {

                return false;
            }
        }
    );
}


// ============================================================
// AUDIO TRACK
// ============================================================

function getSourceAudioTrack() {

    try {

        let stream = null;

        if (
            typeof sourceVideo.captureStream ===
            "function"
        ) {

            stream =
                sourceVideo.captureStream();

        } else if (
            typeof sourceVideo.mozCaptureStream ===
            "function"
        ) {

            stream =
                sourceVideo.mozCaptureStream();
        }

        if (!stream) {
            return null;
        }

        const tracks =
            stream.getAudioTracks();

        if (!tracks.length) {
            return null;
        }

        return tracks[0];

    } catch (error) {

        console.warn(
            "Audio track tidak tersedia:",
            error
        );

        return null;
    }
}


// ============================================================
// EXPORT DRAW LOOP
//
// Hanya digunakan ketika recording.
// ============================================================

function startExportDrawLoop() {

    stopExportDrawLoop();

    const loop = () => {

        if (!isExporting) {
            return;
        }

        drawExportCanvas();

        recordAnimationFrame =
            requestAnimationFrame(loop);
    };

    recordAnimationFrame =
        requestAnimationFrame(loop);
}


function stopExportDrawLoop() {

    if (recordAnimationFrame) {

        cancelAnimationFrame(
            recordAnimationFrame
        );

        recordAnimationFrame = null;
    }
}


// ============================================================
// RECORD
// ============================================================

async function recordVideo(format) {

    return new Promise(
        async (resolve, reject) => {

            let canvasStream = null;
            let recorder = null;

            let chunks = [];

            let finished = false;

            let safetyTimer = null;

            let sourceEnded = false;

            function cleanup() {

                if (safetyTimer) {

                    clearTimeout(
                        safetyTimer
                    );

                    safetyTimer = null;
                }

                stopExportDrawLoop();

                if (canvasStream) {

                    canvasStream
                        .getTracks()
                        .forEach(
                            track => {

                                try {
                                    track.stop();
                                } catch (error) {
                                    // Abaikan.
                                }
                            }
                        );
                }

                sourceVideo.onended = null;

                try {
                    sourceVideo.pause();
                } catch (error) {
                    // Abaikan.
                }
            }


            function fail(error) {

                if (finished) {
                    return;
                }

                finished = true;

                cleanup();

                reject(error);
            }


            function finish() {

                if (finished) {
                    return;
                }

                finished = true;

                cleanup();

                const blob =
                    new Blob(
                        chunks,
                        {
                            type:
                                recorder.mimeType ||
                                format.mime
                        }
                    );

                if (!blob.size) {

                    reject(
                        new Error(
                            "File hasil recording kosong."
                        )
                    );

                    return;
                }

                resolve(blob);
            }


            try {

                // ------------------------------------------------
                // Canvas stream
                // ------------------------------------------------

                if (
                    typeof canvas.captureStream !==
                    "function"
                ) {

                    throw new Error(
                        "Browser tidak mendukung canvas recording."
                    );
                }

                canvasStream =
                    canvas.captureStream(
                        OUTPUT_FPS
                    );

                const videoTracks =
                    canvasStream.getVideoTracks();

                if (!videoTracks.length) {

                    throw new Error(
                        "Video canvas tidak tersedia."
                    );
                }


                // ------------------------------------------------
                // Audio
                // ------------------------------------------------

                const audioTrack =
                    getSourceAudioTrack();

                if (audioTrack) {

                    try {

                        canvasStream.addTrack(
                            audioTrack
                        );

                    } catch (error) {

                        console.warn(
                            "Audio tidak dapat ditambahkan:",
                            error
                        );
                    }
                }


                // ------------------------------------------------
                // MediaRecorder
                // ------------------------------------------------

                try {

                    recorder =
                        new MediaRecorder(
                            canvasStream,
                            {
                                mimeType:
                                    format.mime,

                                videoBitsPerSecond:
                                    VIDEO_BITRATE,

                                audioBitsPerSecond:
                                    AUDIO_BITRATE
                            }
                        );

                } catch (error) {

                    console.warn(
                        "Konfigurasi bitrate gagal. Mencoba konfigurasi sederhana."
                    );

                    recorder =
                        new MediaRecorder(
                            canvasStream,
                            {
                                mimeType:
                                    format.mime
                            }
                        );
                }


                // ------------------------------------------------
                // Data
                // ------------------------------------------------

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


                // ------------------------------------------------
                // Error
                // ------------------------------------------------

                recorder.onerror =
                    event => {

                        console.error(
                            "MediaRecorder error:",
                            event
                        );

                        fail(
                            new Error(
                                "Recorder mengalami error."
                            )
                        );
                    };


                // ------------------------------------------------
                // Stop
                // ------------------------------------------------

                recorder.onstop = () => {

                    finish();
                };


                // ------------------------------------------------
                // Video ended
                // ------------------------------------------------

                sourceVideo.onended =
                    () => {

                        sourceEnded = true;

                        // Gambar frame terakhir.
                        drawExportCanvas();

                        // Beri waktu recorder menerima
                        // frame terakhir.
                        setTimeout(
                            () => {

                                if (
                                    recorder &&
                                    recorder.state !==
                                    "inactive"
                                ) {

                                    try {

                                        recorder.stop();

                                    } catch (error) {

                                        fail(error);
                                    }
                                }

                            },
                            300
                        );
                    };


                // ------------------------------------------------
                // Persiapkan video
                // ------------------------------------------------

                sourceVideo.pause();

                sourceVideo.playbackRate = 1;
                sourceVideo.defaultPlaybackRate = 1;

                sourceVideo.currentTime = 0;

                await waitForSeek();


                // ------------------------------------------------
                // Draw awal
                // ------------------------------------------------

                drawExportCanvas();


                // ------------------------------------------------
                // START RECORDING
                // ------------------------------------------------

                recorder.start(1000);

                startExportDrawLoop();


                // ------------------------------------------------
                // PLAY VIDEO
                // ------------------------------------------------

                await sourceVideo.play();


                // ------------------------------------------------
                // SAFETY TIMER
                // ------------------------------------------------

                const duration =
                    Number.isFinite(
                        sourceVideo.duration
                    )
                        ? sourceVideo.duration
                        : MAX_DURATION;

                safetyTimer =
                    setTimeout(
                        () => {

                            if (
                                recorder &&
                                recorder.state !==
                                "inactive"
                            ) {

                                console.warn(
                                    "Safety timer menghentikan recording."
                                );

                                try {

                                    recorder.stop();

                                } catch (error) {

                                    fail(error);
                                }
                            }

                        },
                        Math.max(
                            10000,
                            (duration + 5) * 1000
                        )
                    );

            } catch (error) {

                fail(error);
            }
        }
    );
}


// ============================================================
// WAIT SEEK
// ============================================================

function waitForSeek() {

    return new Promise(
        resolve => {

            if (
                Math.abs(
                    sourceVideo.currentTime
                ) < 0.05
            ) {

                resolve();

                return;
            }

            let done = false;

            const finish = () => {

                if (done) {
                    return;
                }

                done = true;

                sourceVideo.removeEventListener(
                    "seeked",
                    finish
                );

                resolve();
            };

            sourceVideo.addEventListener(
                "seeked",
                finish
            );

            setTimeout(
                finish,
                1000
            );
        }
    );
}


// ============================================================
// VALIDASI DURASI OUTPUT
// ============================================================

function readBlobDuration(blob) {

    return new Promise(
        resolve => {

            const url =
                URL.createObjectURL(
                    blob
                );

            const video =
                document.createElement(
                    "video"
                );

            video.preload =
                "metadata";

            video.muted = true;

            video.playsInline = true;

            let completed = false;

            const timeout =
                setTimeout(
                    () => {

                        finish(null);

                    },
                    5000
                );


            function finish(duration) {

                if (completed) {
                    return;
                }

                completed = true;

                clearTimeout(
                    timeout
                );

                URL.revokeObjectURL(
                    url
                );

                video.removeAttribute(
                    "src"
                );

                try {
                    video.load();
                } catch (error) {
                    // Abaikan.
                }

                resolve(duration);
            }


            video.onloadedmetadata =
                () => {

                    const duration =
                        video.duration;

                    if (
                        Number.isFinite(
                            duration
                        ) &&
                        duration > 0
                    ) {

                        finish(duration);

                    } else {

                        finish(null);
                    }
                };


            video.onerror =
                () => {

                    finish(null);
                };


            video.src = url;
        }
    );
}


// ============================================================
// VALIDATE OUTPUT
// ============================================================

async function validateOutput(blob) {

    if (
        !blob ||
        blob.size < 1000
    ) {

        return {
            valid: false,
            duration: null
        };
    }

    const sourceDuration =
        sourceVideo.duration;

    if (
        !Number.isFinite(
            sourceDuration
        ) ||
        sourceDuration <= 0
    ) {

        return {
            valid: true,
            duration: null
        };
    }

    const outputDuration =
        await readBlobDuration(
            blob
        );

    // Kalau browser tidak bisa membaca
    // metadata duration, ukuran file tetap
    // digunakan sebagai indikator minimum.
    if (
        outputDuration === null
    ) {

        return {
            valid:
                blob.size > 50_000,

            duration: null
        };
    }

    const tolerance = 0.75;

    const valid =
        outputDuration >=
        Math.max(
            1,
            sourceDuration -
            tolerance
        );

    return {
        valid,
        duration: outputDuration
    };
}


// ============================================================
// DOWNLOAD LINK
// ============================================================

function prepareDownload(
    blob,
    format
) {

    revokeOutputURL();

    outputURL =
        URL.createObjectURL(
            blob
        );

    const filename =
        `mustika-pradapati-ke-IV.${format.extension}`;

    downloadLink.href =
        outputURL;

    downloadLink.download =
        filename;

    downloadLink.target =
        "_blank";

    downloadLink.rel =
        "noopener";

    downloadLink.textContent =
        `✅ Video selesai — ` +
        `Download ${format.extension.toUpperCase()}`;

    downloadLink.hidden = false;
}


// ============================================================
// EXPORT BUTTON
// ============================================================

downloadBtn.addEventListener(
    "click",
    async () => {

        if (isExporting) {
            return;
        }

        if (!sourceVideo.src) {

            showError(
                "Silakan pilih video terlebih dahulu."
            );

            return;
        }

        hideError();

        const formats =
            getSupportedFormats();

        if (!formats.length) {

            showError(
                "Browser ini tidak mendukung export video."
            );

            return;
        }

        // ----------------------------------------------------
        // UI
        // ----------------------------------------------------

        isExporting = true;

        downloadBtn.disabled = true;
        playBtn.disabled = true;
        resetBtn.disabled = true;

        downloadLink.hidden = true;

        progressBox.hidden = false;

        setProgress(
            0,
            "Menyiapkan video..."
        );


        let finalBlob = null;
        let finalFormat = null;


        try {

            // =================================================
            // CARI MP4
            // =================================================

            const mp4Format =
                formats.find(
                    format =>
                        format.extension ===
                        "mp4"
                );


            // =================================================
            // COBA MP4
            // =================================================

            if (mp4Format) {

                setProgress(
                    5,
                    "Menyiapkan MP4 H.264..."
                );

                await sleep(200);

                try {

                    // Reset video.
                    sourceVideo.pause();

                    sourceVideo.playbackRate =
                        1;

                    sourceVideo.currentTime =
                        0;

                    await waitForSeek();


                    setProgress(
                        10,
                        "Merekam video MP4..."
                    );


                    const blob =
                        await recordVideo(
                            mp4Format
                        );


                    setProgress(
                        80,
                        "Memeriksa durasi video..."
                    );


                    const validation =
                        await validateOutput(
                            blob
                        );


                    console.log(
                        "[Export] MP4:",
                        {
                            size:
                                blob.size,

                            duration:
                                validation.duration,

                            valid:
                                validation.valid
                        }
                    );


                    if (
                        validation.valid
                    ) {

                        finalBlob =
                            blob;

                        finalFormat =
                            mp4Format;

                    } else {

                        console.warn(
                            "MP4 tidak valid. Mencoba WebM."
                        );
                    }


                } catch (error) {

                    console.warn(
                        "MP4 gagal:",
                        error
                    );

                    finalBlob = null;
                    finalFormat = null;
                }
            }


            // =================================================
            // WEBM FALLBACK
            // =================================================

            if (!finalBlob) {

                const webmFormat =
                    formats.find(
                        format =>
                            format.extension ===
                            "webm"
                    );


                if (!webmFormat) {

                    throw new Error(
                        "MP4 gagal dan browser tidak mendukung WebM."
                    );
                }


                sourceVideo.pause();

                sourceVideo.playbackRate =
                    1;

                sourceVideo.currentTime =
                    0;

                await waitForSeek();


                setProgress(
                    10,
                    "Menggunakan format WebM..."
                );

                await sleep(300);


                setProgress(
                    15,
                    "Merekam video WebM..."
                );


                const blob =
                    await recordVideo(
                        webmFormat
                    );


                setProgress(
                    80,
                    "Memeriksa hasil video..."
                );


                const validation =
                    await validateOutput(
                        blob
                    );


                console.log(
                    "[Export] WebM:",
                    {
                        size:
                            blob.size,

                        duration:
                            validation.duration,

                        valid:
                            validation.valid
                    }
                );


                if (
                    !validation.valid
                ) {

                    throw new Error(
                        "Hasil video tidak memiliki durasi yang benar."
                    );
                }


                finalBlob =
                    blob;

                finalFormat =
                    webmFormat;
            }


            // =================================================
            // FINAL
            // =================================================

            if (
                !finalBlob ||
                !finalFormat
            ) {

                throw new Error(
                    "Video gagal dibuat."
                );
            }


            setProgress(
                95,
                "Menyiapkan file download..."
            );


            prepareDownload(
                finalBlob,
                finalFormat
            );


            setProgress(
                100,
                `Selesai — ` +
                `${finalFormat.extension.toUpperCase()}`
            );


            // Scroll sedikit supaya link
            // download terlihat di HP.
            setTimeout(
                () => {

                    downloadLink.scrollIntoView(
                        {
                            behavior:
                                "smooth",

                            block:
                                "center"
                        }
                    );

                },
                200
            );


        } catch (error) {

            console.error(
                "Export gagal:",
                error
            );

            progressBox.hidden = true;

            showError(
                error.message ||
                "Video gagal diproses. Silakan coba lagi."
            );


        } finally {

            isExporting = false;

            downloadBtn.disabled =
                false;

            playBtn.disabled =
                false;

            resetBtn.disabled =
                false;
        }
    }
);


// ============================================================
// DOWNLOAD LINK CLICK
// ============================================================

downloadLink.addEventListener(
    "click",
    event => {

        if (
            !downloadLink.href ||
            downloadLink.hidden
        ) {

            event.preventDefault();

            return;
        }

        // Jangan melakukan revoke di sini.
        // URL harus tetap hidup agar browser/HP
        // dapat menyelesaikan proses download.
    }
);


// ============================================================
// PAGE LEAVE
// ============================================================

window.addEventListener(
    "beforeunload",
    () => {

        revokeVideoURL();
        revokeOutputURL();
    }
);


// ============================================================
// INITIALIZATION
// ============================================================

setupNativePreview();

progressBox.hidden = true;

downloadLink.hidden = true;

console.log(
    "[Mustika Pradapati] Video editor aktif."
);

console.log(
    "[Mustika Pradapati] Supported formats:",
    getSupportedFormats()
);
