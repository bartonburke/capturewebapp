const cameraStream = document.getElementById('camera-stream');
const recordBtn = document.getElementById('record-btn');
const poiBtn = document.getElementById('poi-btn');
const photoNoteBtn = document.getElementById('photo-note-btn');
const copyLogBtn = document.getElementById('copy-log-btn');
const logOutput = document.getElementById('log-output');

let recording = false;
let log = [];

// Access the camera
navigator.mediaDevices.getUserMedia({ 
    video: { facingMode: { exact: "environment" } } // "environment" refers to the back-facing camera
})
.then(stream => {
    const video = document.getElementById('camera-stream');
    video.srcObject = stream;
    video.play(); // Ensure the video starts playing
})
.catch(error => {
    console.error('Error accessing the camera:', error);
    alert('Failed to access the camera. Please check your device settings.');
});


// Function to log button tap events
function logEvent(event) {
    if (recording) {
        const timestamp = new Date();
        log.push({ event, timestamp: timestamp.toISOString() });
        logOutput.textContent = JSON.stringify(log, null, 2);
    }
}

// Toggle recording state
recordBtn.addEventListener('click', () => {
    recording = !recording;
    recordBtn.textContent = recording ? 'Stop Recording' : 'Record';
    if (!recording) {
        copyLogBtn.style.display = 'block';
    } else {
        copyLogBtn.style.display = 'none';
        log = []; // Reset log when recording starts
    }
});

poiBtn.addEventListener('click', () => logEvent('Point of Interest'));
photoNoteBtn.addEventListener('click', () => logEvent('Photo Note'));

// Copy log to clipboard
copyLogBtn.addEventListener('click', () => {
    if (logOutput.textContent) {
        navigator.clipboard.writeText(logOutput.textContent)
            .then(() => alert('Log copied to clipboard!'))
            .catch(err => console.error('Could not copy text: ', err));
    }
});

// Existing setup and function logEvent remains the same

document.getElementById('copy-log-btn').addEventListener('click', () => {
    const logOutput = document.getElementById('log-output');
    logOutput.select();  // Select the text
    document.execCommand('copy');  // Copy the text
    alert('Copied to clipboard!');
});

let mediaRecorder;
let audioChunks = [];

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
        const video = document.getElementById('camera-stream');
        video.srcObject = stream;
        video.play();

        // Prepare for recording
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
            const audioUrl = URL.createObjectURL(audioBlob);
            const downloadLink = document.createElement('a');
            downloadLink.href = audioUrl;
            downloadLink.download = 'recording.mp3';
            downloadLink.textContent = 'Download MP3';
            document.body.appendChild(downloadLink);
            audioChunks = [];  // Clear the chunks for next recording
        };
    })
    .catch(error => {
        console.error('Error accessing media devices:', error);
        alert('Failed to access camera or microphone. Please check your device settings.');
    });

function startRecording() {
    if (mediaRecorder && mediaRecorder.state === 'inactive') {
        mediaRecorder.start();
        console.log('Recording started');
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        console.log('Recording stopped');
    }
}

document.getElementById('record-btn').addEventListener('click', () => {
    if (mediaRecorder.state === 'inactive') {
        startRecording();
        document.getElementById('record-btn').textContent = 'Stop Recording';
    } else {
        stopRecording();
        document.getElementById('record-btn').textContent = 'Start Recording';
    }
});

