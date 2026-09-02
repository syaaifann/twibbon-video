const videoInput = document.getElementById("videoInput");
const uploadCard = document.getElementById("uploadCard");
const editor = document.getElementById("editor");
const uploadError = document.getElementById("uploadError");

const stage = document.getElementById("stage");
const canvas = document.getElementById("previewCanvas");
const ctx = canvas.getContext("2d", {
    alpha: false
});

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

const overlayImage = new Image();
overlayImage.src = "assets/twibbon-overlay.png";

let videoURL = null;
let outputURL = null;

let videoReady = false;
let isPlaying = false;

let scale = 1;
let offsetX = 0;
let offsetY = 0;

let dragging = false;
let lastPointerX = 0;
let lastPointerY = 0;

let renderFrameId = null;
let videoFrameCallbackId = null;

let exportRendering = false;
let exportFrameCallbackId = null;

let ffmpeg = null;
let ffmpegLoaded = false;

const MAX_DURATION = 30;
const EXPORT_FPS = 30;


/* =========================================================
   ERROR
========================================================= */

function showError(message) {
    uploadError.textContent = message;
    uploadError.hidden = false;
}

function clearError() {
    uploadError.textContent = "";
    uploadError.hidden = true;
}


/* =========================================================
   PROGRESS
========================================================= */

function setProgress(percent, text) {
    const value = Math.max(
        0,
        Math.min(100, percent)
    );

    progressPct.textContent =
        `${Math.round(value)}%`;

    progressBar.style.width =
        `${value}%`;

    if (text) {
        progressText.textContent = text;
    }
}

function resetProgress() {
    setProgress(
        0,
        "Menyiapkan..."
    );
}


/* =========================================================
   VIDEO SCALE
========================================================= */

function getCoverScale() {
    if (
        !sourceVideo.videoWidth ||
        !sourceVideo.videoHeight
    ) {
        return 1;
    }

    const canvasRatio =
        canvas.width / canvas.height;

    const videoRatio =
        sourceVideo.videoWidth /
        sourceVideo.videoHeight;

    if (videoRatio > canvasRatio) {
        return (
            canvas.height /
            sourceVideo.videoHeight
        );
    }

    return (
        canvas.width /
        sourceVideo.videoWidth
    );
}


/* =========================================================
   DRAW CANVAS
========================================================= */

function drawCanvas() {
    ctx.fillStyle = "#000";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    if (videoReady) {
        const baseScale =
            getCoverScale();

        const finalScale =
            baseScale * scale;

        const drawWidth =
            sourceVideo.videoWidth *
            finalScale;

        const drawHeight =
            sourceVideo.videoHeight *
            finalScale;

        const x =
            (canvas.width - drawWidth) / 2 +
            offsetX;

        const y =
            (canvas.height - drawHeight) / 2 +
            offsetY;

        ctx.drawImage(
            sourceVideo,
            x,
            y,
            drawWidth,
            drawHeight
        );
    }

    if (
        overlayImage.complete &&
        overlayImage.naturalWidth > 0
    ) {
        ctx.drawImage(
            overlayImage,
            0,
            0,
            canvas.width,
            canvas.height
        );
    }
}

overlayImage.onload = () => {
    drawCanvas();
};


/* =========================================================
   NORMAL PREVIEW RENDERING
========================================================= */

function stopVideoRendering() {
    if (renderFrameId !== null) {
        cancelAnimationFrame(
            renderFrameId
        );

        renderFrameId = null;
    }

    if (
        videoFrameCallbackId !== null &&
        typeof sourceVideo.cancelVideoFrameCallback ===
            "function"
    ) {
        try {
            sourceVideo.cancelVideoFrameCallback(
                videoFrameCallbackId
            );
        } catch (error) {
            // Tidak masalah.
        }

        videoFrameCallbackId = null;
    }
}

function startVideoRendering() {
    stopVideoRendering();

    if (
        typeof sourceVideo.requestVideoFrameCallback ===
        "function"
    ) {
        const renderFrame = () => {
            if (
                !videoReady ||
                sourceVideo.paused ||
                sourceVideo.ended
            ) {
                videoFrameCallbackId = null;
                return;
            }

            drawCanvas();

            videoFrameCallbackId =
                sourceVideo.requestVideoFrameCallback(
                    renderFrame
                );
        };

        renderFrame();

        return;
    }

    const renderLoop = () => {
        if (
            !videoReady ||
            sourceVideo.paused ||
            sourceVideo.ended
        ) {
            renderFrameId = null;
            return;
        }

        drawCanvas();

        renderFrameId =
            requestAnimationFrame(
                renderLoop
            );
    };

    renderLoop();
}


/* =========================================================
   RESET EDITOR
========================================================= */

function resetEditor() {
    scale = 1;
    offsetX = 0;
    offsetY = 0;

    zoom.value = 100;
    zoomValue.textContent = "100%";

    drawCanvas();
}


/* =========================================================
   VIDEO UPLOAD
========================================================= */

videoInput.addEventListener(
    "change",
    () => {
        clearError();

        const file =
            videoInput.files[0];

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

        if (videoURL) {
            URL.revokeObjectURL(
                videoURL
            );
        }

        videoURL =
            URL.createObjectURL(file);

        videoReady = false;

        stopVideoRendering();

        sourceVideo.pause();

        sourceVideo.src =
            videoURL;

        sourceVideo.load();

        sourceVideo.onloadedmetadata =
            () => {
                if (
                    sourceVideo.duration >
                    MAX_DURATION
                ) {
                    showError(
                        `Durasi video terlalu panjang. Maksimal ${MAX_DURATION} detik.`
                    );

                    sourceVideo.removeAttribute(
                        "src"
                    );

                    sourceVideo.load();

                    videoReady = false;

                    return;
                }

                videoReady = true;

                uploadCard.hidden =
                    true;

                editor.hidden =
                    false;

                resetEditor();

                drawCanvas();

                stageHint.hidden =
                    false;

                setTimeout(
                    () => {
                        stageHint.hidden =
                            true;
                    },
                    2500
                );
            };

        sourceVideo.onerror = () => {
            showError(
                "Video tidak dapat dibaca oleh browser."
            );

            videoReady = false;
        };
    }
);


/* =========================================================
   ZOOM
========================================================= */

zoom.addEventListener(
    "input",
    () => {
        scale =
            Number(zoom.value) / 100;

        zoomValue.textContent =
            `${zoom.value}%`;

        drawCanvas();
    }
);


/* =========================================================
   RESET BUTTON
========================================================= */

resetBtn.addEventListener(
    "click",
    () => {
        resetEditor();
    }
);


/* =========================================================
   DRAG VIDEO
========================================================= */

canvas.addEventListener(
    "pointerdown",
    (event) => {
        if (!videoReady) {
            return;
        }

        dragging = true;

        lastPointerX =
            event.clientX;

        lastPointerY =
            event.clientY;

        canvas.setPointerCapture(
            event.pointerId
        );
    }
);

canvas.addEventListener(
    "pointermove",
    (event) => {
        if (!dragging) {
            return;
        }

        const rect =
            canvas.getBoundingClientRect();

        const scaleX =
            canvas.width /
            rect.width;

        const scaleY =
            canvas.height /
            rect.height;

        const dx =
            (event.clientX -
                lastPointerX) *
            scaleX;

        const dy =
            (event.clientY -
                lastPointerY) *
            scaleY;

        offsetX += dx;
        offsetY += dy;

        lastPointerX =
            event.clientX;

        lastPointerY =
            event.clientY;

        drawCanvas();
    }
);

canvas.addEventListener(
    "pointerup",
    (event) => {
        dragging = false;

        try {
            canvas.releasePointerCapture(
                event.pointerId
            );
        } catch (error) {
            // Tidak masalah.
        }
    }
);

canvas.addEventListener(
    "pointercancel",
    () => {
        dragging = false;
    }
);


/* =========================================================
   PREVIEW BUTTON
========================================================= */

playBtn.addEventListener(
    "click",
    async () => {
        if (!videoReady) {
            return;
        }

        if (isPlaying) {
            sourceVideo.pause();

            stopVideoRendering();

            isPlaying = false;

            playBtn.textContent =
                "▶ Lihat Preview";

            drawCanvas();

            return;
        }

        try {
            sourceVideo.currentTime = 0;

            await sourceVideo.play();

            isPlaying = true;

            playBtn.textContent =
                "⏸ Pause Preview";

            startVideoRendering();

        } catch (error) {
            console.error(
                "[Preview]",
                error
            );
        }
    }
);

sourceVideo.addEventListener(
    "play",
    () => {
        isPlaying = true;

        playBtn.textContent =
            "⏸ Pause Preview";

        if (!exportRendering) {
            startVideoRendering();
        }
    }
);

sourceVideo.addEventListener(
    "pause",
    () => {
        isPlaying = false;

        if (!exportRendering) {
            stopVideoRendering();
        }

        playBtn.textContent =
            "▶ Lihat Preview";

        drawCanvas();
    }
);

sourceVideo.addEventListener(
    "ended",
    () => {
        isPlaying = false;

        if (!exportRendering) {
            stopVideoRendering();
        }

        playBtn.textContent =
            "▶ Lihat Preview";

        drawCanvas();
    }
);


/* =========================================================
   WAIT
========================================================= */

function wait(ms) {
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
   FFMPEG BLOB
========================================================= */

async function createBlobURL(
    url,
    mimeType
) {
    const response =
        await fetch(url);

    if (!response.ok) {
        throw new Error(
            `Gagal mengambil file FFmpeg: ${response.status}`
        );
    }

    const blob =
        await response.blob();

    return URL.createObjectURL(
        new Blob(
            [blob],
            {
                type: mimeType
            }
        )
    );
}


/* =========================================================
   LOAD FFMPEG
========================================================= */

async function loadFFmpeg() {
    if (ffmpegLoaded) {
        return;
    }

    if (
        !window.FFmpegWASM ||
        !window.FFmpegWASM.FFmpeg
    ) {
        throw new Error(
            "Library FFmpeg tidak ditemukan. Pastikan ffmpeg/ffmpeg.js sudah dimuat."
        );
    }

    console.log(
        "[FFmpeg] Memulai loading..."
    );

    ffmpeg =
        new window.FFmpegWASM.FFmpeg();

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
            const percent =
                5 +
                Math.min(
                    90,
                    progress * 90
                );

            setProgress(
                percent,
                "Mengonversi ke MP4..."
            );
        }
    );

    const baseURL =
        "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";

    console.log(
        "[FFmpeg] Mengambil core:",
        `${baseURL}/ffmpeg-core.js`
    );

    console.log(
        "[FFmpeg] Mengambil WASM:",
        `${baseURL}/ffmpeg-core.wasm`
    );

    const coreURL =
        await createBlobURL(
            `${baseURL}/ffmpeg-core.js`,
            "text/javascript"
        );

    const wasmURL =
        await createBlobURL(
            `${baseURL}/ffmpeg-core.wasm`,
            "application/wasm"
        );

    console.log(
        "[FFmpeg] Core berhasil diambil."
    );

    await ffmpeg.load({
        coreURL,
        wasmURL
    });

    URL.revokeObjectURL(
        coreURL
    );

    URL.revokeObjectURL(
        wasmURL
    );

    ffmpegLoaded = true;

    console.log(
        "[FFmpeg] Berhasil dimuat."
    );
}


/* =========================================================
   AUDIO
========================================================= */

function getVideoAudioTracks() {
    try {
        if (
            typeof sourceVideo.captureStream !==
            "function"
        ) {
            console.warn(
                "[Audio] captureStream tidak tersedia."
            );

            return [];
        }

        const stream =
            sourceVideo.captureStream();

        const tracks =
            stream.getAudioTracks();

        console.log(
            "[Audio] Audio tracks:",
            tracks.length
        );

        return tracks;

    } catch (error) {
        console.warn(
            "[Audio] Gagal mengambil audio:",
            error
        );

        return [];
    }
}


/* =========================================================
   WEBM MIME
========================================================= */

/*
 * PENTING:
 *
 * Kita SENGAJA tidak menggunakan MP4
 * di MediaRecorder.
 *
 * Android sebelumnya menghasilkan:
 *
 * 8 detik → 1 detik
 *
 * ketika jalur MP4 langsung digunakan.
 *
 * Jadi recording awal selalu WebM.
 */

function getWebMMimeType() {
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
   EXPORT FRAME RENDERER
========================================================= */

function stopExportRendering() {
    exportRendering = false;

    if (
        exportFrameCallbackId !== null &&
        typeof sourceVideo.cancelVideoFrameCallback ===
            "function"
    ) {
        try {
            sourceVideo.cancelVideoFrameCallback(
                exportFrameCallbackId
            );
        } catch (error) {
            // Tidak masalah.
        }

        exportFrameCallbackId = null;
    }
}

function startExportRendering() {
    exportRendering = true;

    /*
     * Browser modern:
     * ikuti frame video sebenarnya.
     */
    if (
        typeof sourceVideo.requestVideoFrameCallback ===
        "function"
    ) {
        const renderFrame = () => {
            if (
                !exportRendering ||
                sourceVideo.paused ||
                sourceVideo.ended
            ) {
                exportFrameCallbackId =
                    null;

                return;
            }

            drawCanvas();

            exportFrameCallbackId =
                sourceVideo.requestVideoFrameCallback(
                    renderFrame
                );
        };

        renderFrame();

        return;
    }

    /*
     * Fallback Android/browser lama.
     */
    const renderLoop = () => {
        if (
            !exportRendering ||
            sourceVideo.paused ||
            sourceVideo.ended
        ) {
            return;
        }

        drawCanvas();

        requestAnimationFrame(
            renderLoop
        );
    };

    renderLoop();
}


/* =========================================================
   RECORD CANVAS
========================================================= */

async function recordCanvas() {
    return new Promise(
        async (resolve, reject) => {

            let canvasStream = null;
            let recorder = null;

            let finished = false;
            let watchdog = null;

            try {

                const mimeType =
                    getWebMMimeType();

                if (!mimeType) {
                    throw new Error(
                        "Browser ini tidak mendukung WebM."
                    );
                }

                console.log(
                    "[Export] MIME:",
                    mimeType
                );

                /*
                 * Canvas stream.
                 *
                 * Kita tetap menggunakan 30 FPS
                 * supaya canvas mempunyai frame rate
                 * yang stabil.
                 */
                canvasStream =
                    canvas.captureStream(
                        EXPORT_FPS
                    );

                /*
                 * Ambil audio dari video asli.
                 */
                const audioTracks =
                    getVideoAudioTracks();

                audioTracks.forEach(
                    track => {
                        canvasStream.addTrack(
                            track
                        );
                    }
                );

                console.log(
                    "[Export] Video tracks:",
                    canvasStream
                        .getVideoTracks()
                        .length
                );

                console.log(
                    "[Export] Audio tracks:",
                    canvasStream
                        .getAudioTracks()
                        .length
                );

                /*
                 * Bitrate 5 Mbps.
                 * Cukup untuk 1080x1920
                 * dan lebih ringan untuk Android.
                 */
                recorder =
                    new MediaRecorder(
                        canvasStream,
                        {
                            mimeType:
                                mimeType,

                            videoBitsPerSecond:
                                5000000,

                            audioBitsPerSecond:
                                128000
                        }
                    );

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
                            "[Export] MediaRecorder error:",
                            event.error
                        );

                        finish(
                            event.error ||
                            new Error(
                                "MediaRecorder gagal."
                            )
                        );
                    };

                recorder.onstop =
                    () => {
                        if (finished) {
                            return;
                        }

                        finished = true;

                        clearTimeout(
                            watchdog
                        );

                        stopExportRendering();

                        if (
                            canvasStream
                        ) {
                            canvasStream
                                .getTracks()
                                .forEach(
                                    track => {
                                        track.stop();
                                    }
                                );
                        }

                        const blob =
                            new Blob(
                                chunks,
                                {
                                    type:
                                        mimeType
                                }
                            );

                        console.log(
                            "[Export] Recording selesai."
                        );

                        console.log(
                            "[Export] WebM size:",
                            blob.size,
                            "bytes"
                        );

                        resolve(
                            blob
                        );
                    };

                /*
                 * Fungsi untuk menghentikan recording.
                 */
                function finish(error = null) {

                    if (finished) {
                        return;
                    }

                    clearTimeout(
                        watchdog
                    );

                    stopExportRendering();

                    if (
                        error &&
                        recorder &&
                        recorder.state ===
                            "recording"
                    ) {
                        try {
                            recorder.stop();
                        } catch (stopError) {
                            console.error(
                                "[Export] Stop error:",
                                stopError
                            );
                        }

                        reject(error);

                        return;
                    }

                    if (
                        recorder &&
                        recorder.state ===
                            "recording"
                    ) {
                        try {
                            sourceVideo.pause();
                        } catch (pauseError) {
                            // Tidak masalah.
                        }

                        recorder.stop();
                    }
                }

                /*
                 * Pastikan video dimulai dari awal.
                 */
                exportRendering =
                    false;

                stopVideoRendering();

                sourceVideo.pause();

                sourceVideo.currentTime = 0;

                await wait(200);

                /*
                 * Gambar frame pertama
                 * sebelum recording dimulai.
                 */
                drawCanvas();

                /*
                 * Mulai MediaRecorder.
                 *
                 * PENTING:
                 * Selalu WebM di tahap ini.
                 */
                recorder.start(250);

                console.log(
                    "[Export] Recording dimulai."
                );

                /*
                 * Baru setelah recorder aktif,
                 * jalankan video.
                 */
                await sourceVideo.play();

                startExportRendering();

                const duration =
                    Math.min(
                        sourceVideo.duration ||
                            MAX_DURATION,
                        MAX_DURATION
                    );

                console.log(
                    "[Export] Durasi sumber:",
                    duration,
                    "detik"
                );

                /*
                 * Update progress selama recording.
                 */
                const updateProgress =
                    () => {

                        if (
                            finished ||
                            !exportRendering
                        ) {
                            return;
                        }

                        const current =
                            Math.max(
                                0,
                                Math.min(
                                    duration,
                                    sourceVideo
                                        .currentTime
                                )
                            );

                        const percent =
                            (
                                current /
                                duration
                            ) * 4.5;

                        setProgress(
                            percent,
                            "Merekam hasil video..."
                        );

                        requestAnimationFrame(
                            updateProgress
                        );
                    };

                updateProgress();

                /*
                 * Cara utama menghentikan:
                 * EVENT ENDED.
                 */
                const endedHandler =
                    () => {

                        console.log(
                            "[Export] Video mencapai akhir."
                        );

                        finish();
                    };

                sourceVideo.addEventListener(
                    "ended",
                    endedHandler,
                    {
                        once: true
                    }
                );

                /*
                 * WATCHDOG:
                 *
                 * Jika Android tidak memanggil
                 * event "ended", kita cek
                 * currentTime secara berkala.
                 */
                const checkVideoEnd =
                    () => {

                        if (
                            finished ||
                            !exportRendering
                        ) {
                            return;
                        }

                        const current =
                            sourceVideo
                                .currentTime;

                        if (
                            current >=
                            duration - 0.08
                        ) {
                            console.log(
                                "[Export] Watchdog mendeteksi akhir video."
                            );

                            finish();

                            return;
                        }

                        watchdog =
                            setTimeout(
                                checkVideoEnd,
                                100
                            );
                    };

                watchdog =
                    setTimeout(
                        checkVideoEnd,
                        100
                    );

                /*
                 * Pengaman terakhir.
                 *
                 * Durasi video + 2 detik.
                 */
                setTimeout(
                    () => {

                        if (
                            !finished
                        ) {
                            console.log(
                                "[Export] Safety timeout."
                            );

                            finish();
                        }

                    },
                    (
                        duration +
                        2
                    ) * 1000
                );

            } catch (error) {

                stopExportRendering();

                if (
                    canvasStream
                ) {
                    canvasStream
                        .getTracks()
                        .forEach(
                            track => {
                                track.stop();
                            }
                        );
                }

                console.error(
                    "[Export] Record error:",
                    error
                );

                reject(error);
            }
        }
    );
}


/* =========================================================
   CONVERT WEBM → MP4
========================================================= */

async function convertToMP4(
    webmBlob
) {
    const inputName =
        "input.webm";

    const outputName =
        "output.mp4";

    console.log(
        "[FFmpeg] Menulis input.webm..."
    );

    const inputData =
        new Uint8Array(
            await webmBlob.arrayBuffer()
        );

    console.log(
        "[FFmpeg] Input size:",
        inputData.byteLength,
        "bytes"
    );

    await ffmpeg.writeFile(
        inputName,
        inputData
    );

    console.log(
        "[FFmpeg] Input berhasil ditulis."
    );

    setProgress(
        5,
        "Mengonversi ke MP4..."
    );

    console.log(
        "[FFmpeg] Memulai konversi..."
    );

    /*
     * Command sengaja sederhana.
     *
     * Kita tidak menggunakan:
     * -preset
     * -crf
     *
     * untuk mengurangi kemungkinan
     * masalah encoder di perangkat tertentu.
     */
    const exitCode =
        await ffmpeg.exec(
            [
                "-i",
                inputName,
                outputName
            ],
            120000
        );

    console.log(
        "[FFmpeg] Exit code:",
        exitCode
    );

    if (exitCode !== 0) {
        throw new Error(
            `FFmpeg gagal melakukan konversi. Exit code: ${exitCode}`
        );
    }

    console.log(
        "[FFmpeg] Membaca output.mp4..."
    );

    const data =
        await ffmpeg.readFile(
            outputName
        );

    console.log(
        "[FFmpeg] Output size:",
        data.length,
        "bytes"
    );

    if (!data.length) {
        throw new Error(
            "FFmpeg menghasilkan file MP4 kosong."
        );
    }

    try {
        await ffmpeg.deleteFile(
            inputName
        );
    } catch (error) {
        console.warn(
            "[FFmpeg] Gagal menghapus input:",
            error
        );
    }

    try {
        await ffmpeg.deleteFile(
            outputName
        );
    } catch (error) {
        console.warn(
            "[FFmpeg] Gagal menghapus output:",
            error
        );
    }

    return new Blob(
        [data.buffer],
        {
            type: "video/mp4"
        }
    );
}


/* =========================================================
   DOWNLOAD BLOB
========================================================= */

function downloadBlob(
    blob,
    fileName
) {
    if (outputURL) {
        URL.revokeObjectURL(
            outputURL
        );
    }

    outputURL =
        URL.createObjectURL(blob);

    downloadLink.href =
        outputURL;

    downloadLink.download =
        fileName;

    downloadLink.hidden =
        false;

    /*
     * Download otomatis.
     */
    const link =
        document.createElement("a");

    link.href =
        outputURL;

    link.download =
        fileName;

    document.body.appendChild(
        link
    );

    link.click();

    link.remove();
}


/* =========================================================
   DOWNLOAD BUTTON
========================================================= */

downloadBtn.addEventListener(
    "click",
    async () => {

        if (!videoReady) {
            return;
        }

        downloadBtn.disabled =
            true;

        playBtn.disabled =
            true;

        resetBtn.disabled =
            true;

        downloadLink.hidden =
            true;

        progressBox.hidden =
            false;

        resetProgress();

        try {

            console.log(
                "================================"
            );

            console.log(
                "[Export] MULAI EXPORT"
            );

            console.log(
                "================================"
            );

            /*
             * Pastikan video tidak sedang
             * diputar sebagai preview.
             */
            stopVideoRendering();

            sourceVideo.pause();

            isPlaying = false;

            playBtn.textContent =
                "▶ Lihat Preview";

            /*
             * STEP 1:
             * Rekam Canvas → WebM.
             */
            setProgress(
                1,
                "Menyiapkan video..."
            );

            const webmBlob =
                await recordCanvas();

            console.log(
                "[Export] WebM selesai."
            );

            console.log(
                "[Export] WebM size:",
                webmBlob.size,
                "bytes"
            );

            if (
                !webmBlob ||
                !webmBlob.size
            ) {
                throw new Error(
                    "Video WebM hasil recording kosong."
                );
            }

            /*
             * STEP 2:
             * Load FFmpeg.
             */
            setProgress(
                4,
                "Menyiapkan mesin video..."
            );

            await loadFFmpeg();

            /*
             * STEP 3:
             * WebM → MP4.
             */
            setProgress(
                5,
                "Mengonversi ke MP4..."
            );

            const mp4Blob =
                await convertToMP4(
                    webmBlob
                );

            console.log(
                "[Export] MP4 selesai."
            );

            console.log(
                "[Export] MP4 size:",
                mp4Blob.size,
                "bytes"
            );

            if (
                !mp4Blob ||
                !mp4Blob.size
            ) {
                throw new Error(
                    "File MP4 kosong."
                );
            }

            /*
             * STEP 4:
             * Download MP4.
             */
            setProgress(
                96,
                "Menyiapkan file..."
            );

            downloadBlob(
                mp4Blob,
                "mustika-pradapati-ke-IV.mp4"
            );

            setProgress(
                100,
                "Video selesai!"
            );

            console.log(
                "================================"
            );

            console.log(
                "[Export] EXPORT BERHASIL"
            );

            console.log(
                "================================"
            );

        } catch (error) {

            console.error(
                "================================"
            );

            console.error(
                "[Export] GAGAL:",
                error
            );

            console.error(
                "================================"
            );

            /*
             * Kalau FFmpeg gagal, kita tidak
             * langsung membuang WebM karena
             * WebM bisa saja sebenarnya sudah
             * berhasil direkam dengan durasi benar.
             *
             * Untuk sekarang error ditampilkan
             * agar kita bisa melihat masalah
             * Android secara jelas.
             */
            progressText.textContent =
                "Gagal memproses video.";

            progressPct.textContent =
                "0%";

            alert(
                "Video gagal diproses.\n\n" +
                "Silakan coba lagi. Jika masih gagal, kirim screenshot Console."
            );

        } finally {

            exportRendering =
                false;

            stopExportRendering();

            stopVideoRendering();

            downloadBtn.disabled =
                false;

            playBtn.disabled =
                false;

            resetBtn.disabled =
                false;

            if (
                !sourceVideo.paused
            ) {
                sourceVideo.pause();
            }

            drawCanvas();
        }
    }
);


/* =========================================================
   CLEANUP
========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        stopVideoRendering();

        stopExportRendering();

        if (videoURL) {
            URL.revokeObjectURL(
                videoURL
            );
        }

        if (outputURL) {
            URL.revokeObjectURL(
                outputURL
            );
        }
    }
);


/* =========================================================
   INITIAL DRAW
========================================================= */

drawCanvas();
