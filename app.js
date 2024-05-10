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

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
        videoElement.srcObject = stream;

        let options = { mimeType: 'audio/webm' };
        if (MediaRecorder.isTypeSupported(options.mimeType)) {
            mediaRecorder = new MediaRecorder(stream, options);
        } else {
            mediaRecorder = new MediaRecorder(stream);
        }

        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            const au
