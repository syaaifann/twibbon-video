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
let exportRendering = false;

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

/* =========================================================
   VIDEO FRAME RENDERING
========================================================= */

function stopVideoRendering() {
    if (renderFrameId !== null) {
        cancelAnimationFrame(
            renderFrameId
        );

        renderFrameId = null;
    }
}

function renderVideoFrame() {
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
            renderVideoFrame
        );
}

function startVideoRendering() {
    stopVideoRendering();

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
   OVERLAY
========================================================= */

overlayImage.onload = () => {
    drawCanvas();
};

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
            !file.type.startsWith(
                "video/"
            )
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

                setTimeout(() => {
                    stageHint.hidden =
                        true;
                }, 2500);
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
   PREVIEW
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

        sourceVideo.currentTime = 0;

        try {
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
   FFmpeg BLOB
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
   AUDIO TRACK
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

        const audioTracks =
            stream.getAudioTracks();

        console.log(
            "[Audio] Audio tracks:",
            audioTracks.length
        );

        return audioTracks;

    } catch (error) {
        console.warn(
            "[Audio] Gagal mengambil audio:",
            error
        );

        return [];
    }
}

/* =========================================================
   MIME TYPE
========================================================= */

function getSupportedMimeType() {

    /*
     * Prioritas pertama:
     * MP4 langsung.
     */
    const mp4Types = [
        "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
        "video/mp4;codecs=avc1,mp4a.40.2",
        "video/mp4"
    ];

    for (const type of mp4Types) {
        if (
            MediaRecorder.isTypeSupported(
                type
            )
        ) {
            console.log(
                "[Export] MP4 langsung didukung:",
                type
            );

            return {
                mimeType: type,
                extension: "mp4",
                needsFFmpeg: false
            };
        }
    }

    /*
     * Jika MP4 tidak tersedia,
     * gunakan WebM.
     */
    const webmTypes = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm"
    ];

    for (const type of webmTypes) {
        if (
            MediaRecorder.isTypeSupported(
                type
            )
        ) {
            console.log(
                "[Export] Menggunakan WebM:",
                type
            );

            return {
                mimeType: type,
                extension: "webm",
                needsFFmpeg: true
            };
        }
    }

    return null;
}

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
   RECORD CANVAS
========================================================= */

async function recordCanvas() {
    return new Promise(
        async (resolve, reject) => {

            let recorder = null;
            let canvasStream = null;

            try {
                const format =
                    getSupportedMimeType();

                if (!format) {
                    reject(
                        new Error(
                            "Browser tidak mendukung format video yang diperlukan."
                        )
                    );

                    return;
                }

                canvasStream =
                    canvas.captureStream(
                        EXPORT_FPS
                    );

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
                    canvasStream.getVideoTracks()
                        .length
                );

                console.log(
                    "[Export] Audio tracks:",
                    canvasStream.getAudioTracks()
                        .length
                );

                console.log(
                    "[Export] MIME:",
                    format.mimeType
                );

                const chunks = [];

                /*
                 * Bitrate diturunkan dari 8 Mbps
                 * menjadi 5 Mbps agar lebih ringan.
                 */
                recorder =
                    new MediaRecorder(
                        canvasStream,
                        {
                            mimeType:
                                format.mimeType,

                            videoBitsPerSecond:
                                5000000,

                            audioBitsPerSecond:
                                128000
                        }
                    );

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

                        reject(
                            event.error ||
                            new Error(
                                "MediaRecorder gagal."
                            )
                        );
                    };

                recorder.onstop =
                    () => {
                        console.log(
                            "[Export] Recording selesai."
                        );

                        const blob =
                            new Blob(
                                chunks,
                                {
                                    type:
                                        format.mimeType
                                }
                            );

                        if (canvasStream) {
                            canvasStream
                                .getTracks()
                                .forEach(
                                    track => {
                                        track.stop();
                                    }
                                );
                        }

                        resolve({
                            blob,
                            format
                        });
                    };

                exportRendering = true;

                stopVideoRendering();

                sourceVideo.pause();

                sourceVideo.currentTime = 0;

                await wait(150);

                drawCanvas();

                recorder.start(250);

                console.log(
                    "[Export] Recording dimulai."
                );

                await sourceVideo.play();

                const duration =
                    Math.min(
                        sourceVideo.duration ||
                            MAX_DURATION,
                        MAX_DURATION
                    );

                const startTime =
                    performance.now();

                /*
                 * Render video terus-menerus
                 * mengikuti refresh browser.
                 */
                const exportLoop =
                    () => {

                        if (
                            !exportRendering ||
                            recorder.state !==
                                "recording"
                        ) {
                            return;
                        }

                        drawCanvas();

                        const elapsed =
                            (
                                performance.now() -
                                startTime
                            ) / 1000;

                        const progress =
                            Math.min(
                                4.5,
                                (
                                    elapsed /
                                    duration
                                ) * 4.5
                            );

                        setProgress(
                            progress,
                            "Merekam hasil video..."
                        );

                        requestAnimationFrame(
                            exportLoop
                        );
                    };

                exportLoop();

                const finishRecording =
                    () => {

                        if (
                            recorder &&
                            recorder.state ===
                                "recording"
                        ) {
                            exportRendering =
                                false;

                            sourceVideo.pause();

                            recorder.stop();
                        }
                    };

                const endedHandler =
                    () => {
                        finishRecording();
                    };

                sourceVideo.addEventListener(
                    "ended",
                    endedHandler,
                    {
                        once: true
                    }
                );

                /*
                 * Pengaman jika event ended
                 * tidak dipanggil di Android.
                 */
                setTimeout(
                    () => {
                        finishRecording();
                    },
                    (
                        duration +
                        1
                    ) * 1000
                );

            } catch (error) {

                exportRendering =
                    false;

                if (canvasStream) {
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
   FFMPEG CONVERSION
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

    await ffmpeg.writeFile(
        inputName,
        new Uint8Array(
            await webmBlob.arrayBuffer()
        )
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
        "[FFmpeg] Output berhasil dibaca."
    );

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
   MAIN DOWNLOAD
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
                "[Export] Memulai proses export..."
            );

            /*
             * Cek format yang bisa direkam
             * langsung oleh browser.
             */
            const format =
                getSupportedMimeType();

            if (!format) {
                throw new Error(
                    "Browser tidak mendukung perekaman video."
                );
            }

            /*
             * Rekam canvas.
             */
            setProgress(
                1,
                "Menyiapkan video..."
            );

            const recorded =
                await recordCanvas();

            const recordedBlob =
                recorded.blob;

            const recordedFormat =
                recorded.format;

            console.log(
                "[Export] Hasil recording:",
                recordedBlob.size,
                "bytes"
            );

            console.log(
                "[Export] Format:",
                recordedFormat.mimeType
            );

            if (
                !recordedBlob ||
                !recordedBlob.size
            ) {
                throw new Error(
                    "Video hasil rekaman kosong."
                );
            }

            /*
             * Kalau browser bisa langsung
             * membuat MP4, tidak perlu FFmpeg.
             */
            if (
                !recordedFormat.needsFFmpeg &&
                recordedFormat.extension ===
                    "mp4"
            ) {

                console.log(
                    "[Export] MP4 berhasil dibuat langsung oleh browser."
                );

                setProgress(
                    95,
                    "Menyiapkan file MP4..."
                );

                downloadBlob(
                    recordedBlob,
                    "mustika-pradapati-ke-IV.mp4"
                );

                setProgress(
                    100,
                    "Video selesai!"
                );

                console.log(
                    "[Export] Semua proses selesai tanpa FFmpeg."
                );

                return;
            }

            /*
             * Kalau browser menghasilkan WebM,
             * coba FFmpeg.
             */
            console.log(
                "[Export] Browser menghasilkan WebM."
            );

            console.log(
                "[Export] Memuat FFmpeg..."
            );

            setProgress(
                4,
                "Menyiapkan mesin video..."
            );

            await loadFFmpeg();

            setProgress(
                5,
                "Mengonversi ke MP4..."
            );

            try {

                const mp4Blob =
                    await convertToMP4(
                        recordedBlob
                    );

                console.log(
                    "[Export] MP4 selesai:",
                    mp4Blob.size,
                    "bytes"
                );

                if (
                    !mp4Blob.size
                ) {
                    throw new Error(
                        "File MP4 kosong."
                    );
                }

                downloadBlob(
                    mp4Blob,
                    "mustika-pradapati-ke-IV.mp4"
                );

                setProgress(
                    100,
                    "Video selesai!"
                );

                console.log(
                    "[Export] Semua proses selesai."
                );

            } catch (ffmpegError) {

                /*
                 * FALLBACK:
                 * Kalau Android tidak kuat
                 * menjalankan FFmpeg,
                 * jangan membuat pengguna
                 * kehilangan videonya.
                 */
                console.error(
                    "[FFmpeg] Konversi gagal:",
                    ffmpegError
                );

                console.log(
                    "[Fallback] Menggunakan WebM."
                );

                downloadBlob(
                    recordedBlob,
                    "mustika-pradapati-ke-IV.webm"
                );

                setProgress(
                    100,
                    "Video selesai dalam format WebM."
                );

                alert(
                    "Perangkat ini tidak cukup kuat untuk konversi MP4 di browser.\n\n" +
                    "Video tetap berhasil dibuat dan disimpan dalam format WebM."
                );
            }

        } catch (error) {

            console.error(
                "[Export] GAGAL:",
                error
            );

            progressText.textContent =
                "Gagal memproses video.";

            progressPct.textContent =
                "0%";

            alert(
                "Video gagal diproses.\n\n" +
                "Coba lagi dengan video yang lebih pendek atau lihat Console untuk detail error."
            );

        } finally {

            exportRendering =
                false;

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

            stopVideoRendering();

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
