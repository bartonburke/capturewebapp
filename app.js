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
        // Request access to the camera and microphone
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: true
        });

        // Display the video stream in the video element
        videoElement.srcObject = stream;
        videoElement.play();
        videoElement.muted = true;  // Mute playback to avoid echo

        // Create a new MediaStream containing only the audio tracks from the original stream
        const audioStream = new MediaStream(stream.getAudioTracks());

        // Initialize the MediaRecorder with the audio-only stream
        mediaRecorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' });

        // Set up event handlers for when data is available and when recording stops
        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = handleRecordingStop;

        // Additional setup or handlers can go here
    } catch (error) {
        console.error('Error accessing media devices:', error);
        alert('Error: ' + error.message);
    }
}

function handleRecordingStop() {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const audioUrl = URL.createObjectURL(audioBlob);
    downloadLink.href = audioUrl;
    downloadLink.download = 'recording.webm';
    downloadLink.textContent = 'Download Recording';
    downloadLink.style.display = 'block';
    audioChunks = []; // Clear the recorded chunks
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
