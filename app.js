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
