let mediaRecorder;
let audioChunks = [];
let videoElement = document.getElementById('camera-stream');
let recordBtn = document.getElementById('record-btn');
let logOutput = document.getElementById('log-output');
let copyLogBtn = document.getElementById('copy-log-btn');
let downloadLink = document.getElementById('download-link');
let recording = false;
let log = [];

navigator.mediaDevices.enumerateDevices()
    .then(devices => {
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        const rearCamera = videoDevices.find(device => !device.label.toLowerCase().includes('front'));

        const constraints = { audio: { sampleRate: 44100, channelCount: 2 } }; // Adjust for quality
        if (rearCamera) {
            constraints.video = { deviceId: { exact: rearCamera.deviceId } };
        } else {
            constraints.video = true;
        }

        return navigator.mediaDevices.getUserMedia(constraints);
    })
    .then(stream => {
        // Mute audio to prevent echo
        stream.getAudioTracks().forEach(track => track.enabled = false);

        videoElement.srcObject = stream;
        videoElement.play();

        mediaRecorder = new MediaRecorder(stream.getAudioTracks()[0], {
            mimeType: 'audio/webm;codecs=opus' // Opus codec for smaller size
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
            downloadLink.download = 'recording.webm';
            downloadLink.textContent = 'Download Recording';
            downloadLink.style.display = 'block';
            audioChunks = [];
        };
    })
    .catch(error => {
        let message = 'Failed to access media devices.';
        if (error.name === 'NotAllowedError') {
            message = 'Please grant permission to access camera and microphone.';
        } else if (error.name === 'NotFoundError') {
            message = 'No camera or microphone found.';
        }
        console.error('Error accessing media devices:', error);
        alert(message);
    });


recordBtn.addEventListener('click', () => {
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
