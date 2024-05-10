let mediaRecorder;
let audioChunks = [];
let videoElement = document.getElementById('camera-stream');
let recordBtn = document.getElementById('record-btn');
let logOutput = document.getElementById('log-output');
let copyLogBtn = document.getElementById('copy-log-btn');
let downloadLink = document.getElementById('download-link');
let recording = false;
let log = [];


async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: true, 
            video: { facingMode: 'environment' } 
        });

        // Mute audio to prevent echo
        stream.getAudioTracks().forEach(track => track.enabled = false);

        videoElement.srcObject = stream;
        videoElement.play();

        mediaRecorder = new MediaRecorder(stream.getAudioTracks()[0], {
            mimeType: 'audio/mpeg'
        });

        // ... rest of the code for ondataavailable and onstop is the same ...

    } catch (error) {
        let message = 'Failed to access microphone.'; 
        if (error.name === 'NotAllowedError') {
            message = 'Please grant permission to access microphone.';
        } else if (error.name === 'NotFoundError') {
            message = 'No microphone found.';
        }
        console.error('Error accessing media devices:', error);
        alert(message);
    }
}
    
  
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
