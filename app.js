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
            audio: { sampleRate: 44100, channelCount: 2 },
            video: { deviceId: { exact: rearCameraId } } // Get rearCameraId from enumerateDevices if available
        });

        // Mute audio to prevent echo
        stream.getAudioTracks().forEach(track => track.enabled = false);

        videoElement.srcObject = stream;
        videoElement.play();

        mediaRecorder = new MediaRecorder(stream.getAudioTracks()[0], {
            mimeType: 'audio/mpeg'
        });

        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
            const audioUrl = URL.createObjectURL(audioBlob);
            downloadLink.href = audioUrl;
            downloadLink.download = 'recording.mp3'; 
            downloadLink.textContent = 'Download Recording';
            downloadLink.style.display = 'block';
            audioChunks = [];
        };

        mediaRecorder.start();
        recordBtn.textContent = 'Stop Recording';
        recording = true;

    } catch (error) {
        let message = 'Failed to access media devices.';
        if (error.name === 'NotAllowedError') {
            message = 'Please grant permission to access camera and microphone.';
        } else if (error.name === 'NotFoundError') {
            message = 'No camera or microphone found.';
        }
        console.error('Error accessing media devices:', error);
        alert(message);
    }
}

recordBtn.addEventListener('click', () => {
    if (!recording) {
        startRecording();
    } else {
        mediaRecorder.stop();
        recordBtn.textContent = 'Start Recording';
        recording = false;
    }
});

          

    
    
  
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
