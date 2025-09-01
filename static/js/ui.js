import * as api from './api.js';

// --- DOM Elements ---
export const timeSlider = document.getElementById('time-slider');
export const timestampDisplay = document.getElementById('timestamp-display');
export const playToggle = document.getElementById('play-toggle');
export const speedSelect = document.getElementById('speed-select');
export const hud = {
    pitch: document.getElementById('hud-pitch'),
    roll: document.getElementById('hud-roll'),
    yaw: document.getElementById('hud-yaw'),
};
export const objectSelect = document.getElementById('object-select');
export const cameraModeToggle = document.getElementById('camera-mode-toggle');
export const cameraResetBtn = document.getElementById('camera-reset');

// Data source panels
export const sourceLocalBtn = document.getElementById('source-local-btn');
export const sourceS3Btn = document.getElementById('source-s3-btn');
export const localSourcePanel = document.getElementById('local-source-panel');
export const s3SourcePanel = document.getElementById('s3-source-panel');

// Local file elements
export const fileSelect = document.getElementById('file-select');
export const fileMeta = document.getElementById('file-meta');
export const localImportBtn = document.getElementById('local-import-btn');
export const localDeleteBtn = document.getElementById('local-delete-btn');

// S3 elements
export const s3SensorType = document.getElementById('s3-sensor-type');
export const s3Date = document.getElementById('s3-date');
export const s3SensorId = document.getElementById('s3-sensor-id');
export const s3DownloadBtn = document.getElementById('s3-download-btn');
export const s3ConvertBtn = document.getElementById('s3-convert-btn');
export const s3MoveBtn = document.getElementById('s3-move-btn');
export const s3Status = document.getElementById('s3-status');

let s3SensorIdChoice = null; // To hold the Choices.js instance

// --- UI Helper Functions ---

function setButtonLoadingState(button, isLoading, loadingText = 'Loading...') {
    if (isLoading) {
        button.disabled = true;
        button.dataset.originalText = button.textContent;
        button.textContent = loadingText;
    } else {
        button.disabled = false;
        button.textContent = button.dataset.originalText || button.textContent;
    }
}

export function updateTimestamp(time) {
    const date = new Date(time);
    timestampDisplay.textContent = date.toLocaleString('ko-KR');
}

export function setupEventListeners(app) {
    // Initialize the searchable dropdown for S3 sensor IDs
    s3SensorIdChoice = new Choices(s3SensorId, {
        searchResultLimit: 100,
        itemSelectText: 'Select',
        searchPlaceholderValue: 'Type to search...',
        removeItemButton: true,
    });

    timeSlider.addEventListener('input', (event) => {
        const idx = parseInt(event.target.value, 10);
        app.sim.playIndex = idx;
        app.updateSimulations(idx);
    });
    window.addEventListener('resize', () => app.sim.onResize());
    objectSelect.addEventListener('change', () => app.sim.setObjectModel(objectSelect.value));
    
    playToggle.addEventListener('click', () => {
        app.sim.playing = !app.sim.playing;
        playToggle.textContent = app.sim.playing ? 'Pause' : 'Play';
    });

    speedSelect.addEventListener('change', () => {
        const v = parseFloat(speedSelect.value);
        app.sim.playSpeed = isNaN(v) ? 1.0 : v;
    });

    cameraModeToggle.addEventListener('click', () => {
        const next = !app.sim.isFreeCamera;
        app.sim.toggleCameraMode(next);
        cameraModeToggle.textContent = `Free Camera: ${next ? 'ON' : 'OFF'}`;
        if (next) app.sim.renderer.domElement.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement !== app.sim.renderer.domElement) {
            app.sim.toggleCameraMode(false);
            cameraModeToggle.textContent = 'Free Camera: OFF';
        }
    }, false);

    // Camera reset
    if (cameraResetBtn) {
        cameraResetBtn.addEventListener('click', () => {
            app.sim.resetCameraView();
            cameraModeToggle.textContent = 'Free Camera: OFF';
        });
    }

    // Data source toggling
    sourceLocalBtn.addEventListener('click', () => {
        localSourcePanel.classList.remove('d-none');
        s3SourcePanel.classList.add('d-none');
    });

    sourceS3Btn.addEventListener('click', () => {
        localSourcePanel.classList.add('d-none');
        s3SourcePanel.classList.remove('d-none');
    });

    // Local file loading
    fileSelect.addEventListener('change', () => {
        const selected = fileSelect.value;
        const selectedText = fileSelect.options[fileSelect.selectedIndex]?.textContent || '';
        fileMeta.textContent = selected ? `Selected: ${selectedText}` : 'No file selected';
    });

    localImportBtn.addEventListener('click', async () => {
        const fname = fileSelect.value;
        if (!fname) return;
        showLoader();
        setButtonLoadingState(localImportBtn, true, 'Importing...');
        try {
            const data = await api.loadLocalFile(fname);
            app.setSimulationData(data);
            fileMeta.textContent = `Imported: ${fname}`;
        } catch (error) {
            fileMeta.textContent = `Error: ${error.message}`;
        } finally {
            hideLoader();
            setButtonLoadingState(localImportBtn, false);
        }
    });

    localDeleteBtn.addEventListener('click', async () => {
        const fname = fileSelect.value;
        if (!fname) return;
        if (!confirm(`Delete local file '${fname}'?`)) return;
        showLoader();
        setButtonLoadingState(localDeleteBtn, true, 'Deleting...');
        try {
            await api.deleteLocalFile(fname);
            await api.populateLocalFiles(fileSelect, fileMeta);
            fileMeta.textContent = 'Deleted.';
        } catch (e) {
            fileMeta.textContent = `Error: ${e.message}`;
        } finally {
            hideLoader();
            setButtonLoadingState(localDeleteBtn, false);
        }
    });

    // S3 controls
    const handleSensorIdFetch = async () => {
        const sensorType = s3SensorType.value;
        const date = s3Date.value;
        if (!sensorType || !date) return;

        s3Status.textContent = 'Loading sensor IDs...';
        s3SensorIdChoice.disable();
        s3SensorIdChoice.clearStore();
        s3SensorIdChoice.setChoices([{ value: '', label: 'Loading...' }], 'value', 'label', true);
        s3DownloadBtn.disabled = true;
        s3ConvertBtn.disabled = true;

        try {
            const files = await api.fetchSensorIds(sensorType, date);
            if (files.length > 0) {
                const choices = files.map(file => ({ value: file.fileKey, label: file.displayName }));
                s3SensorIdChoice.setChoices(choices, 'value', 'label', true);
                s3SensorIdChoice.enable();
                s3Status.textContent = 'Please select a sensor ID.';
            } else {
                s3SensorIdChoice.setChoices([{ value: '', label: 'No sensors found' }], 'value', 'label', true);
                s3Status.textContent = 'No sensors found for the selected date.';
            }
        } catch (error) {
            s3SensorIdChoice.setChoices([{ value: '', label: 'Error loading IDs' }], 'value', 'label', true);
            s3Status.textContent = `Error: ${error.message}`;
        }
    };

    s3SensorType.addEventListener('change', handleSensorIdFetch);
    s3Date.addEventListener('change', handleSensorIdFetch);

    s3SensorId.addEventListener('change', () => {
        s3DownloadBtn.disabled = !s3SensorIdChoice.getValue(true);
        s3ConvertBtn.disabled = true;
        s3MoveBtn.disabled = true;
        app.s3State.downloadedPath = null;
    });

    s3DownloadBtn.addEventListener('click', async () => {
        showLoader();
        setButtonLoadingState(s3DownloadBtn, true, 'Downloading...');
        s3Status.textContent = 'Downloading...';
        try {
            const localPath = await api.handleS3Download(s3SensorType.value, s3SensorIdChoice.getValue(true));
            app.s3State.downloadedPath = localPath;
            s3Status.textContent = `Downloaded. Ready to convert.`;
            s3ConvertBtn.disabled = false;
        } catch (error) {
            s3Status.textContent = `Download Error: ${error.message}`;
        } finally {
            hideLoader();
            setButtonLoadingState(s3DownloadBtn, false);
        }
    });

    s3ConvertBtn.addEventListener('click', async () => {
        if (!app.s3State.downloadedPath) {
            s3Status.textContent = 'No file downloaded to convert.';
            return;
        }
        showLoader();
        setButtonLoadingState(s3ConvertBtn, true, 'Converting...');
        s3Status.textContent = 'Converting...';
        try {
            const result = await api.handleS3Convert(app.s3State.downloadedPath);
            app.setSimulationData(result);
            s3Status.textContent = 'Conversion successful. Playing data.';
            s3MoveBtn.disabled = false;
        } catch (error) {
            s3Status.textContent = `Conversion Error: ${error.message}`;
        } finally {
            hideLoader();
            setButtonLoadingState(s3ConvertBtn, false);
        }
    });

    s3MoveBtn.addEventListener('click', async () => {
        if (!app.s3State.downloadedPath) {
            s3Status.textContent = 'No file to move.';
            return;
        }
        showLoader();
        setButtonLoadingState(s3MoveBtn, true, 'Moving...');
        try {
            await api.handleS3MoveToLocal(app.s3State.downloadedPath);
            s3Status.textContent = 'Moved to Local.';
            s3MoveBtn.disabled = true;
            await api.populateLocalFiles(fileSelect, fileMeta);
        } catch (e) {
            s3Status.textContent = `Move failed: ${e.message}`;
        } finally {
            hideLoader();
            setButtonLoadingState(s3MoveBtn, false);
        }
    });
}

function showLoader() {
    document.body.classList.add('is-loading');
}

function hideLoader() {
    document.body.classList.remove('is-loading');
}
