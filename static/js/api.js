
async function populateLocalFiles(fileSelect, fileMeta) {
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

async function loadLocalFile(selectedFileName) {
    try {
        const url = selectedFileName ? `/api/data?file=${encodeURIComponent(selectedFileName)}` : '/api/data';
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("Could not fetch local simulation data:", error);
        throw error;
    }
}

async function deleteLocalFile(filename) {
    try {
        const resp = await fetch('/api/local/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file: filename })
        });
        const result = await resp.json();
        if (!resp.ok) throw new Error(result.error || 'Delete failed');
        return result;
    } catch (e) {
        console.error(`Delete failed: ${e.message}`);
        throw e;
    }
}

async function fetchSensorIds(sensorType, date) {
    try {
        const response = await fetch(`/api/s3/sensors?type=${encodeURIComponent(sensorType)}&date=${encodeURIComponent(date)}`);
        if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
        const data = await response.json();
        return Array.isArray(data.files) ? data.files : [];
    } catch (error) {
        console.error('Failed to fetch sensor IDs:', error);
        throw error;
    }
}

async function handleS3Download(sensorType, fileKey) {
    const payload = {
        sensor_type: sensorType,
        fileKey: fileKey,
    };

    try {
        const response = await fetch('/api/s3/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Download failed');
        return result.local_path;
    } catch (error) {
        console.error('S3 Download failed:', error);
        throw error;
    }
}

async function handleS3Convert(downloadedPath) {
     try {
        const response = await fetch('/api/s3/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ local_path: downloadedPath }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Conversion failed');
        return result;
    } catch (error) {
        console.error('S3 Convert failed:', error);
        throw error;
    }
}

async function handleS3MoveToLocal(downloadedPath) {
    try {
        const resp = await fetch('/api/s3/move-to-local', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ local_path: downloadedPath })
        });
        const result = await resp.json();
        if (!resp.ok) throw new Error(result.error || 'Move failed');
        return result;
    } catch (e) {
        console.error(`Move failed: ${e.message}`);
        throw e;
    }
}


export {
    populateLocalFiles,
    loadLocalFile,
    deleteLocalFile,
    fetchSensorIds,
    handleS3Download,
    handleS3Convert,
    handleS3MoveToLocal
};
