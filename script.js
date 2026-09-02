// ============================================================
// MUSTIKA PRADAPATI KE-IV
// Video Twibbon Generator
// ============================================================

const videoInput = document.getElementById("videoInput");
const uploadCard = document.getElementById("uploadCard");
const editor = document.getElementById("editor");
const uploadError = document.getElementById("uploadError");

const canvas = document.getElementById("previewCanvas");
const ctx = canvas.getContext("2d");

const stage = document.getElementById("stage");
const stageHint = document.getElementById("stageHint");

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

// Twibbon overlay
const TWIBBON_URL = "assets/twibbon-overlay.png";

// FFmpeg core dari CDN resmi
const FFMPEG_CORE_BASE =
    "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";

// ============================================================
// STATE
// ============================================================

const state = {
    videoURL: null,
    twibbonImage: null,

    ffmpeg: null,
    ffmpegLoaded: false,
    ffmpegLoading: null,

    scale: 1,
    offsetX: 0,
    offsetY: 0,

    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    startOffsetX: 0,
    startOffsetY: 0,

    animationFrame: null,
    previewPlaying: false,

    audioContext: null,
    finalURL: null
};

// ============================================================
// INIT
// ============================================================

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

loadTwibbon();
drawPlaceholder();

// ============================================================
// LOAD TWIBBON
// ============================================================

function loadTwibbon() {
    const img = new Image();

    img.onload = () => {
        state.twibbonImage = img;
        renderCanvas();
    };

    img.onerror = () => {
        showError(
            "Twibbon tidak ditemukan. Pastikan file assets/twibbon-overlay.png ada."
        );
    };

    img.src = TWIBBON_URL;
}

// ============================================================
// UPLOAD VIDEO
// ============================================================

videoInput.addEventListener("change", async () => {
    const file = videoInput.files?.[0];

    if (!file) return;

    clearError();

    if (!file.type.startsWith("video/")) {
        showError("File yang dipilih bukan video.");
        videoInput.value = "";
        return;
    }

    const url = URL.createObjectURL(file);

    sourceVideo.pause();
    sourceVideo.removeAttribute("src");
    sourceVideo.load();

    sourceVideo.src = url;
    sourceVideo.preload = "metadata";
    sourceVideo.playsInline = true;

    state.videoURL = url;

    sourceVideo.onloadedmetadata = () => {
        if (!Number.isFinite(sourceVideo.duration)) {
            showError("Durasi video tidak dapat dibaca.");
            return;
        }

        if (sourceVideo.duration > MAX_DURATION) {
            showError(
                `Video terlalu panjang. Maksimal ${MAX_DURATION} detik.`
            );

            URL.revokeObjectURL(url);
            state.videoURL = null;

            sourceVideo.removeAttribute("src");
            sourceVideo.load();

            videoInput.value = "";
            return;
        }

        resetVideoPosition();

        uploadCard.hidden = true;
        editor.hidden = false;

        stageHint.hidden = false;

        renderCanvas();

        setTimeout(() => {
            stageHint.hidden = true;
        }, 2500);
    };

    sourceVideo.onerror = () => {
        showError("Video tidak dapat dibuka oleh browser.");
    };

    sourceVideo.load();
});

// ============================================================
// ERROR
// ============================================================

function showError(message) {
    uploadError.textContent = message;
    uploadError.hidden = false;
}

function clearError() {
    uploadError.textContent = "";
    uploadError.hidden = true;
}

// ============================================================
// VIDEO POSITION
// ============================================================

function resetVideoPosition() {
    state.scale = 1;
    state.offsetX = 0;
    state.offsetY = 0;

    zoom.value = 100;
    zoomValue.textContent = "100%";

    if (Number.isFinite(sourceVideo.duration)) {
        sourceVideo.currentTime = 0;
    }

    renderCanvas();
}

// ============================================================
// VIDEO COVER CALCULATION
// ============================================================

function getBaseVideoSize() {
    const videoWidth = sourceVideo.videoWidth;
    const videoHeight = sourceVideo.videoHeight;

    if (!videoWidth || !videoHeight) {
        return {
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT
        };
    }

    // Cover:
    // video harus menutupi seluruh canvas.
    const coverScale = Math.max(
        CANVAS_WIDTH / videoWidth,
        CANVAS_HEIGHT / videoHeight
    );

    return {
        width: videoWidth * coverScale,
        height: videoHeight * coverScale
    };
}

// ============================================================
// RENDER CANVAS
// ============================================================

function renderCanvas() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Background
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Video
    if (
        sourceVideo.readyState >= 2 &&
        sourceVideo.videoWidth > 0 &&
        sourceVideo.videoHeight > 0
    ) {
        const base = getBaseVideoSize();

        const width = base.width * state.scale;
        const height = base.height * state.scale;

        const x =
            (CANVAS_WIDTH - width) / 2 +
            state.offsetX;

        const y =
            (CANVAS_HEIGHT - height) / 2 +
            state.offsetY;

        ctx.drawImage(
            sourceVideo,
            x,
            y,
            width,
            height
        );
    }

    // Twibbon
    if (state.twibbonImage) {
        ctx.drawImage(
            state.twibbonImage,
            0,
            0,
            CANVAS_WIDTH,
            CANVAS_HEIGHT
        );
    }
}

// ============================================================
// PLACEHOLDER
// ============================================================

function drawPlaceholder() {
    ctx.fillStyle = "#17100b";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = "#d7c1a0";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = "bold 54px Arial";
    ctx.fillText(
        "Upload video untuk mulai",
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2
    );
}

// ============================================================
// ANIMATION LOOP
// ============================================================

function startRenderLoop() {
    stopRenderLoop();

    function loop() {
        renderCanvas();
        state.animationFrame = requestAnimationFrame(loop);
    }

    loop();
}

function stopRenderLoop() {
    if (state.animationFrame) {
        cancelAnimationFrame(state.animationFrame);
        state.animationFrame = null;
    }
}

// ============================================================
// ZOOM
// ============================================================

zoom.addEventListener("input", () => {
    state.scale = Number(zoom.value) / 100;

    zoomValue.textContent = `${zoom.value}%`;

    renderCanvas();
});

// ============================================================
// RESET
// ============================================================

resetBtn.addEventListener("click", () => {
    resetVideoPosition();
});

// ============================================================
// POINTER DRAG
// ============================================================

stage.addEventListener("pointerdown", (event) => {
    if (!state.videoURL) return;

    state.dragging = true;

    stage.setPointerCapture(event.pointerId);

    state.dragStartX = event.clientX;
    state.dragStartY = event.clientY;

    state.startOffsetX = state.offsetX;
    state.startOffsetY = state.offsetY;

    stage.classList.add("dragging");
});

stage.addEventListener("pointermove", (event) => {
    if (!state.dragging) return;

    const rect = stage.getBoundingClientRect();

    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    const dx =
        (event.clientX - state.dragStartX) * scaleX;

    const dy =
        (event.clientY - state.dragStartY) * scaleY;

    state.offsetX = state.startOffsetX + dx;
    state.offsetY = state.startOffsetY + dy;

    renderCanvas();
});

stage.addEventListener("pointerup", stopDragging);
stage.addEventListener("pointercancel", stopDragging);
stage.addEventListener("pointerleave", (event) => {
    if (state.dragging && event.buttons === 0) {
        stopDragging();
    }
});

function stopDragging() {
    state.dragging = false;
    stage.classList.remove("dragging");
}

// ============================================================
// PREVIEW PLAY / PAUSE
// ============================================================

playBtn.addEventListener("click", async () => {
    if (!state.videoURL) return;

    try {
        if (sourceVideo.paused) {
            if (
                sourceVideo.ended ||
                sourceVideo.currentTime >= sourceVideo.duration
            ) {
                sourceVideo.currentTime = 0;
            }

            await sourceVideo.play();

            state.previewPlaying = true;
            playBtn.textContent = "⏸ Pause Preview";

            startRenderLoop();
        } else {
            sourceVideo.pause();

            state.previewPlaying = false;
            playBtn.textContent = "▶ Lihat Preview";

            stopRenderLoop();
            renderCanvas();
        }
    } catch (error) {
        console.error("Preview gagal:", error);

        showError(
            "Browser tidak mengizinkan pemutaran video. Coba klik tombol lagi."
        );
    }
});

sourceVideo.addEventListener("ended", () => {
    state.previewPlaying = false;

    playBtn.textContent = "▶ Lihat Preview";

    stopRenderLoop();
    renderCanvas();
});

// ============================================================
// FFMPEG
// ============================================================

async function loadFFmpeg() {
    if (state.ffmpegLoaded && state.ffmpeg) {
        return state.ffmpeg;
    }

    if (state.ffmpegLoading) {
        return state.ffmpegLoading;
    }

    state.ffmpegLoading = (async () => {
        progressBox.hidden = false;

        progressText.textContent =
            "Menyiapkan mesin video...";

        progressPct.textContent = "0%";
        progressBar.style.width = "0%";

        try {
            if (!window.FFmpegWASM) {
                throw new Error(
                    "FFmpegWASM tidak ditemukan. Pastikan ffmpeg/ffmpeg.js sudah dimuat."
                );
            }

            const { FFmpeg } = window.FFmpegWASM;

            if (!FFmpeg) {
                throw new Error(
                    "Class FFmpeg tidak ditemukan."
                );
            }

            const ffmpeg = new FFmpeg();

            state.ffmpeg = ffmpeg;

            // Log FFmpeg ke Console
            ffmpeg.on("log", ({ message }) => {
                console.log("[FFmpeg]", message);
            });

            ffmpeg.on("progress", ({ progress }) => {
                const percent = Math.max(
                    0,
                    Math.min(100, Math.round(progress * 100))
                );

                progressText.textContent =
                    "Mengubah video ke MP4...";

                progressPct.textContent = `${percent}%`;
                progressBar.style.width = `${percent}%`;
            });

            // ====================================================
            // CORE FFmpeg DIAMBIL DARI CDN RESMI
            // ====================================================

            const coreJSURL =
                `${FFMPEG_CORE_BASE}/ffmpeg-core.js`;

            const coreWASMURL =
                `${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`;

            console.log(
                "[FFmpeg] Mengambil core:",
                coreJSURL
            );

            console.log(
                "[FFmpeg] Mengambil WASM:",
                coreWASMURL
            );

            const coreBlobURL =
                await createBlobURL(
                    coreJSURL,
                    "text/javascript"
                );

            const wasmBlobURL =
                await createBlobURL(
                    coreWASMURL,
                    "application/wasm"
                );

            console.log(
                "[FFmpeg] Core berhasil diambil."
            );

            progressText.textContent =
                "Memuat mesin video...";

            progressPct.textContent = "10%";
            progressBar.style.width = "10%";

            // Timeout supaya tidak diam selamanya
            const timeout = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(
                        new Error(
                            "FFmpeg terlalu lama dimuat. Periksa Console browser."
                        )
                    );
                }, 120000);
            });

            await Promise.race([
                ffmpeg.load({
                    coreURL: coreBlobURL,
                    wasmURL: wasmBlobURL
                }),
                timeout
            ]);

            state.ffmpegLoaded = true;

            progressText.textContent =
                "Mesin video siap.";

            progressPct.textContent = "100%";
            progressBar.style.width = "100%";

            console.log(
                "[FFmpeg] Berhasil dimuat."
            );

            return ffmpeg;

        } catch (error) {
            console.error(
                "[FFmpeg] Gagal memuat:",
                error
            );

            state.ffmpeg = null;
            state.ffmpegLoaded = false;

            throw error;

        } finally {
            state.ffmpegLoading = null;
        }
    })();

    return state.ffmpegLoading;
}

// ============================================================
// FETCH → BLOB URL
// ============================================================

async function createBlobURL(url, mimeType) {
    const response = await fetch(url, {
        mode: "cors",
        cache: "force-cache"
    });

    if (!response.ok) {
        throw new Error(
            `Gagal mengambil ${url} (${response.status})`
        );
    }

    const buffer = await response.arrayBuffer();

    if (!buffer.byteLength) {
        throw new Error(
            `File kosong: ${url}`
        );
    }

    const blob = new Blob(
        [buffer],
        { type: mimeType }
    );

    return URL.createObjectURL(blob);
}

// ============================================================
// EXPORT VIDEO
// ============================================================

downloadBtn.addEventListener("click", async () => {
    if (!state.videoURL) {
        showError("Silakan upload video terlebih dahulu.");
        return;
    }

    downloadBtn.disabled = true;
    playBtn.disabled = true;
    resetBtn.disabled = true;

    downloadLink.hidden = true;

    clearError();

    try {
        await exportVideo();
    } catch (error) {
        console.error(
            "[Export] Gagal:",
            error
        );

        showError(
            `Gagal membuat video: ${error.message || error}`
        );

        progressText.textContent =
            "Proses gagal.";

    } finally {
        downloadBtn.disabled = false;
        playBtn.disabled = false;
        resetBtn.disabled = false;
    }
});

// ============================================================
// EXPORT VIDEO
// ============================================================

async function exportVideo() {
    progressBox.hidden = false;

    progressText.textContent =
        "Menyiapkan video...";

    progressPct.textContent = "0%";
    progressBar.style.width = "0%";

    // Pastikan video berhenti
    sourceVideo.pause();

    // Mulai dari awal
    sourceVideo.currentTime = 0;

    await waitForVideoReady();

    // ========================================================
    // LOAD FFMPEG
    // ========================================================

    const ffmpeg = await loadFFmpeg();

    if (!ffmpeg) {
        throw new Error(
            "FFmpeg tidak tersedia."
        );
    }

    // ========================================================
    // CANVAS STREAM
    // ========================================================

    const canvasStream =
        canvas.captureStream(30);

    const videoTrack =
        canvasStream.getVideoTracks()[0];

    if (!videoTrack) {
        throw new Error(
            "Browser tidak mendukung canvas.captureStream()."
        );
    }

    // ========================================================
    // AUDIO STREAM
    // ========================================================

    const audioTracks =
        getVideoAudioTracks();

    const finalStream =
        new MediaStream();

    finalStream.addTrack(videoTrack);

    for (const track of audioTracks) {
        finalStream.addTrack(track);
    }

    console.log(
        "[Export] Video tracks:",
        finalStream.getVideoTracks().length
    );

    console.log(
        "[Export] Audio tracks:",
        finalStream.getAudioTracks().length
    );

    // ========================================================
    // MIME TYPE
    // ========================================================

    const mimeType =
        getSupportedMimeType();

    if (!mimeType) {
        throw new Error(
            "Browser tidak mendukung format WebM untuk perekaman."
        );
    }

    console.log(
        "[Export] MIME:",
        mimeType
    );

    // ========================================================
    // MEDIA RECORDER
    // ========================================================

    const recorder =
        new MediaRecorder(
            finalStream,
            {
                mimeType,
                videoBitsPerSecond: 8_000_000,
                audioBitsPerSecond: 128_000
            }
        );

    const chunks = [];

    recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
            chunks.push(event.data);
        }
    };

    const recordingFinished =
        new Promise((resolve, reject) => {
            recorder.onerror = (event) => {
                reject(
                    event.error ||
                    new Error("MediaRecorder error.")
                );
            };

            recorder.onstop = () => {
                resolve();
            };
        });

    // ========================================================
    // RENDER + RECORD
    // ========================================================

    let recordingFrame;

    const renderRecording = () => {
        renderCanvas();

        if (!sourceVideo.paused && !sourceVideo.ended) {
            const duration = sourceVideo.duration || 1;

            const percent =
                Math.min(
                    99,
                    Math.round(
                        (sourceVideo.currentTime /
                            duration) *
                            100
                    )
                );

            progressText.textContent =
                "Merekam video...";

            progressPct.textContent =
                `${percent}%`;

            progressBar.style.width =
                `${percent}%`;
        }

        recordingFrame =
            requestAnimationFrame(renderRecording);
    };

    // Pastikan canvas sudah menggambar frame awal
    renderCanvas();

    // Mulai recorder
    recorder.start(250);

    console.log(
        "[Export] Recording dimulai."
    );

    // Mulai render loop
    renderRecording();

    // Mulai video
    try {
        await sourceVideo.play();
    } catch (error) {
        cancelAnimationFrame(recordingFrame);

        if (recorder.state !== "inactive") {
            recorder.stop();
        }

        throw new Error(
            "Video tidak dapat diputar untuk proses export."
        );
    }

    // ========================================================
    // STOP BERDASARKAN DURASI
    // ========================================================

    const duration =
        Math.min(
            sourceVideo.duration || MAX_DURATION,
            MAX_DURATION
        );

    await new Promise((resolve) => {
        let finished = false;

        const finish = () => {
            if (finished) return;

            finished = true;

            sourceVideo.removeEventListener(
                "ended",
                finish
            );

            resolve();
        };

        sourceVideo.addEventListener(
            "ended",
            finish,
            { once: true }
        );

        // Fallback timer
        setTimeout(
            finish,
            Math.ceil(duration * 1000) + 1000
        );
    });

    // Hentikan video
    sourceVideo.pause();

    // Hentikan render loop
    cancelAnimationFrame(recordingFrame);

    // Pastikan frame terakhir tergambar
    renderCanvas();

    // Tunggu sedikit supaya frame terakhir masuk
    await sleep(200);

    if (recorder.state !== "inactive") {
        recorder.stop();
    }

    await recordingFinished;

    console.log(
        "[Export] Recording selesai."
    );

    // Hentikan track
    finalStream.getTracks().forEach((track) => {
        try {
            track.stop();
        } catch (_) {}
    });

    // ========================================================
    // WEBM
    // ========================================================

    if (!chunks.length) {
        throw new Error(
            "Tidak ada data video yang berhasil direkam."
        );
    }

    const webmBlob =
        new Blob(
            chunks,
            { type: mimeType }
        );

    console.log(
        "[Export] WebM size:",
        webmBlob.size
    );

    if (webmBlob.size < 10000) {
        throw new Error(
            "Video hasil rekaman terlalu kecil."
        );
    }

    progressText.textContent =
        "Mengubah WebM menjadi MP4...";

    progressPct.textContent = "0%";
    progressBar.style.width = "0%";

    // ========================================================
    // CONVERT WEBM → MP4
    // ========================================================

    const mp4Blob =
        await convertToMP4(
            ffmpeg,
            webmBlob
        );

    // ========================================================
    // DOWNLOAD
    // ========================================================

    if (state.finalURL) {
        URL.revokeObjectURL(state.finalURL);
    }

    state.finalURL =
        URL.createObjectURL(mp4Blob);

    downloadLink.href =
        state.finalURL;

    downloadLink.download =
        "mustika-pradapati-video.mp4";

    downloadLink.hidden = false;

    progressText.textContent =
        "Video selesai!";

    progressPct.textContent = "100%";
    progressBar.style.width = "100%";

    // Download otomatis
    downloadLink.click();

    console.log(
        "[Export] MP4 selesai:",
        mp4Blob.size,
        "bytes"
    );
}

// ============================================================
// AUDIO TRACK
// ============================================================

function getVideoAudioTracks() {
    try {
        if (
            typeof sourceVideo.captureStream ===
            "function"
        ) {
            const stream =
                sourceVideo.captureStream();

            const tracks =
                stream.getAudioTracks();

            if (tracks.length > 0) {
                console.log(
                    "[Audio] Menggunakan audio track dari video."
                );

                return tracks;
            }
        }
    } catch (error) {
        console.warn(
            "[Audio] captureStream gagal:",
            error
        );
    }

    console.warn(
        "[Audio] Audio track tidak tersedia di browser ini."
    );

    return [];
}

// ============================================================
// WEBM → MP4
// ============================================================

async function convertToMP4(
    ffmpeg,
    webmBlob
) {
    const inputName =
        "input.webm";

    const outputName =
        "output.mp4";

    // Bersihkan file lama kalau ada
    try {
        await ffmpeg.deleteFile(
            inputName
        );
    } catch (_) {}

    try {
        await ffmpeg.deleteFile(
            outputName
        );
    } catch (_) {}

    // Blob → Uint8Array
    const buffer =
        await webmBlob.arrayBuffer();

    const data =
        new Uint8Array(buffer);

    progressText.textContent =
        "Memasukkan video ke FFmpeg...";

    progressPct.textContent = "5%";
    progressBar.style.width = "5%";

    await ffmpeg.writeFile(
        inputName,
        data
    );

    console.log(
        "[FFmpeg] input.webm ditulis:",
        data.byteLength,
        "bytes"
    );

    progressText.textContent =
        "Mengonversi ke MP4...";

    // ========================================================
    // WEBM → H264 + AAC
    // ========================================================

    await ffmpeg.exec([
        "-i",
        inputName,

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

        outputName
    ]);

    console.log(
        "[FFmpeg] Konversi selesai."
    );

    progressText.textContent =
        "Mengambil MP4 hasil konversi...";

    progressPct.textContent = "95%";
    progressBar.style.width = "95%";

    const output =
        await ffmpeg.readFile(
            outputName
        );

    if (!output || !output.length) {
        throw new Error(
            "FFmpeg tidak menghasilkan file MP4."
        );
    }

    const mp4Blob =
        new Blob(
            [output.buffer],
            {
                type: "video/mp4"
            }
        );

    // Bersihkan file virtual FFmpeg
    try {
        await ffmpeg.deleteFile(
            inputName
        );
    } catch (_) {}

    try {
        await ffmpeg.deleteFile(
            outputName
        );
    } catch (_) {}

    return mp4Blob;
}

// ============================================================
// MIME TYPE
// ============================================================

function getSupportedMimeType() {
    const types = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm"
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

// ============================================================
// WAIT VIDEO READY
// ============================================================

function waitForVideoReady() {
    return new Promise((resolve, reject) => {
        if (
            sourceVideo.readyState >= 3 &&
            sourceVideo.videoWidth > 0
        ) {
            resolve();
            return;
        }

        const timeout =
            setTimeout(() => {
                cleanup();

                reject(
                    new Error(
                        "Video terlalu lama dimuat."
                    )
                );
            }, 15000);

        const check = () => {
            if (
                sourceVideo.readyState >= 3 &&
                sourceVideo.videoWidth > 0
            ) {
                cleanup();
                resolve();
            }
        };

        const cleanup = () => {
            clearTimeout(timeout);

            sourceVideo.removeEventListener(
                "canplay",
                check
            );

            sourceVideo.removeEventListener(
                "loadeddata",
                check
            );
        };

        sourceVideo.addEventListener(
            "canplay",
            check
        );

        sourceVideo.addEventListener(
            "loadeddata",
            check
        );

        check();
    });
}

// ============================================================
// SLEEP
// ============================================================

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

// ============================================================
// CLEANUP SAAT HALAMAN DITUTUP
// ============================================================

window.addEventListener("beforeunload", () => {
    stopRenderLoop();

    if (state.videoURL) {
        URL.revokeObjectURL(state.videoURL);
    }

    if (state.finalURL) {
        URL.revokeObjectURL(state.finalURL);
    }

    if (state.audioContext) {
        try {
            state.audioContext.close();
        } catch (_) {}
    }
});
