// --- Global State ---
let allData = { calculated: [], original: [] };
let s3State = {
    downloadedPath: null,
};

// --- DOM Elements ---
const timeSlider = document.getElementById('time-slider');
const timestampDisplay = document.getElementById('timestamp-display');
const playToggle = document.getElementById('play-toggle');
const speedSelect = document.getElementById('speed-select');
const hudPitch = document.getElementById('hud-pitch');
const hudRoll = document.getElementById('hud-roll');
const hudYaw = document.getElementById('hud-yaw');
const objectSelect = document.getElementById('object-select');
const cameraModeToggle = document.getElementById('camera-mode-toggle');

// Data source panels
const sourceLocalBtn = document.getElementById('source-local-btn');
const sourceS3Btn = document.getElementById('source-s3-btn');
const localSourcePanel = document.getElementById('local-source-panel');
const s3SourcePanel = document.getElementById('s3-source-panel');

// Local file elements
const fileSelect = document.getElementById('file-select');
const fileMeta = document.getElementById('file-meta');
const localImportBtn = document.getElementById('local-import-btn');
const localDeleteBtn = document.getElementById('local-delete-btn');

// S3 elements
const s3SensorType = document.getElementById('s3-sensor-type');
const s3Date = document.getElementById('s3-date');
const s3SensorId = document.getElementById('s3-sensor-id');
const s3DownloadBtn = document.getElementById('s3-download-btn');
const s3ConvertBtn = document.getElementById('s3-convert-btn');
const s3MoveBtn = document.getElementById('s3-move-btn');
const s3Status = document.getElementById('s3-status');


// --- Simulation Class ---
class Simulation {
    constructor(containerId) {
        this.container = document.getElementById(containerId);

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xffffff);

        // Camera
        this.camera = new THREE.PerspectiveCamera(75, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
        this.camera.up.set(0, 0, 1); // Z up
        this.camera.position.set(0, -6, 3);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.container.appendChild(this.renderer.domElement);

        // Label Renderer
        this.labelRenderer = new THREE.CSS2DRenderer();
        this.labelRenderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.labelRenderer.domElement.style.position = 'absolute';
        this.labelRenderer.domElement.style.top = '0px';
        this.labelRenderer.domElement.style.left = '0px';
        this.labelRenderer.domElement.style.width = '100%';
        this.labelRenderer.domElement.style.height = '100%';
        this.labelRenderer.domElement.style.pointerEvents = 'none';
        this.labelRenderer.domElement.style.zIndex = '1';
        this.container.appendChild(this.labelRenderer.domElement);

        // Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(0, 0, 0);
        this.controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ORBIT };
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        // Free camera
        this.pointerControls = new THREE.PointerLockControls(this.camera, this.renderer.domElement);
        this.isFreeCamera = false;
        this.keyState = { forward: false, backward: false, left: false, right: false, up: false, down: false };
        this.moveSpeed = 3.0;
        this.clock = new THREE.Clock();
        this.playing = false;
        this.playIndex = 0;
        this.playSpeed = 1.0;

        // Lighting & Scene Helpers
        const ambientLight = new THREE.AmbientLight(0x404040, 3);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
        directionalLight.position.set(5, 5, 10);
        this.scene.add(directionalLight);
        const grid = new THREE.GridHelper(10, 10);
        grid.rotateX(Math.PI / 2);
        this.scene.add(grid);
        this.createAxes();

        // Object model
        this.objectGroup = new THREE.Group();
        this.scene.add(this.objectGroup);
        this.setObjectModel('wheelchair');

        // Event listeners for free camera
        document.addEventListener('keydown', (e) => this.onKeyChange(e, true));
        document.addEventListener('keyup', (e) => this.onKeyChange(e, false));
        this.renderer.domElement.addEventListener('click', () => {
            if (this.isFreeCamera && !this.pointerControls.isLocked) {
                this.pointerControls.lock();
            }
        });
    }

    createAxes() {
        const axesHelper = new THREE.AxesHelper(3);
        this.scene.add(axesHelper);
        const labels = { 'X (Right)': [3.2, 0, 0], 'Y (Fwd)': [0, 3.2, 0], 'Z (Up)': [0, 0, 3.2] };
        Object.entries(labels).forEach(([text, pos]) => {
            const div = document.createElement('div');
            div.className = 'axis-label';
            div.textContent = text;
            const label = new THREE.CSS2DObject(div);
            label.position.fromArray(pos);
            this.scene.add(label);
        });
    }

    update(dataPoint) {
        if (!dataPoint) return;
        const { pitch, roll, yaw } = dataPoint;
        const mappedPitch = -pitch;
        const mappedRoll = roll;
        this.objectGroup.rotation.set(mappedPitch, mappedRoll, yaw, 'ZYX');

        const pitchDeg = (pitch * 180 / Math.PI).toFixed(2);
        const rollDeg = (roll * 180 / Math.PI).toFixed(2);
        const yawDeg = (yaw * 180 / Math.PI).toFixed(2);
        hudPitch.textContent = `${pitchDeg}°`;
        hudRoll.textContent = `${rollDeg}°`;
        hudYaw.textContent = `${yawDeg}°`;
    }

    render() {
        const delta = this.clock.getDelta();
        if (this.isFreeCamera) {
            this.updateFreeCamera(delta);
        } else {
            this.controls.update();
        }
        if (this.playing && allData.original.length > 0) {
            const step = Math.max(1, Math.round(this.playSpeed));
            this.playIndex = Math.min(allData.original.length - 1, this.playIndex + step);
            updateSimulations(this.playIndex);
            timeSlider.value = String(this.playIndex);
        }
        this.renderer.render(this.scene, this.camera);
        this.labelRenderer.render(this.scene, this.camera);
    }

    onResize() {
        const newHeight = this.container.clientHeight;
        const newWidth = (newHeight / 3) * 4; // Enforce 4:3 aspect ratio based on height

        this.camera.aspect = newWidth / newHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(newWidth, newHeight);
        this.labelRenderer.setSize(newWidth, newHeight);
    }

    setObjectModel(kind) {
        while (this.objectGroup.children.length > 0) {
            const child = this.objectGroup.children.pop();
            child.geometry?.dispose?.();
            child.material?.dispose?.();
        }
        if (kind === 'motorcycle') {
            const bodyMaterials = [
                new THREE.MeshStandardMaterial({ color: 0x1565C0, metalness: 0.2, roughness: 0.6 }),
                new THREE.MeshStandardMaterial({ color: 0x1565C0, metalness: 0.2, roughness: 0.6 }),
                new THREE.MeshStandardMaterial({ color: 0x1565C0, metalness: 0.2, roughness: 0.6 }),
                new THREE.MeshStandardMaterial({ color: 0x1565C0, metalness: 0.2, roughness: 0.6 }),
                new THREE.MeshStandardMaterial({ color: 0x1565C0, metalness: 0.2, roughness: 0.6 }),
                new THREE.MeshStandardMaterial({ color: 0x000000, metalness: 0.2, roughness: 0.8 }),
            ];
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.0, 0.6), bodyMaterials);
            body.position.set(0, 0, 0.5);
            this.objectGroup.add(body);
            const wheelMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
            const wheelGeom = new THREE.CylinderGeometry(0.35, 0.35, 0.2, 24);
            const frontWheel = new THREE.Mesh(wheelGeom, wheelMat);
            frontWheel.rotation.x = Math.PI / 2;
            frontWheel.position.set(0, 0.9, 0.35);
            const rearWheel = frontWheel.clone();
            rearWheel.position.set(0, -0.9, 0.35);
            this.objectGroup.add(frontWheel, rearWheel);
        } else {
            const baseMaterials = [
                new THREE.MeshStandardMaterial({ color: 0x0D47A1 }),
                new THREE.MeshStandardMaterial({ color: 0x0D47A1 }),
                new THREE.MeshStandardMaterial({ color: 0x0D47A1 }),
                new THREE.MeshStandardMaterial({ color: 0x0D47A1 }),
                new THREE.MeshStandardMaterial({ color: 0x0D47A1 }),
                new THREE.MeshStandardMaterial({ color: 0x000000 }),
            ];
            const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 0.4), baseMaterials);
            base.position.set(0, 0, 0.2);
            const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.2), new THREE.MeshStandardMaterial({ color: 0x42A5F5 }));
            seat.position.set(0, -0.2, 0.5);
            this.objectGroup.add(base, seat);
        }
    }

    toggleCameraMode(on) {
        this.isFreeCamera = on;
        this.controls.enabled = !on;
        if (!on) this.pointerControls.unlock?.();
    }

    onKeyChange(e, isDown) {
        const key = e.key.toLowerCase();
        if (key === 'w') this.keyState.forward = isDown;
        else if (key === 's') this.keyState.backward = isDown;
        else if (key === 'a') this.keyState.left = isDown;
        else if (key === 'd') this.keyState.right = isDown;
        else if (key === ' ') this.keyState.up = isDown;
        else if (key === 'shift') this.keyState.down = isDown;
    }

    updateFreeCamera(delta) {
        if (!this.isFreeCamera || !this.pointerControls.isLocked) return;
        const velocity = this.moveSpeed * delta;
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.z = 0;
        if (forward.lengthSq() > 0) forward.normalize();
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 0, 1)).negate();
        const up = new THREE.Vector3(0, 0, 1);
        const pos = this.camera.position;
        if (this.keyState.forward) pos.addScaledVector(forward, velocity);
        if (this.keyState.backward) pos.addScaledVector(forward, -velocity);
        if (this.keyState.left) pos.addScaledVector(right, -velocity);
        if (this.keyState.right) pos.addScaledVector(right, velocity);
        if (this.keyState.up) pos.addScaledVector(up, velocity);
        if (this.keyState.down) pos.addScaledVector(up, -velocity);
    }
}

// --- Main Setup ---
const simMain = new Simulation('sim-container');

// --- Data Loading & UI Logic ---
function setSimulationData(data) {
    allData = data;
    if (allData.original && allData.original.length > 0) {
        timeSlider.max = allData.original.length - 1;
        timeSlider.value = 0;
        updateSimulations(0);
        simMain.playIndex = 0;
        playToggle.disabled = false;
    } else {
        timestampDisplay.textContent = "No simulation data available.";
        playToggle.disabled = true;
    }
}

async function loadLocalFile(selectedFileName) {
    try {
        const url = selectedFileName ? `/api/data?file=${encodeURIComponent(selectedFileName)}` : '/api/data';
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        setSimulationData(data);
    } catch (error) {
        console.error("Could not fetch local simulation data:", error);
        timestampDisplay.textContent = "Error loading data.";
    }
}

async function fetchSensorIds() {
    const sensorType = s3SensorType.value;
    const date = s3Date.value;
    if (!sensorType || !date) return;

    s3Status.textContent = 'Loading sensor IDs...';
    s3SensorId.disabled = true;
    s3SensorId.innerHTML = '<option>Loading...</option>';
    s3DownloadBtn.disabled = true;
    s3ConvertBtn.disabled = true;

    try {
        const response = await fetch(`/api/s3/sensors?type=${encodeURIComponent(sensorType)}&date=${encodeURIComponent(date)}`);
        if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
        const data = await response.json();

        // Expecting: { files: [{ displayName, fileKey }] }
        s3SensorId.innerHTML = '<option value="">-- Select Sensor ID --</option>';
        const files = Array.isArray(data.files) ? data.files : [];
        if (files.length > 0) {
            files.forEach(file => {
                const option = document.createElement('option');
                option.value = file.fileKey; // keep full key internally
                option.textContent = file.displayName; // show only sensor_id
                s3SensorId.appendChild(option);
            });
            s3SensorId.disabled = false;
            s3Status.textContent = 'Please select a sensor ID.';
        } else {
            s3SensorId.innerHTML = '<option>No sensors found</option>';
            s3Status.textContent = 'No sensors found for the selected date.';
        }
    } catch (error) {
        console.error('Failed to fetch sensor IDs:', error);
        s3SensorId.innerHTML = '<option>Error loading IDs</option>';
        s3Status.textContent = 'Error loading sensor IDs.';
    }
}

async function handleS3Download() {
    const payload = {
        sensor_type: s3SensorType.value,
        fileKey: s3SensorId.value,
    };

    s3Status.textContent = 'Downloading...';
    s3DownloadBtn.disabled = true;

    try {
        const response = await fetch('/api/s3/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Download failed');
        
        s3State.downloadedPath = result.local_path;
        s3Status.textContent = `Downloaded. Ready to convert.`;
        s3ConvertBtn.disabled = false;
    } catch (error) {
        console.error('S3 Download failed:', error);
        s3Status.textContent = `Download Error: ${error.message}`;
        s3DownloadBtn.disabled = false;
    }
}

async function handleS3Convert() {
    if (!s3State.downloadedPath) {
        s3Status.textContent = 'No file downloaded to convert.';
        return;
    }

    s3Status.textContent = 'Converting...';
    s3ConvertBtn.disabled = true;

    try {
        const response = await fetch('/api/s3/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ local_path: s3State.downloadedPath }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Conversion failed');

        setSimulationData(result);
        s3Status.textContent = 'Conversion successful. Playing data.';
        s3MoveBtn.disabled = false;
    } catch (error) {
        console.error('S3 Convert failed:', error);
        s3Status.textContent = `Conversion Error: ${error.message}`;
        s3ConvertBtn.disabled = false;
    }
}

async function handleS3MoveToLocal() {
    if (!s3State.downloadedPath) {
        s3Status.textContent = 'No file to move.';
        return;
    }
    try {
        const resp = await fetch('/api/s3/move-to-local', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ local_path: s3State.downloadedPath })
        });
        const result = await resp.json();
        if (!resp.ok) throw new Error(result.error || 'Move failed');
        s3Status.textContent = 'Moved to Local.';
        s3MoveBtn.disabled = true;
        await populateLocalFiles();
    } catch (e) {
        s3Status.textContent = `Move failed: ${e.message}`;
    }
}

// --- Update and Animation ---
function updateSimulations(index) {
    const dataOriginal = allData.original[index];
    simMain.update(dataOriginal);
    if (dataOriginal) {
        const date = new Date(dataOriginal.time);
        timestampDisplay.textContent = date.toLocaleString('ko-KR');
    }
}

function animate() {
    requestAnimationFrame(animate);
    simMain.render();
}

// --- Event Listeners ---
function setupEventListeners() {
    timeSlider.addEventListener('input', (event) => updateSimulations(parseInt(event.target.value, 10)));
    window.addEventListener('resize', () => simMain.onResize());
    objectSelect.addEventListener('change', () => simMain.setObjectModel(objectSelect.value));
    playToggle.addEventListener('click', () => {
        simMain.playing = !simMain.playing;
        playToggle.textContent = simMain.playing ? 'Pause' : 'Play';
    });
    speedSelect.addEventListener('change', () => {
        const v = parseFloat(speedSelect.value);
        simMain.playSpeed = isNaN(v) ? 1.0 : v;
    });
    cameraModeToggle.addEventListener('click', () => {
        const next = !simMain.isFreeCamera;
        simMain.toggleCameraMode(next);
        cameraModeToggle.textContent = `Free Camera: ${next ? 'ON' : 'OFF'}`;
        if (next) simMain.renderer.domElement.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement !== simMain.renderer.domElement) {
            simMain.toggleCameraMode(false);
            cameraModeToggle.textContent = 'Free Camera: OFF';
        }
    }, false);

    // Data source toggling
    sourceLocalBtn.addEventListener('click', () => {
        localSourcePanel.classList.remove('hidden');
        s3SourcePanel.classList.add('hidden');
        sourceLocalBtn.classList.add('active');
        sourceS3Btn.classList.remove('active');
    });
    sourceS3Btn.addEventListener('click', () => {
        localSourcePanel.classList.add('hidden');
        s3SourcePanel.classList.remove('hidden');
        sourceLocalBtn.classList.remove('active');
        sourceS3Btn.classList.add('active');
    });

    // Local file loading: manual import only
    fileSelect.addEventListener('change', () => {
        const selected = fileSelect.value;
        const selectedText = fileSelect.options[fileSelect.selectedIndex]?.textContent || '';
        fileMeta.textContent = selected ? `Selected: ${selectedText}` : 'No file selected';
    });
    localImportBtn.addEventListener('click', async () => {
        const fname = fileSelect.value;
        if (!fname) return;
        await loadLocalFile(fname);
    });
    localDeleteBtn.addEventListener('click', async () => {
        const fname = fileSelect.value;
        if (!fname) return;
        if (!confirm(`Delete local file '${fname}'?`)) return;
        try {
            const resp = await fetch('/api/local/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file: fname })
            });
            const result = await resp.json();
            if (!resp.ok) throw new Error(result.error || 'Delete failed');
            // refresh file list
            await populateLocalFiles();
            fileMeta.textContent = 'Deleted.';
        } catch (e) {
            alert(`Delete failed: ${e.message}`);
        }
    });

    // S3 controls
    s3SensorType.addEventListener('change', fetchSensorIds);
    s3Date.addEventListener('change', fetchSensorIds);
    s3SensorId.addEventListener('change', () => {
        s3DownloadBtn.disabled = !s3SensorId.value;
        s3ConvertBtn.disabled = true;
        s3MoveBtn.disabled = true;
        s3State.downloadedPath = null;
    });
    s3DownloadBtn.addEventListener('click', handleS3Download);
    s3ConvertBtn.addEventListener('click', handleS3Convert);
    s3MoveBtn.addEventListener('click', handleS3MoveToLocal);
}

// --- Initial Call ---
async function initializeApp() {
    setupEventListeners();
    // Set default date for S3 date picker
    s3Date.value = new Date().toISOString().split('T')[0];

    // Populate local files without auto-import
    await populateLocalFiles();

    animate();
}

initializeApp();

async function populateLocalFiles() {
    try {
        const resp = await fetch('/api/files');
        if (!resp.ok) throw new Error('Failed to fetch local files');
        const data = await resp.json();
        fileSelect.innerHTML = '';
        data.files.forEach((f) => {
            const opt = document.createElement('option');
            opt.value = f.name;
            const sizeMB = (f.size / (1024 * 1024)).toFixed(2);
            opt.textContent = `${f.name} (${sizeMB} MB)`;
            fileSelect.appendChild(opt);
        });
        fileMeta.textContent = data.files.length > 0 ? 'Select a file and click Import.' : 'No local files.';
    } catch (e) {
        console.error('Failed to populate local files:', e);
        fileMeta.textContent = 'Failed to load local files';
    }
}