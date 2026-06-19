const fs = require('fs');
const path = 'c:/MyPers/Projects/GYCAnalysis/frontend/src/components/UserDashboard.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add states and refs
const stateStr =   const [activePreviewImage, setActivePreviewImage] = useState(null);
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);;

content = content.replace(/  const \[activePreviewImage, setActivePreviewImage\] = useState\(null\);/, stateStr);

// 2. Add camera functions before handlePhotoSelect
const cameraFunctions = 
  const openCamera = async () => {
    setShowUploadOptions(false);
    setShowCameraModal(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setBdError('Camera access denied or unavailable.');
      setShowCameraModal(false);
    }
  };

  const closeCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    setShowCameraModal(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    if (bdPhotos.length >= 2) {
      setBdError('Maximum 2 photos can be uploaded.');
      closeCamera();
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const now = new Date();
    const timeStr = now.toLocaleString();
    
    const drawWatermarkAndSave = async (lat, lng) => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, canvas.height - 80, canvas.width, 80);
      ctx.fillStyle = 'white';
      ctx.font = '24px sans-serif';
      ctx.fillText('Timestamp: ' + timeStr, 20, canvas.height - 50);
      ctx.fillText('Location: ' + lat + (lng ? ', ' + lng : ''), 20, canvas.height - 20);
      
      const base64 = canvas.toDataURL('image/jpeg', 0.8);
      const compressed = await compressImage(base64, 800, 800, 0.6);
      setBdPhotos(prev => [...prev, compressed]);
      setShowGpsWarning(true);
      closeCamera();
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => drawWatermarkAndSave(pos.coords.latitude.toFixed(6), pos.coords.longitude.toFixed(6)),
        (err) => {
          console.warn('GPS error:', err);
          drawWatermarkAndSave('GPS Unavailable', '');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      drawWatermarkAndSave('GPS Not Supported', '');
    }
  };

  const handlePhotoSelect;

content = content.replace(/  const handlePhotoSelect/, cameraFunctions);

// 3. Update onClick in the uploader zone
content = content.replace(/onClick=\{\(\) => \{\s*const picker = document\.getElementById\('bd-photo-picker'\);\s*if \(picker\) picker\.click\(\);\s*\}\}/, 'onClick={() => setShowUploadOptions(true)}');

// 4. Add the modals
const modalsStr = 
      {/* Upload Options Modal */}
      {showUploadOptions && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem', border: '3px solid #111111', boxShadow: '8px 8px 0px #111111' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, textTransform: 'uppercase' }}>Select Upload Method</h3>
            <button className="btn btn-primary" onClick={() => {
              setShowUploadOptions(false);
              const picker = document.getElementById('bd-photo-picker');
              if (picker) picker.click();
            }} style={{ textAlign: 'left', padding: '1rem' }}>
              <strong>1) Gallery Upload</strong><br/>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Upload your own GPS tracked or Location Watermark Photos from Gallery</span>
            </button>
            <button className="btn btn-secondary" onClick={openCamera} style={{ textAlign: 'left', padding: '1rem' }}>
              <strong>2) Take GPS Trackered Photo</strong><br/>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Use camera to take a photo with an automatic GPS watermark</span>
            </button>
            <button className="btn" onClick={() => setShowUploadOptions(false)} style={{ marginTop: '0.5rem' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Camera Modal */}
      {showCameraModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#111111', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <h3 style={{ color: 'white', marginBottom: '1rem', textTransform: 'uppercase', fontWeight: 900 }}>Capture Field Photo</h3>
          <video ref={videoRef} autoPlay playsInline style={{ maxWidth: '100%', maxHeight: '60vh', border: '3px solid white', borderRadius: '8px', backgroundColor: '#000' }}></video>
          <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
            <button className="btn btn-primary" onClick={capturePhoto} style={{ fontSize: '1.1rem', padding: '0.75rem 2rem' }}>Capture Photo</button>
            <button className="btn" onClick={closeCamera} style={{ background: 'transparent', color: 'white', border: '2px solid white' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Drag & Drop PDF Uploader */};

content = content.replace(/      \{\/\* Drag & Drop PDF Uploader \*\/\}/, modalsStr);

fs.writeFileSync(path, content);
console.log('UserDashboard updated.');
