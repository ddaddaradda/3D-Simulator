import Simulation from './js/simulation.js';
import * as ui from './js/ui.js';
import * as api from './js/api.js';

class App {
    constructor() {
        this.allData = { calculated: [], original: [] };
        this.s3State = { downloadedPath: null };
        this.sim = new Simulation('sim-container');
    }

    setSimulationData(data) {
        this.allData = data;
        if (this.allData.original && this.allData.original.length > 0) {
            ui.timeSlider.max = this.allData.original.length - 1;
            ui.timeSlider.value = 0;
            this.updateSimulations(0);
            this.sim.playIndex = 0;
            ui.playToggle.disabled = false;
        } else {
            ui.timestampDisplay.textContent = "No simulation data available.";
            ui.playToggle.disabled = true;
        }
    }

    updateSimulations(index) {
        const dataOriginal = this.allData.original[index];
        this.sim.update(dataOriginal, ui.hud);
        if (dataOriginal) {
            ui.updateTimestamp(dataOriginal.time);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const onUpdateFrame = () => {
            if (this.allData.original.length > 0) {
                const step = Math.max(1, Math.round(this.sim.playSpeed));
                this.sim.playIndex = Math.min(this.allData.original.length - 1, this.sim.playIndex + step);
                this.updateSimulations(this.sim.playIndex);
                ui.timeSlider.value = String(this.sim.playIndex);
            }
        };

        this.sim.render(onUpdateFrame);
    }

    async init() {
        ui.setupEventListeners(this);
        // Set default date for S3 date picker
        ui.s3Date.value = new Date().toISOString().split('T')[0];

        // Populate local files without auto-import
        await api.populateLocalFiles(ui.fileSelect, ui.fileMeta);

        this.animate();
    }
}

// --- Initial Call ---
const app = new App();
app.init();
