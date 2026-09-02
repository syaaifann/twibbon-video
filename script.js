const videoInput = document.getElementById("videoInput");
const uploadCard = document.getElementById("uploadCard");
const editor = document.getElementById("editor");
const uploadError = document.getElementById("uploadError");

const stage = document.getElementById("stage");
const canvas = document.getElementById("previewCanvas");
const ctx = canvas.getContext("2d");

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

let ffmpeg = null;
let ffmpegLoaded = false;

const MAX_DURATION = 30;

function showError(message) {
    uploadError.textContent = message;
    uploadError.hidden = false;
}

function clearError() {
    uploadError.textContent = "";
    uploadError.hidden = true;
}

function setProgress(percent, text) {
    const value = Math.max(0, Math.min(100, percent));

    progressPct.textContent = `${Math.round(value)}%`;
    progressBar.style.width = `${value}%`;

    if (text) {
        progressText.textContent = text;
    }
}

function resetProgress() {
    setProgress(0, "Menyiapkan...");
}

function resetEditor() {
    scale = 1;
    offsetX = 0;
    offsetY = 0;

    zoom.value = 100;
    zoomValue.textContent = "100%";

    drawCanvas();
}

function getCoverScale() {
    if (!sourceVideo.videoWidth || !sourceVideo.videoHeight) {
        return 1;
    }

    const canvasRatio = canvas.width / canvas.height;
    const videoRatio = sourceVideo.videoWidth / sourceVideo.videoHeight;

    if (videoRatio > canvasRatio) {
        return canvas.height / sourceVideo.videoHeight;
    }

    return canvas.width / sourceVideo.videoWidth;
}

function drawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (videoReady) {
        const baseScale = getCoverScale();
        const finalScale = baseScale * scale;

        const drawWidth = sourceVideo.videoWidth * finalScale;
        const drawHeight = sourceVideo.videoHeight * finalScale;

        const x = (canvas.width - drawWidth) / 2 + offsetX;
        const y = (canvas.height - drawHeight) / 2 + offsetY;

        ctx.drawImage(
            sourceVideo,
            x,
            y,
            drawWidth,
            drawHeight
        );
    }

    if (overlayImage.complete && overlayImage.naturalWidth > 0) {
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

videoInput.addEventListener("change", () => {
    clearError();

    const file = videoInput.files[0];

    if (!file) {
        return;
    }

    if (!file.type.startsWith("video/")) {
        showError("File yang dipilih bukan video.");
        videoInput.value = "";
        return;
    }

    if (videoURL) {
        URL.revokeObjectURL(videoURL);
    }

    videoURL = URL.createObjectURL(file);

    sourceVideo.src = videoURL;
    sourceVideo.load();

    sourceVideo.onloadedmetadata = () => {
        if (sourceVideo.duration > MAX_DURATION) {
            showError(
                `Durasi video terlalu panjang. Maksimal ${MAX_DURATION} detik.`
            );

            sourceVideo.removeAttribute("src");
            sourceVideo.load();
            videoReady = false;
            return;
        }

        videoReady = true;

        uploadCard.hidden = true;
        editor.hidden = false;

        resetEditor();
        drawCanvas();

        stageHint.hidden = false;

        setTimeout(() => {
            stageHint.hidden = true;
        }, 2500);
    };

    sourceVideo.onerror = () => {
        showError("Video tidak dapat dibaca oleh browser.");
        videoReady = false;
    };
});

zoom.addEventListener("input", () => {
    scale = Number(zoom.value) / 100;

    zoomValue.textContent = `${zoom.value}%`;

    drawCanvas();
});

resetBtn.addEventListener("click", () => {
    resetEditor();
});

function getPointerPosition(event) {
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
        x: event.clientX * scaleX - rect.left * scaleX,
        y: event.clientY * scaleY - rect.top * scaleY
    };
}

canvas.addEventListener("pointerdown", (event) => {
    if (!videoReady) {
        return;
    }

    dragging = true;

    lastPointerX = event.clientX;
    lastPointerY = event.clientY;

    canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
    if (!dragging) {
        return;
    }

    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const dx = (event.clientX - lastPointerX) * scaleX;
    const dy = (event.clientY - lastPointerY) * scaleY;

    offsetX += dx;
    offsetY += dy;

    lastPointerX = event.clientX;
    lastPointerY = event.clientY;

    drawCanvas();
});

canvas.addEventListener("pointerup", (event) => {
    dragging = false;

    try {
        canvas.releasePointerCapture(event.pointerId);
    } catch (error) {
        // Tidak masalah jika pointer capture sudah dilepas.
    }
});

canvas.addEventListener("pointercancel", () => {
    dragging = false;
});

playBtn.addEventListener("click", async () => {
    if (!videoReady) {
        return;
    }

    if (isPlaying) {
        sourceVideo.pause();
        isPlaying = false;
        playBtn.textContent = "▶ Lihat Preview";
        drawCanvas();
        return;
    }

    sourceVideo.currentTime = 0;

    try {
        await sourceVideo.play();

        isPlaying = true;
        playBtn.textContent = "⏸ Pause Preview";
    } catch (error) {
        console.error("[Preview]", error);
    }
});

sourceVideo.addEventListener("play", () => {
    isPlaying = true;
    playBtn.textContent = "⏸ Pause Preview";
});

sourceVideo.addEventListener("pause", () => {
    isPlaying = false;
    playBtn.textContent = "▶ Lihat Preview";
});

sourceVideo.addEventListener("ended", () => {
    isPlaying = false;
    playBtn.textContent = "▶ Lihat Preview";
    drawCanvas();
});

sourceVideo.addEventListener("timeupdate", () => {
    if (isPlaying) {
        drawCanvas();
    }
});

async function createBlobURL(url, mimeType) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(
            `Gagal mengambil file FFmpeg: ${response.status}`
        );
    }

    const blob = await response.blob();

    return URL.createObjectURL(
        new Blob([blob], { type: mimeType })
    );
}

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

    console.log("[FFmpeg] Memulai loading...");

    ffmpeg = new window.FFmpegWASM.FFmpeg();

    ffmpeg.on("log", ({ message }) => {
        console.log("[FFmpeg]", message);
    });

    ffmpeg.on("progress", ({ progress }) => {
        const percent = Math.max(
            5,
            Math.min(95, progress * 100)
        );

        setProgress(
            percent,
            "Mengonversi ke MP4..."
        );
    });

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

    const coreURL = await createBlobURL(
        `${baseURL}/ffmpeg-core.js`,
        "text/javascript"
    );

    const wasmURL = await createBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm"
    );

    console.log("[FFmpeg] Core berhasil diambil.");

    await ffmpeg.load({
        coreURL,
        wasmURL
    });

    URL.revokeObjectURL(coreURL);
    URL.revokeObjectURL(wasmURL);

    ffmpegLoaded = true;

    console.log("[FFmpeg] Berhasil dimuat.");
}

function getVideoAudioTracks() {
    try {
        if (
            typeof sourceVideo.captureStream !== "function"
        ) {
            console.warn(
                "[Audio] captureStream tidak tersedia."
            );

            return [];
        }

        const stream = sourceVideo.captureStream();

        const audioTracks = stream.getAudioTracks();

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

function getSupportedMimeType() {
    const types = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm"
    ];

    for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
            return type;
        }
    }

    return "";
}

function wait(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

async function recordCanvas() {
    return new Promise(async (resolve, reject) => {
        try {
            const canvasStream = canvas.captureStream(30);

            const audioTracks = getVideoAudioTracks();

            audioTracks.forEach(track => {
                canvasStream.addTrack(track);
            });

            console.log(
                "[Export] Video tracks:",
                canvasStream.getVideoTracks().length
            );

            console.log(
                "[Export] Audio tracks:",
                canvasStream.getAudioTracks().length
            );

            const mimeType = getSupportedMimeType();

            if (!mimeType) {
                reject(
                    new Error(
                        "Browser tidak mendukung perekaman WebM."
                    )
                );

                return;
            }

            console.log(
                "[Export] MIME:",
                mimeType
            );

            const chunks = [];

            const recorder = new MediaRecorder(
                canvasStream,
                {
                    mimeType,
                    videoBitsPerSecond: 8000000
                }
            );

            recorder.ondataavailable = event => {
                if (
                    event.data &&
                    event.data.size > 0
                ) {
                    chunks.push(event.data);
                }
            };

            recorder.onerror = event => {
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

            recorder.onstop = () => {
                console.log(
                    "[Export] Recording selesai."
                );

                const blob = new Blob(
                    chunks,
                    {
                        type: mimeType
                    }
                );

                canvasStream
                    .getTracks()
                    .forEach(track => {
                        track.stop();
                    });

                resolve(blob);
            };

            sourceVideo.pause();
            sourceVideo.currentTime = 0;

            drawCanvas();

            await wait(100);

            sourceVideo.play();

            recorder.start(250);

            console.log(
                "[Export] Recording dimulai."
            );

            const duration =
                Math.min(
                    sourceVideo.duration || MAX_DURATION,
                    MAX_DURATION
                );

            const startTime = performance.now();

            const updateRecordingProgress = () => {
                if (
                    recorder.state !== "recording"
                ) {
                    return;
                }

                const elapsed =
                    (performance.now() - startTime) /
                    1000;

                const progress =
                    Math.min(
                        4.5,
                        (elapsed / duration) * 4.5
                    );

                setProgress(
                    progress,
                    "Merekam hasil video..."
                );

                requestAnimationFrame(
                    updateRecordingProgress
                );
            };

            updateRecordingProgress();

            sourceVideo.onended = () => {
                if (
                    recorder.state === "recording"
                ) {
                    recorder.stop();
                }
            };

            setTimeout(() => {
                if (
                    recorder.state === "recording"
                ) {
                    sourceVideo.pause();
                    recorder.stop();
                }
            }, (duration + 0.5) * 1000);

        } catch (error) {
            reject(error);
        }
    });
}

async function convertToMP4(webmBlob) {
    const inputName = "input.webm";
    const outputName = "output.mp4";

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

    /*
     * Untuk sementara gunakan command paling sederhana.
     * Setelah ini berhasil, konfigurasi H.264 + AAC
     * bisa ditambahkan kembali jika diperlukan.
     */
    const exitCode = await ffmpeg.exec(
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

    const data = await ffmpeg.readFile(
        outputName
    );

    console.log(
        "[FFmpeg] Output berhasil dibaca."
    );

    try {
        await ffmpeg.deleteFile(inputName);
    } catch (error) {
        console.warn(
            "[FFmpeg] Gagal menghapus input:",
            error
        );
    }

    try {
        await ffmpeg.deleteFile(outputName);
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

downloadBtn.addEventListener("click", async () => {
    if (!videoReady) {
        return;
    }

    downloadBtn.disabled = true;
    playBtn.disabled = true;
    resetBtn.disabled = true;

    downloadLink.hidden = true;

    progressBox.hidden = false;

    resetProgress();

    try {
        console.log(
            "[Export] Memulai proses export..."
        );

        await loadFFmpeg();

        setProgress(
            2,
            "Menyiapkan video..."
        );

        const webmBlob =
            await recordCanvas();

        console.log(
            "[Export] WebM selesai:",
            webmBlob.size,
            "bytes"
        );

        if (!webmBlob.size) {
            throw new Error(
                "Video hasil rekaman kosong."
            );
        }

        setProgress(
            5,
            "Mengonversi ke MP4..."
        );

        const mp4Blob =
            await convertToMP4(
                webmBlob
            );

        console.log(
            "[Export] MP4 selesai:",
            mp4Blob.size,
            "bytes"
        );

        if (!mp4Blob.size) {
            throw new Error(
                "File MP4 kosong."
            );
        }

        if (outputURL) {
            URL.revokeObjectURL(
                outputURL
            );
        }

        outputURL =
            URL.createObjectURL(
                mp4Blob
            );

        const fileName =
            "mustika-pradapati-ke-IV.mp4";

        downloadLink.href =
            outputURL;

        downloadLink.download =
            fileName;

        downloadLink.hidden =
            false;

        setProgress(
            100,
            "Video selesai!"
        );

        progressPct.textContent =
            "100%";

        console.log(
            "[Export] Semua proses selesai."
        );

        /*
         * Coba download otomatis.
         */
        const link =
            document.createElement("a");

        link.href = outputURL;
        link.download = fileName;

        document.body.appendChild(link);

        link.click();

        link.remove();

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
            "Coba lihat Console (F12) untuk detail error."
        );

    } finally {
        downloadBtn.disabled = false;
        playBtn.disabled = false;
        resetBtn.disabled = false;
    }
});

window.addEventListener("beforeunload", () => {
    if (videoURL) {
        URL.revokeObjectURL(videoURL);
    }

    if (outputURL) {
        URL.revokeObjectURL(outputURL);
    }
});

drawCanvas();
