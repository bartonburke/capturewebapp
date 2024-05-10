let mediaRecorder;
let audioChunks = [];
let log = [];
let recording = false;

const videoElement = document.getElementById('camera-stream');
const recordBtn = document.getElementById('record-btn');
const copyLogBtn = document.getElementById('copy-log-btn');
const downloadLink = document.getElementById('download-link');
const logOutput = document.getElementById('log-output');
const poiBtn = document.getElementById('poi-btn');
const noteBtn = document.getElementById('photo-note-btn');

document.addEventListener('DOMContentLoaded', () => {
    setupMedia();
    setupEventListeners();
});

async function setupMedia() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: true  // Assuming you still need to capture audio for recording
        });
        videoElement.srcObject = stream;
        videoElement.play();

        // Mute each audio track to prevent playback through speakers
        stream.getAudioTracks().forEach(track => track.enabled = false);

        setupRecorder(stream.getAudioTracks());
    } catch (error) {
        console.error('Error accessing media devices:', error);
        alert('Error: ' + error.message);
    }
}

function getSupportedMimeType() {
    const types = [
        'audio/webm; codecs=opus',
        'audio/webm',
        'audio/ogg',
        'audio/mp4'
    ];
    return types.find(type => MediaRecorder.isTypeSupported(type)) || null;
}

function setupEventListeners() {
    recordBtn.addEventListener('click', toggleRecording);
    poiBtn.addEventListener('click', () => logEvent('POI'));
    noteBtn.addEventListener('click', () => logEvent('Note'));
    copyLogBtn.addEventListener('click', copyLogToClipboard);
}

function toggleRecording() {
    if (!recording && mediaRecorder) {
        mediaRecorder.start();
        recordBtn.textContent = 'Stop Recording';
        logEvent('Recording started');
        recording = true;
    } else if (recording && mediaRecorder) {
        mediaRecorder.stop();
        recordBtn.textContent = 'Start Recording';
        logEvent('Recording stopped');
        recording = false;
    }
}

function handleRecordingStop() {
    const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
    const audioUrl = URL.createObjectURL(audioBlob);
    downloadLink.href = audioUrl;
    downloadLink.download = 'recording.' + mediaRecorder.mimeType.split('/')[1].split(';')[0];
    downloadLink.textContent = 'Download Recording';
    downloadLink.style.display = 'block';
    audioChunks = [];
}

function logEvent(eventType) {
    const timestamp = new Date().toISOString();
    log.push({ event: eventType, timestamp });
    updateLogDisplay();
}

function updateLogDisplay() {
    logOutput.textContent = JSON.stringify(log, null, 2);
}

function copyLogToClipboard() {
    logOutput.select();
    document.execCommand('copy');
    alert('Copied JSON to clipboard!');
}
