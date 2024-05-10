let mediaRecorder;
let audioChunks = [];
let videoElement = document.getElementById('camera-stream');
let recordBtn = document.getElementById('record-btn');
let logOutput = document.getElementById('log-output');
let copyLogBtn = document.getElementById('copy-log-btn');
let downloadLink = document.getElementById('download-link');
let recording = false;
let log = [];

if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('getUserMedia not supported on this browser.');
    throw new Error('getUserMedia not supported on this browser.');
}

navigator.mediaDevices.getUserMedia({
    video: { facingMode: { exact: "environment" } }, // Request rear camera
    audio: true
})
.then(stream => {
    videoElement.srcObject = stream;
    videoElement.play();

    // Check if MediaRecorder is supported
    let options = { mimeType: 'audio/webm' };
    if (MediaRecorder.isTypeSupported(options.mimeType)) {
        mediaRecorder = new MediaRecorder(stream, options);
    } else {
        options = { mimeType: 'video/mp4' }; // fallback MIME type
        if (MediaRecorder.isTypeSupported(options.mimeType)) {
            mediaRecorder = new MediaRecorder(stream, options);
        } else {
            mediaRecorder = new MediaRecorder(stream); // default without MIME type
        }
    }

    mediaRecorder.ondataavailable = event => {
        audioChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);
        downloadLink.href = audioUrl;
        downloadLink.download = 'recording' + mediaRecorder.mimeType.split('/')[1];
        downloadLink.textContent = 'Download Recording';
        downloadLink.style.display = 'block';
        audioChunks = [];
    };
})
.catch(error => {
    console.error('Error accessing media devices:', error);
    alert('Failed to access camera or microphone. Please check your device settings.');
});


recordBtn.addEventListener('click', () => {
    if (!recording) {
        mediaRecorder.start();
        recordBtn.textContent = 'Stop Recording';
        recording = true;
    } else {
        mediaRecorder.stop();
        recordBtn.textContent = 'Start Recording';
        recording = false;
    }
});

copyLogBtn.addEventListener('click', () => {
    logOutput.select();
    document.execCommand('copy');
    alert('Copied to clipboard!');
});

function logEvent(event) {
    if (recording) {
        const timestamp = new Date();
        log.push({ event, timestamp: timestamp.toISOString() });
        logOutput.textContent = JSON.stringify(log, null, 2);
    }
}

document.getElementById('poi-btn').addEventListener('click', () => logEvent('POI'));
document.getElementById('photo-note-btn').addEventListener('click', () => logEvent('Note'));
