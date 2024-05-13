let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let log = [];

async function initCamera() {
    const video = document.getElementById('video');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        video.srcObject = stream;

        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };
    } catch (error) {
        console.error('Error accessing media devices.', error);
    }
}

function startRecording() {
    audioChunks = [];
    mediaRecorder.start();
    isRecording = true;
    document.getElementById('record').textContent = 'Stop Recording';
}

function stopRecording() {
    mediaRecorder.stop();
    isRecording = false;
    document.getElementById('record').textContent = 'Start Recording';
}

function downloadAudio() {
    const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
    const audioUrl = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = 'audio.mp3';
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
