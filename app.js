
document.addEventListener('DOMContentLoaded', () => {
    const videoElement = document.getElementById('camera-stream');
    const recordBtn = document.getElementById('record-btn');
    const copyLogBtn = document.getElementById('copy-log-btn');
    const downloadLink = document.getElementById('download-link');
    const logOutput = document.getElementById('log-output');
    const poiBtn = document.getElementById('poi-btn');
    const noteBtn = document.getElementById('note-btn');
    let mediaRecorder;
    let audioChunks = [];
    let log = [];
    let recording = false;

    async function setupMedia() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
                audio: true
            });
            videoElement.srcObject = stream;
            videoElement.play();
            const audioStream = new MediaStream(stream.getAudioTracks());
            stream.getAudioTracks().forEach(track => track.enabled = false);

            const mimeType = getSupportedMimeType();
            if (!mimeType) {
                throw new Error('No supported MIME type found.');
            }
            mediaRecorder = new MediaRecorder(audioStream, { mimeType });
            mediaRecorder.ondataavailable = event => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };
            mediaRecorder.onstop = handleRecordingStop;
        } catch (error) {
            console.error('Error accessing media devices:', error);
            alert('Error: ' + error.message);
        }
async function setupMedia() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }  // Request only video to simplify
        });
        const videoElement = document.getElementById('camera-stream');
        videoElement.srcObject = stream;
        videoElement.play();
        console.log('Camera access granted');
    } catch (error) {
        console.error('Error accessing media devices:', error);
        alert('Camera access error: ' + error.message);
    }
}


    function getSupportedMimeType() {
        const types = ['audio/webm; codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4'];
        return types.find(type => MediaRecorder.isTypeSupported(type)) || null;
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
        downloadLink.download = `recording.${mediaRecorder.mimeType.split('/')[1].split(';')[0]}`;
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
    recordBtn.addEventListener('click', toggleRecording);
    poiBtn.addEventListener('click', () => logEvent('POI'));
    noteBtn.addEventListener('click', () => logEvent('Note'));
    copyLogBtn.addEventListener('click', copyLogToClipboard);
    setupMedia();
});
