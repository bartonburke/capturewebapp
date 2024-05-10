let mediaRecorder;
let audioChunks = [];
let videoElement = document.getElementById('camera-stream');
let recordBtn = document.getElementById('record-btn');
let logOutput = document.getElementById('log-output');
let copyLogBtn = document.getElementById('copy-log-btn');
let downloadLink = document.getElementById('download-link');
let recording = false;
let log = [];

async function setupMedia() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: true
        });
        videoElement.srcObject = stream;
        videoElement.play();

        const audioStream = new MediaStream(stream.getAudioTracks());
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
            audioChunks = [];
        };

        recordBtn.addEventListener('click', toggleRecording);
    } catch (error) {
        console.error('Error accessing media devices:', error);
        alert('Please check your device settings and permissions.');
    }
}

function toggleRecording() {
    if (!recording) {
        mediaRecorder.start();
        recordBtn.textContent = 'Stop Recording';
        recording = true;
    } else {
        mediaRecorder.stop();
        recordBtn.textContent = 'Start Recording';
        recording = false;
    }
}

copyLogBtn.addEventListener('click', () => {
    logOutput.select();
    document.execCommand('copy');
    alert('Copied to clipboard!');
});

document.addEventListener('DOMContentLoaded', setupMedia);
