let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let log = [];
let startTime;

async function initCamera() {
    const video = document.getElementById('video');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'user'  // Front-facing camera (selfie)
            },
            audio: true
        });

        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
        };

        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        mediaRecorder.onstop = downloadAudio;
    } catch (error) {
        console.error('Error accessing media devices.', error);
        alert('Error accessing media devices. Please ensure camera and microphone permissions are granted.');
    }
}

function startRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'recording') {
        audioChunks = [];
        mediaRecorder.start();
        isRecording = true;
        startTime = new Date();
        document.getElementById('record').textContent = 'Stop Recording';
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        isRecording = false;
        document.getElementById('record').textContent = 'Start Recording';
    }
}

function downloadAudio() {
    const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
    const audioUrl = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    const timestamp = startTime.toISOString().replace(/[:.]/g, '-');
    a.href = audioUrl;
    a.download = `audio_${timestamp}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function copyJSON() {
    const json = JSON.stringify(log, null, 2);
    navigator.clipboard.writeText(json).then(() => {
        alert('JSON copied to clipboard');
    });
}

function logButtonPress(type) {
    const timestamp = new Date().toISOString();
    log.push({ type, timestamp });
}

document.getElementById('record').addEventListener('click', () => {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
});

document.getElementById('poi').addEventListener('click', () => logButtonPress('POI'));
document.getElementById('note').addEventListener('click', () => logButtonPress('Note'));
document.getElementById('download').addEventListener('click', downloadAudio);
document.getElementById('copy').addEventListener('click', copyJSON);

initCamera();
