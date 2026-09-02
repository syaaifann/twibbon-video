// ============================================================
// MUSTIKA PRADAPATI KE-IV
// Video Twibbon Editor
// Native MP4 -> Validasi -> WebM Fallback
// ============================================================

const videoInput = document.getElementById("videoInput");
const uploadCard = document.getElementById("uploadCard");
const editor = document.getElementById("editor");
const uploadError = document.getElementById("uploadError");

const stage = document.getElementById("stage");
const canvas = document.getElementById("previewCanvas");
const ctx = canvas.getContext("2d", {
    alpha: true,
    desynchronized: true
});

const sourceVideo = document.getElementById("sourceVideo");

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

const MAX_DURATION = 30;

// FPS canvas output.
// 30 FPS cukup untuk video portrait sosial media.
const OUTPUT_FPS = 30;

// Bitrate video.
// 5 Mbps cukup bagus untuk 1080x1920 tanpa terlalu
// membebani perangkat.
const VIDEO_BITRATE = 5_000_000;

// Bitrate audio.
const AUDIO_BITRATE = 128_000;


// ============================================================
// STATE
// ============================================================

let videoURL = null;
let overlayImage = null;

let zoomLevel = 1;

let positionX = 0;
let positionY = 0;

let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

let lastOutputURL = null;

let previewAnimationId = null;
let frameCallbackId = null;

let isRecording = false;


// ============================================================
// CANVAS
// ============================================================

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";


// ============================================================
// LOAD TWIBBON OVERLAY
// ============================================================

overlayImage = new Image();

overlayImage.onload = () => {
    drawCanvas();
};

overlayImage.onerror = () => {
    console.warn("Twibbon overlay gagal dimuat.");
};

overlayImage.src = "assets/twibbon-overlay.png";


// ============================================================
// UTILITAS
// ============================================================

function showError(message) {
    uploadError.textContent = message;
    uploadError.hidden = false;
}

function hideError() {
    uploadError.textContent = "";
    uploadError.hidden = true;
}

function setProgress(percent, text) {
    const safePercent = Math.max(0, Math.min(100, percent));

    progressPct.textContent = `${Math.round(safePercent)}%`;
    progressBar.style.width = `${safePercent}%`;

    if (text) {
        progressText.textContent = text;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function revokeOutputURL() {
    if (lastOutputURL) {
        URL.revokeObjectURL(lastOutputURL);
        lastOutputURL = null;
    }
}

function cleanupVideoURL() {
    if (videoURL) {
        URL.revokeObjectURL(videoURL);
        videoURL = null;
    }
}


// ============================================================
// CEK MIME TYPE
// ============================================================

function getSupportedRecordingFormats() {
    const formats = [
        // ----------------------------------------------------
        // PRIORITAS 1: MP4 H.264 + AAC
        // ----------------------------------------------------

        {
            mime: 'video/mp4;codecs="avc1.424028,mp4a.40.2"',
            extension: "mp4",
            label: "MP4 H.264 + AAC"
        },

        {
            mime: 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
            extension: "mp4",
            label: "MP4 H.264 + AAC"
        },

        {
            mime: 'video/mp4;codecs="avc1.4D401E,mp4a.40.2"',
            extension: "mp4",
            label: "MP4 H.264 + AAC"
        },

        {
            mime: "video/mp4",
            extension: "mp4",
            label: "MP4"
        },

        // ----------------------------------------------------
        // PRIORITAS 2: WebM
        // VP8 biasanya lebih ringan daripada VP9.
        // ----------------------------------------------------

        {
            mime: "video/webm;codecs=vp8,opus",
            extension: "webm",
            label: "WebM VP8 + Opus"
        },

        {
            mime: "video/webm;codecs=vp9,opus",
            extension: "webm",
            label: "WebM VP9 + Opus"
        },

        {
            mime: "video/webm",
            extension: "webm",
            label: "WebM"
        }
    ];

    if (typeof MediaRecorder === "undefined") {
        return [];
    }

    return formats.filter(format => {
        try {
            return MediaRecorder.isTypeSupported(format.mime);
        } catch (error) {
            return false;
        }
    });
}


// ============================================================
// PILIH FORMAT TERBAIK
// ============================================================

function getBestFormat() {
    const supported = getSupportedRecordingFormats();

    if (supported.length === 0) {
        return null;
    }

    return supported[0];
}


// ============================================================
// DRAW VIDEO + TWIBBON
// ============================================================

function drawCanvas() {
    if (!sourceVideo || sourceVideo.readyState < 2) {
        return;
    }

    const videoWidth = sourceVideo.videoWidth;
    const videoHeight = sourceVideo.videoHeight;

    if (!videoWidth || !videoHeight) {
        return;
    }

    // Bersihkan canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // --------------------------------------------------------
    // COVER
    // Video memenuhi seluruh canvas 1080x1920.
    // --------------------------------------------------------

    const scale = Math.max(
        CANVAS_WIDTH / videoWidth,
        CANVAS_HEIGHT / videoHeight
    );

    const baseWidth = videoWidth * scale;
    const baseHeight = videoHeight * scale;

    const finalWidth = baseWidth * zoomLevel;
    const finalHeight = baseHeight * zoomLevel;

    const x =
        (CANVAS_WIDTH - finalWidth) / 2 +
        positionX;

    const y =
        (CANVAS_HEIGHT - finalHeight) / 2 +
        positionY;

    // --------------------------------------------------------
    // VIDEO
    // --------------------------------------------------------

    ctx.drawImage(
        sourceVideo,
        x,
        y,
        finalWidth,
        finalHeight
    );

    // --------------------------------------------------------
    // TWIBBON
    // --------------------------------------------------------

    if (overlayImage && overlayImage.complete && overlayImage.naturalWidth) {
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
// PREVIEW LOOP
// ============================================================

function stopPreviewLoop() {
    if (previewAnimationId) {
        cancelAnimationFrame(previewAnimationId);
        previewAnimationId = null;
    }

    if (
        frameCallbackId &&
        typeof sourceVideo.cancelVideoFrameCallback === "function"
    ) {
        try {
            sourceVideo.cancelVideoFrameCallback(frameCallbackId);
        } catch (error) {
            // Abaikan
        }
    }

    frameCallbackId = null;
}

function startPreviewLoop() {
    stopPreviewLoop();

    // Browser modern: mengikuti frame video secara langsung.
    if (typeof sourceVideo.requestVideoFrameCallback === "function") {

        const renderFrame = () => {
            drawCanvas();

            if (!sourceVideo.paused && !sourceVideo.ended) {
                frameCallbackId =
                    sourceVideo.requestVideoFrameCallback(renderFrame);
            }
        };

        frameCallbackId =
            sourceVideo.requestVideoFrameCallback(renderFrame);

        return;
    }

    // Fallback browser lama.
    const renderFallback = () => {
        drawCanvas();

        if (!sourceVideo.paused && !sourceVideo.ended) {
            previewAnimationId =
                requestAnimationFrame(renderFallback);
        }
    };

    previewAnimationId =
        requestAnimationFrame(renderFallback);
}


// ============================================================
// VIDEO INPUT
// ============================================================

videoInput.addEventListener("change", async () => {
    hideError();

    const file = videoInput.files && videoInput.files[0];

    if (!file) {
        return;
    }

    if (!file.type.startsWith("video/")) {
        showError("File yang dipilih bukan video.");
        return;
    }

    // Bersihkan URL sebelumnya.
    cleanupVideoURL();

    // Bersihkan output lama.
    revokeOutputURL();

    downloadLink.hidden = true;
    downloadLink.removeAttribute("href");

    // Buat URL video.
    videoURL = URL.createObjectURL(file);

    sourceVideo.pause();
    sourceVideo.src = videoURL;
    sourceVideo.load();

    sourceVideo.onloadedmetadata = () => {
        const duration = sourceVideo.duration;

        if (!Number.isFinite(duration)) {
            showError(
                "Durasi video tidak dapat dibaca. Silakan pilih video lain."
            );

            cleanupVideoURL();
            return;
        }

        if (duration > MAX_DURATION) {
            showError(
                `Video terlalu panjang. Maksimal ${MAX_DURATION} detik.`
            );

            cleanupVideoURL();
            sourceVideo.removeAttribute("src");
            sourceVideo.load();

            return;
        }

        if (duration <= 0) {
            showError(
                "Durasi video tidak valid."
            );

            cleanupVideoURL();
            return;
        }

        // Reset posisi.
        positionX = 0;
        positionY = 0;
        zoomLevel = 1;

        zoom.value = "100";
        zoomValue.textContent = "100%";

        uploadCard.hidden = true;
        editor.hidden = false;

        stageHintShow();

        sourceVideo.currentTime = 0;

        sourceVideo.onloadeddata = () => {
            drawCanvas();
        };
    };
});


// ============================================================
// STAGE HINT
// ============================================================

function stageHintShow() {
    const hint = document.getElementById("stageHint");

    if (!hint) {
        return;
    }

    hint.hidden = false;

    setTimeout(() => {
        hint.hidden = true;
    }, 3500);
}


// ============================================================
// ZOOM
// ============================================================

zoom.addEventListener("input", () => {
    zoomLevel = Number(zoom.value) / 100;

    zoomValue.textContent = `${zoom.value}%`;

    drawCanvas();
});


// ============================================================
// RESET
// ============================================================

resetBtn.addEventListener("click", () => {
    positionX = 0;
    positionY = 0;

    zoomLevel = 1;

    zoom.value = "100";
    zoomValue.textContent = "100%";

    drawCanvas();
});


// ============================================================
// DRAG VIDEO
// ============================================================

function getPointerPosition(event) {
    const rect = stage.getBoundingClientRect();

    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    return {
        x: event.clientX * scaleX,
        y: event.clientY * scaleY
    };
}

stage.addEventListener("pointerdown", event => {
    if (isRecording) {
        return;
    }

    isDragging = true;

    stage.setPointerCapture(event.pointerId);

    const point = getPointerPosition(event);

    dragStartX = point.x - positionX;
    dragStartY = point.y - positionY;

    stage.classList.add("dragging");
});

stage.addEventListener("pointermove", event => {
    if (!isDragging || isRecording) {
        return;
    }

    const point = getPointerPosition(event);

    positionX = point.x - dragStartX;
    positionY = point.y - dragStartY;

    drawCanvas();
});

function stopDragging(event) {
    if (!isDragging) {
        return;
    }

    isDragging = false;

    stage.classList.remove("dragging");

    try {
        if (event.pointerId !== undefined) {
            stage.releasePointerCapture(event.pointerId);
        }
    } catch (error) {
        // Abaikan
    }
}

stage.addEventListener("pointerup", stopDragging);
stage.addEventListener("pointercancel", stopDragging);
stage.addEventListener("pointerleave", event => {
    // Jangan langsung menghentikan drag di sini karena
    // pointer capture menangani drag di luar area.
});


// ============================================================
// PLAY / PAUSE PREVIEW
// ============================================================

playBtn.addEventListener("click", async () => {
    hideError();

    if (!sourceVideo.src) {
        return;
    }

    try {
        if (sourceVideo.paused || sourceVideo.ended) {

            if (sourceVideo.ended) {
                sourceVideo.currentTime = 0;
            }

            await sourceVideo.play();

            playBtn.textContent = "⏸ Jeda Preview";

            startPreviewLoop();

        } else {

            sourceVideo.pause();

            stopPreviewLoop();

            playBtn.textContent = "▶ Lihat Preview";

            drawCanvas();
        }

    } catch (error) {
        console.error(error);

        showError(
            "Preview tidak dapat diputar. Silakan coba lagi."
        );
    }
});

sourceVideo.addEventListener("ended", () => {
    stopPreviewLoop();

    playBtn.textContent = "▶ Lihat Preview";

    drawCanvas();
});


// ============================================================
// CAPTURE AUDIO
// ============================================================

function getAudioTrack() {
    try {
        let mediaStream = null;

        if (typeof sourceVideo.captureStream === "function") {
            mediaStream = sourceVideo.captureStream();
        } else if (
            typeof sourceVideo.mozCaptureStream === "function"
        ) {
            mediaStream = sourceVideo.mozCaptureStream();
        }

        if (!mediaStream) {
            return null;
        }

        const audioTracks = mediaStream.getAudioTracks();

        if (!audioTracks.length) {
            return null;
        }

        return audioTracks[0];

    } catch (error) {
        console.warn(
            "Audio track tidak dapat diambil:",
            error
        );

        return null;
    }
}


// ============================================================
// RECORD CANVAS
// ============================================================

async function recordCanvas(format) {
    return new Promise(async (resolve, reject) => {

        let canvasStream = null;
        let recorder = null;

        const chunks = [];

        let stopped = false;
        let safetyTimer = null;
        let watchdogTimer = null;

        const sourceDuration =
            Number.isFinite(sourceVideo.duration)
                ? sourceVideo.duration
                : 0;

        function cleanup() {
            if (safetyTimer) {
                clearTimeout(safetyTimer);
                safetyTimer = null;
            }

            if (watchdogTimer) {
                clearTimeout(watchdogTimer);
                watchdogTimer = null;
            }

            stopPreviewLoop();

            if (canvasStream) {
                canvasStream.getTracks().forEach(track => {
                    try {
                        track.stop();
                    } catch (error) {
                        // Abaikan
                    }
                });
            }

            try {
                sourceVideo.pause();
            } catch (error) {
                // Abaikan
            }

            sourceVideo.onended = null;
        }

        function fail(error) {
            if (stopped) {
                return;
            }

            stopped = true;

            cleanup();

            reject(error);
        }

        function finish() {
            if (stopped) {
                return;
            }

            stopped = true;

            cleanup();

            const blob = new Blob(chunks, {
                type: format.mime
            });

            if (!blob.size) {
                reject(
                    new Error("Hasil video kosong.")
                );
                return;
            }

            resolve(blob);
        }

        try {
            // ------------------------------------------------
            // Canvas stream
            // ------------------------------------------------

            canvasStream =
                canvas.captureStream(OUTPUT_FPS);

            const videoTracks =
                canvasStream.getVideoTracks();

            if (!videoTracks.length) {
                throw new Error(
                    "Browser tidak dapat mengambil video dari canvas."
                );
            }

            // ------------------------------------------------
            // Audio
            // ------------------------------------------------

            const audioTrack = getAudioTrack();

            if (audioTrack) {
                try {
                    canvasStream.addTrack(audioTrack);
                } catch (error) {
                    console.warn(
                        "Audio track gagal ditambahkan:",
                        error
                    );
                }
            }

            // ------------------------------------------------
            // Recorder options
            // ------------------------------------------------

            const recorderOptions = {
                mimeType: format.mime,
                videoBitsPerSecond: VIDEO_BITRATE,
                audioBitsPerSecond: AUDIO_BITRATE
            };

            try {
                recorder = new MediaRecorder(
                    canvasStream,
                    recorderOptions
                );
            } catch (error) {

                // Beberapa browser tidak menerima bitrate
                // tertentu walaupun MIME-nya didukung.
                console.warn(
                    "MediaRecorder dengan bitrate gagal, mencoba konfigurasi sederhana."
                );

                try {
                    recorder = new MediaRecorder(
                        canvasStream,
                        {
                            mimeType: format.mime
                        }
                    );
                } catch (secondError) {
                    fail(secondError);
                    return;
                }
            }

            recorder.ondataavailable = event => {
                if (event.data && event.data.size > 0) {
                    chunks.push(event.data);
                }
            };

            recorder.onerror = event => {
                console.error(
                    "MediaRecorder error:",
                    event
                );

                fail(
                    new Error(
                        "Recorder mengalami masalah saat merekam."
                    )
                );
            };

            recorder.onstop = () => {
                finish();
            };

            sourceVideo.onended = () => {

                // Pastikan frame terakhir sempat digambar.
                drawCanvas();

                // Tunggu sebentar supaya frame terakhir
                // masuk ke MediaRecorder.
                setTimeout(() => {
                    if (
                        recorder &&
                        recorder.state !== "inactive"
                    ) {
                        try {
                            recorder.stop();
                        } catch (error) {
                            fail(error);
                        }
                    }
                }, 250);
            };

            // ------------------------------------------------
            // Mulai recording
            // ------------------------------------------------

            drawCanvas();

            if (sourceVideo.readyState < 2) {
                await new Promise((resolveReady, rejectReady) => {

                    const timeout = setTimeout(() => {
                        rejectReady(
                            new Error(
                                "Video terlalu lama untuk dipersiapkan."
                            )
                        );
                    }, 10000);

                    const readyHandler = () => {
                        clearTimeout(timeout);

                        sourceVideo.removeEventListener(
                            "loadeddata",
                            readyHandler
                        );

                        resolveReady();
                    };

                    sourceVideo.addEventListener(
                        "loadeddata",
                        readyHandler
                    );
                });
            }

            // Mulai recorder.
            recorder.start(1000);

            isRecording = true;

            // Mulai render.
            startPreviewLoop();

            // Pastikan video mulai dari awal.
            sourceVideo.currentTime = 0;

            await sourceVideo.play();

            // ------------------------------------------------
            // Watchdog
            // ------------------------------------------------
            // Kalau somehow "ended" tidak terpanggil,
            // recorder tetap akan dihentikan setelah durasi
            // video + buffer.
            // ------------------------------------------------

            const watchdogDuration =
                Math.max(
                    5000,
                    (sourceDuration + 3) * 1000
                );

            watchdogTimer = setTimeout(() => {

                if (
                    recorder &&
                    recorder.state !== "inactive"
                ) {
                    console.warn(
                        "Watchdog menghentikan recorder."
                    );

                    try {
                        recorder.stop();
                    } catch (error) {
                        fail(error);
                    }
                }

            }, watchdogDuration);

            // Safety timer ekstra.
            safetyTimer = setTimeout(() => {

                if (
                    recorder &&
                    recorder.state !== "inactive"
                ) {
                    console.warn(
                        "Safety timer menghentikan recorder."
                    );

                    try {
                        recorder.stop();
                    } catch (error) {
                        fail(error);
                    }
                }

            }, Math.max(35000, (MAX_DURATION + 5) * 1000));

        } catch (error) {
            fail(error);
        }
    });
}


// ============================================================
// CEK DURASI BLOB
// ============================================================

async function getBlobDuration(blob) {
    return new Promise(resolve => {

        const url = URL.createObjectURL(blob);

        const video = document.createElement("video");

        video.preload = "metadata";
        video.muted = true;
        video.playsInline = true;

        let finished = false;

        const finish = duration => {
            if (finished) {
                return;
            }

            finished = true;

            clearTimeout(timeout);

            URL.revokeObjectURL(url);

            video.removeAttribute("src");

            try {
                video.load();
            } catch (error) {
                // Abaikan
            }

            resolve(duration);
        };

        video.onloadedmetadata = () => {
            const duration = video.duration;

            if (
                Number.isFinite(duration) &&
                duration > 0
            ) {
                finish(duration);
            } else {
                finish(null);
            }
        };

        video.onerror = () => {
            finish(null);
        };

        // Beberapa WebM browser bisa lama membaca metadata.
        const timeout = setTimeout(() => {
            finish(null);
        }, 5000);

        video.src = url;
    });
}


// ============================================================
// VALIDASI HASIL
// ============================================================

async function validateOutput(blob) {

    const sourceDuration =
        Number.isFinite(sourceVideo.duration)
            ? sourceVideo.duration
            : 0;

    if (!sourceDuration) {
        return {
            valid: true,
            duration: null
        };
    }

    const outputDuration =
        await getBlobDuration(blob);

    // Kalau metadata tidak bisa dibaca, jangan langsung
    // dianggap rusak. WebM pada beberapa browser bisa
    // tidak memberikan duration metadata dengan sempurna.
    if (outputDuration === null) {
        return {
            valid: blob.size > 50_000,
            duration: null
        };
    }

    // Toleransi 0.75 detik.
    const tolerance = 0.75;

    const valid =
        outputDuration >=
        Math.max(1, sourceDuration - tolerance);

    return {
        valid,
        duration: outputDuration
    };
}


// ============================================================
// DOWNLOAD
// ============================================================

function createDownload(blob, format) {

    revokeOutputURL();

    lastOutputURL =
        URL.createObjectURL(blob);

    const filename =
        `mustika-pradapati-ke-IV.${format.extension}`;

    downloadLink.href = lastOutputURL;
    downloadLink.download = filename;

    downloadLink.textContent =
        `✅ Video selesai — Download ${format.extension.toUpperCase()}`;

    downloadLink.hidden = false;

    // Download otomatis.
    const temporaryLink =
        document.createElement("a");

    temporaryLink.href = lastOutputURL;
    temporaryLink.download = filename;

    document.body.appendChild(temporaryLink);

    temporaryLink.click();

    temporaryLink.remove();
}


// ============================================================
// EXPORT
// ============================================================

downloadBtn.addEventListener("click", async () => {

    if (isRecording) {
        return;
    }

    hideError();

    if (!sourceVideo.src) {
        showError(
            "Silakan pilih video terlebih dahulu."
        );
        return;
    }

    const formats =
        getSupportedRecordingFormats();

    if (!formats.length) {
        showError(
            "Browser ini tidak mendukung perekaman video dari canvas."
        );
        return;
    }

    // --------------------------------------------------------
    // Pastikan video kembali ke awal.
    // --------------------------------------------------------

    try {
        sourceVideo.pause();
        stopPreviewLoop();

        sourceVideo.currentTime = 0;

        await new Promise(resolve => {

            if (sourceVideo.readyState >= 2) {
                resolve();
                return;
            }

            const handler = () => {
                sourceVideo.removeEventListener(
                    "loadeddata",
                    handler
                );

                resolve();
            };

            sourceVideo.addEventListener(
                "loadeddata",
                handler
            );
        });

    } catch (error) {
        console.warn(
            "Gagal reset video:",
            error
        );
    }

    // --------------------------------------------------------
    // UI
    // --------------------------------------------------------

    downloadBtn.disabled = true;
    playBtn.disabled = true;
    resetBtn.disabled = true;

    progressBox.hidden = false;

    downloadLink.hidden = true;

    isRecording = true;

    let finalBlob = null;
    let finalFormat = null;

    try {

        // ====================================================
        // ATTEMPT 1
        // MP4 jika tersedia
        // ====================================================

        const mp4Format =
            formats.find(format =>
                format.extension === "mp4"
            );

        if (mp4Format) {

            setProgress(
                5,
                "Menyiapkan MP4 H.264..."
            );

            await sleep(150);

            try {

                setProgress(
                    10,
                    "Merekam video MP4..."
                );

                const blob =
                    await recordCanvas(mp4Format);

                isRecording = false;

                setProgress(
                    85,
                    "Memeriksa hasil video..."
                );

                const validation =
                    await validateOutput(blob);

                if (validation.valid) {

                    finalBlob = blob;
                    finalFormat = mp4Format;

                    setProgress(
                        100,
                        "MP4 berhasil dibuat."
                    );

                } else {

                    console.warn(
                        "MP4 menghasilkan durasi tidak valid:",
                        validation.duration
                    );

                    finalBlob = null;
                    finalFormat = null;
                }

            } catch (error) {

                console.warn(
                    "Perekaman MP4 gagal:",
                    error
                );

                finalBlob = null;
                finalFormat = null;
            }
        }

        // ====================================================
        // ATTEMPT 2
        // WEBM FALLBACK
        // ====================================================

        if (!finalBlob) {

            const webmFormat =
                formats.find(format =>
                    format.extension === "webm"
                );

            if (!webmFormat) {
                throw new Error(
                    "MP4 gagal dan WebM tidak tersedia."
                );
            }

            isRecording = false;

            // Reset video.
            sourceVideo.pause();
            stopPreviewLoop();

            try {
                sourceVideo.currentTime = 0;

                await new Promise(resolve => {

                    if (
                        sourceVideo.readyState >= 2 &&
                        sourceVideo.currentTime === 0
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
                        handler,
                        {
                            once: true
                        }
                    );

                    setTimeout(resolve, 1000);
                });

            } catch (error) {
                console.warn(
                    "Reset sebelum fallback gagal:",
                    error
                );
            }

            setProgress(
                10,
                "MP4 tidak cocok di perangkat ini."
            );

            await sleep(300);

            setProgress(
                15,
                "Menggunakan WebM sebagai fallback..."
            );

            await sleep(300);

            try {

                setProgress(
                    20,
                    "Merekam WebM..."
                );

                const blob =
                    await recordCanvas(webmFormat);

                isRecording = false;

                setProgress(
                    85,
                    "Memeriksa hasil video..."
                );

                const validation =
                    await validateOutput(blob);

                if (!validation.valid) {
                    throw new Error(
                        "Video WebM menghasilkan durasi yang tidak valid."
                    );
                }

                finalBlob = blob;
                finalFormat = webmFormat;

                setProgress(
                    100,
                    "WebM berhasil dibuat."
                );

            } catch (error) {

                console.error(
                    "Fallback WebM gagal:",
                    error
                );

                throw new Error(
                    "Video gagal diproses. Silakan coba lagi."
                );
            }
        }

        // ====================================================
        // DOWNLOAD
        // ====================================================

        if (!finalBlob || !finalFormat) {
            throw new Error(
                "Tidak ada hasil video yang dapat digunakan."
            );
        }

        setProgress(
            100,
            `Selesai — format ${finalFormat.extension.toUpperCase()}`
        );

        createDownload(
            finalBlob,
            finalFormat
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

        isRecording = false;

        downloadBtn.disabled = false;
        playBtn.disabled = false;
        resetBtn.disabled = false;

        if (!progressBox.hidden) {
            setTimeout(() => {
                progressBox.hidden = true;
            }, 1500);
        }
    }
});


// ============================================================
// PAGE VISIBILITY
// ============================================================

document.addEventListener("visibilitychange", () => {

    // Kalau user meninggalkan halaman ketika sedang
    // recording, jangan biarkan preview terus berjalan.
    if (
        document.hidden &&
        !isRecording
    ) {
        stopPreviewLoop();
    }
});


// ============================================================
// INITIAL STATE
// ============================================================

downloadLink.hidden = true;

progressBox.hidden = true;

drawCanvas();


// ============================================================
// DEBUG INFO
// Tidak menggunakan FFmpeg.
// ============================================================

console.log(
    "[Mustika Pradapati] Native video exporter aktif."
);

console.log(
    "[Mustika Pradapati] Format yang didukung:",
    getSupportedRecordingFormats()
);
