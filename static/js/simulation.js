// NOTE: This module assumes THREE.js and its add-ons are loaded globally.
// For a more robust setup, these should be imported from a package manager.

// This class also has implicit dependencies on global variables and functions
// from main.js: allData, hudPitch, hudRoll, hudYaw, timeSlider, updateSimulations.
// This should be refactored to remove these dependencies.

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

        // Remember initial camera view for reset
        this.initialCameraPosition = this.camera.position.clone();
        this.initialCameraTarget = new THREE.Vector3(0, 0, 0);

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

    update(dataPoint, hudElements) {
        if (!dataPoint) return;
        const { pitch, roll, yaw } = dataPoint;
        const mappedPitch = -pitch;
        const mappedRoll = -roll; // Negative roll tilts right on screen
        this.objectGroup.rotation.set(mappedPitch, mappedRoll, yaw, 'ZYX');

        const pitchDeg = (pitch * 180 / Math.PI).toFixed(2);
        const rollDeg = (roll * 180 / Math.PI).toFixed(2);
        const yawDeg = (yaw * 180 / Math.PI).toFixed(2);
        hudElements.pitch.textContent = `${pitchDeg}°`;
        hudElements.roll.textContent = `${rollDeg}°`;
        hudElements.yaw.textContent = `${yawDeg}°`;
    }

    render(onUpdateFrame) {
        const delta = this.clock.getDelta();
        if (this.isFreeCamera) {
            this.updateFreeCamera(delta);
        } else {
            this.controls.update();
        }
        if (this.playing) {
            onUpdateFrame();
        }
        this.renderer.render(this.scene, this.camera);
        this.labelRenderer.render(this.scene, this.camera);
    }

    onResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.labelRenderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    setObjectModel(kind) {
        while (this.objectGroup.children.length > 0) {
            const child = this.objectGroup.children.pop();
            child.geometry?.dispose?.();
            child.material?.dispose?.();
        }
        if (kind === 'motorcycle') {
            // Face order for BoxGeometry materials: +X, -X, +Y(front), -Y(back), +Z, -Z
            const bodyMaterials = [
                new THREE.MeshStandardMaterial({ color: 0x1565C0, metalness: 0.2, roughness: 0.6 }), // +X
                new THREE.MeshStandardMaterial({ color: 0x1565C0, metalness: 0.2, roughness: 0.6 }), // -X
                new THREE.MeshStandardMaterial({ color: 0x2E7D32, metalness: 0.2, roughness: 0.6 }), // +Y FRONT (green)
                new THREE.MeshStandardMaterial({ color: 0xC62828, metalness: 0.2, roughness: 0.6 }), // -Y BACK (red)
                new THREE.MeshStandardMaterial({ color: 0x1565C0, metalness: 0.2, roughness: 0.6 }), // +Z
                new THREE.MeshStandardMaterial({ color: 0x000000, metalness: 0.2, roughness: 0.8 }), // -Z
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
            // TYPE A (wheelchair): color front/back faces differently for orientation clarity
            const baseMaterials = [
                new THREE.MeshStandardMaterial({ color: 0x0D47A1 }), // +X
                new THREE.MeshStandardMaterial({ color: 0x0D47A1 }), // -X
                new THREE.MeshStandardMaterial({ color: 0x2E7D32 }), // +Y FRONT (green)
                new THREE.MeshStandardMaterial({ color: 0xC62828 }), // -Y BACK (red)
                new THREE.MeshStandardMaterial({ color: 0x0D47A1 }), // +Z
                new THREE.MeshStandardMaterial({ color: 0x000000 }), // -Z
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
        if (!on) {
            // Exiting free camera: unlock pointer and sync OrbitControls to current camera view
            this.pointerControls.unlock?.();
            const forward = new THREE.Vector3();
            this.camera.getWorldDirection(forward);
            // Place target in front of camera so current position stays after controls.update()
            const distance = 10; // arbitrary non-zero distance
            const newTarget = this.camera.position.clone().add(forward.multiplyScalar(distance));
            this.controls.target.copy(newTarget);
            this.controls.update();
        }
    }

    resetCameraView() {
        // Turn off free camera and reset to initial orbit view
        this.isFreeCamera = false;
        this.controls.enabled = true;
        this.pointerControls.unlock?.();

        this.camera.up.set(0, 0, 1);
        this.camera.position.copy(this.initialCameraPosition);
        this.controls.target.copy(this.initialCameraTarget);
        this.camera.lookAt(this.initialCameraTarget);
        this.controls.update();
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
        // Right vector derived from forward x up (Z-up); no negate
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 0, 1));
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

export default Simulation;
