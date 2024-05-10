let mediaRecorder;
let audioChunks = [];
let videoElement = document.getElementById('camera-stream');
let recordBtn = document.getElementById('record-btn');
let copyLogBtn = document.getElementById('copy-log-btn');
let downloadLink = document.getElementById('download-link');
let log = [];

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: true
        });
        videoElement.srcObject = stream;
        videoElement.play();
        setupRecorder(stream.getAudioTracks());
    } catch (error) {
        console.error('Error accessing media devices:', error);
        alert('Please check your device settings and permissions. Error: ' + error.message);
    }
});

function setupRecorder(audioTracks) {
    let audioStream = new MediaStream(audioTracks);
    mediaRecorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' });

    mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) {
            audioChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        downloadLink.href = audioUrl;
        downloadLink.download = 'recording.webm';
        downloadLink.textContent = 'Download Recording';
        downloadLink.style.display = 'block';
        audioChunks = []; // Clear the recorded chunks
    };
}

recordBtn.addEventListener('click', toggleRecording);

function toggleRecording() {
    if (mediaRecorder.state === 'inactive') {
        mediaRecorder.start();
        recordBtn.textContent = 'Stop Recording';
    } else {
        mediaRecorder.stop();
        recordBtn.textContent = 'Record';
    }
}

copyLogBtn.addEventListener('click', () => {
    const logOutput = document.getElementById('log-output');
    logOutput.textContent = JSON.stringify(log, null, 2);
    logOutput.select();
    document.execCommand('copy');
    alert('Copied JSON to clipboard!');
});

document.getElementById('poi-btn').addEventListener('click', () => logEvent('POI'));
document.getElementById('photo-note-btn').addEventListener('click', () => logEvent('Note'));

function logEvent(eventType) {
    const timestamp = new Date().toISOString();
    log.push({ event: eventType, timestamp });
    const logOutput = document.getElementById('log-output');
    logOutput.textContent = JSON.stringify(log, null, 2);
}
