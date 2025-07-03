const video = document.getElementById('video');

// Global variable to hold grade data
let gradesData = {};

// Load grades data first
fetch('grades.json')
  .then(response => response.json())
  .then(data => {
    gradesData = data;
    // After loading grades, load models and start video
    Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
      faceapi.nets.faceExpressionNet.loadFromUri('/models')
    ]).then(startVideo);
  });


function startVideo() {
  navigator.getUserMedia(
    { video: {} },
    stream => video.srcObject = stream,
    err => console.error(err)
  );
}

video.addEventListener('play', async () => {
  const canvas = faceapi.createCanvasFromMedia(video);
  document.body.append(canvas);
  const displaySize = { width: video.width, height: video.height };
  faceapi.matchDimensions(canvas, displaySize);

  const labeledFaceDescriptors = await loadLabeledImages();
  const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);

  setInterval(async () => {
    const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptors();
    
    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

    const results = resizedDetections.map(d => faceMatcher.findBestMatch(d.descriptor));
    
    results.forEach((result, i) => {
      const box = resizedDetections[i].detection.box;
      const studentName = result.label;
      const studentData = gradesData[studentName];
      
      let textLines = [result.toString()];
      
      if (studentData) {
        const subjects = Object.keys(studentData);
        const scores = Object.values(studentData);
        const maxScore = Math.max(...scores);
        const minScore = Math.min(...scores);
        const maxSubject = subjects[scores.indexOf(maxScore)];
        const minSubject = subjects[scores.indexOf(minScore)];
        
        textLines.push(`Max: ${maxSubject} (${maxScore})`);
        textLines.push(`Min: ${minSubject} (${minScore})`);
      } else {
        if (studentName !== 'unknown') {
            textLines.push('No grade data found.');
        }
      }
      
      const drawBox = new faceapi.draw.DrawBox(box, { label: textLines.join('\n') });
      drawBox.draw(canvas);
    });
  }, 100);
});

function loadLabeledImages() {
  const labels = ['Kla', 'Toy', 'Ton'];
  return Promise.all(
    labels.map(async label => {
      const descriptions = [];
      try {
        const img = await faceapi.fetchImage(`/students/${label}.jpg`);
        const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor();
        if (detection) {
          descriptions.push(detection.descriptor);
        } else {
          console.error(`No face detected for ${label}.`);
        }
      } catch (e) {
        console.error(`Could not load image for ${label}`, e);
      }
      return new faceapi.LabeledFaceDescriptors(label, descriptions);
    })
  );
}