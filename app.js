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
    let recordingStartTime;

    async function setupMedia() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
                audio: true  // Ensure audio is also requested
            });
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
            recordingStartTime = new Date();  // Capture the start time
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
        const mimeType = mediaRecorder.mimeType.split('/')[1].split(';')[0];
        const formattedTime = recordingStartTime.toISOString().replace(/:/g, '-').split('.')[0];
        const filename = `recording_${formattedTime}.${mimeType}`;
        
        const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);
        downloadLink.href = audioUrl;
        downloadLink.download = filename;
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
