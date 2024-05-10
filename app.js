const cameraStream = document.getElementById('camera-stream');
const recordBtn = document.getElementById('record-btn');
const poiBtn = document.getElementById('poi-btn');
const photoNoteBtn = document.getElementById('photo-note-btn');
const copyLogBtn = document.getElementById('copy-log-btn');
const logOutput = document.getElementById('log-output');

let recording = false;
let log = [];

// Access the camera
navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
        const video = document.getElementById('camera-stream');
        video.srcObject = stream;
        video.play();  // This might be necessary to ensure the video starts playing.
    })
    .catch(error => {
        console.error('Access denied for camera:', error);
        alert('Camera access was denied or failed. Please check your browser settings and permissions.');
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
