let mediaRecorder;
let audioChunks = [];
let videoElement = document.getElementById('camera-stream');
let recordBtn = document.getElementById('record-btn');
let copyLogBtn = document.getElementById('copy-log-btn');
let downloadLink = document.getElementById('download-link');
let log = [];

document.addEventListener('DOMContentLoaded', () => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true })
        .then(stream => {
            videoElement.srcObject = stream;
            videoElement.play();
            setupRecorder(stream);
        })
        .catch(error => {
            console.error('Error accessing media devices:', error);
            alert('Please check your device settings and permissions.');
        });
});

function setupRecorder(stream) {
    let audioStream = new MediaStream(stream.getAudioTracks());
    mediaRecorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' });
    mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
    mediaRecorder.onstop = () => handleRecordingStop();
}

function handleRecordingStop() {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const audioUrl = URL.createObjectURL(audioBlob);
    downloadLink.href = audioUrl;
    downloadLink.download = 'recording.webm';
    downloadLink.textContent = 'Download Recording';
    downloadLink.style.display = 'block';
    audioChunks = []; // Clear audio data
}

recordBtn.addEventListener('click', () => {
    if (mediaRecorder.state === 'inactive') {
        mediaRecorder.start();
        recordBtn.textContent = 'Stop Recording';
    } else {
        mediaRecorder.stop();
        recordBtn.textContent = 'Record';
    }
});

copyLogBtn.addEventListener('click', () => {
    const logOutput = document.getElementById('log-output');
    logOutput.textContent = JSON.stringify(log, null, 2);
    logOutput.select();
    document.execCommand('copy');
    alert('Copied JSON to clipboard!');
});

function logEvent(eventType) {
    const timestamp = new Date().toISOString();
    log.push({ event: eventType, timestamp });
    updateLogDisplay();
}

function updateLogDisplay() {
    const logOutput = document.getElementById('log-output
