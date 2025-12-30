/**
 * Main Entry Point
 * Initializes Three.js scene, hand tracking, and animation loop
 */

import { createScene, handleResize } from './scene.js';
import { createPointCloud } from './pointCloud.js';
import { initHandTracking } from './handTracking.js';
import { createAmbientParticles, createGlowRing } from './effects.js';

// DOM Elements
const container = document.getElementById('canvas-container');
const loadingEl = document.getElementById('loading');
const instructionsEl = document.getElementById('instructions');
const startBtn = document.getElementById('start-btn');
const statsEl = document.getElementById('stats');
const fpsEl = document.getElementById('fps');
const handStatusEl = document.getElementById('hand-status');
const webcamPreview = document.getElementById('webcam-preview');
const webcamVideo = document.getElementById('webcam');
const handCanvas = document.getElementById('hand-canvas');

// Scene components
let sceneComponents;
let pointCloud;
let ambientParticles;
let glowRing;
let handTracker;

// Animation state
let animationId;
let lastTime = 0;
let frameCount = 0;
let lastFpsUpdate = 0;

// Hand data state
let handData = { detected: false };

/**
 * Initializes the application
 */
async function init() {
    console.log('Initializing Hand-Tracked 3D Point Cloud...');
    
    // Create Three.js scene
    sceneComponents = createScene(container);
    const { scene } = sceneComponents;
    
    // Create point cloud
    pointCloud = createPointCloud(scene);
    
    // Create ambient effects
    ambientParticles = createAmbientParticles(scene, 150);
    glowRing = createGlowRing(scene);
    
    // Handle window resize
    window.addEventListener('resize', () => {
        handleResize(sceneComponents);
        if (handTracker) {
            const preview = webcamPreview.getBoundingClientRect();
            handTracker.resize(preview.width, preview.height);
        }
    });
    
    // Show instructions after scene is ready
    loadingEl.classList.add('hidden');
    instructionsEl.classList.remove('hidden');
    
    // Start button handler
    startBtn.addEventListener('click', startExperience);
}

/**
 * Starts the hand tracking experience
 */
async function startExperience() {
    instructionsEl.classList.add('hidden');
    loadingEl.classList.remove('hidden');
    
    try {
        // Set canvas size
        const previewRect = webcamPreview.getBoundingClientRect();
        handCanvas.width = previewRect.width || 200;
        handCanvas.height = previewRect.height || 150;
        
        // Initialize hand tracking
        handTracker = await initHandTracking(
            webcamVideo,
            handCanvas,
            onHandUpdate
        );
        
        // Show UI elements
        loadingEl.classList.add('hidden');
        webcamPreview.classList.remove('hidden');
        statsEl.classList.remove('hidden');
        
        // Start animation loop
        lastTime = performance.now();
        animate();
        
        console.log('Experience started successfully!');
    } catch (error) {
        console.error('Failed to start hand tracking:', error);
        loadingEl.innerHTML = `
            <div class="loading-content">
                <p style="color: #ef4444;">Failed to access camera</p>
                <p class="loading-hint">Please ensure camera permissions are granted and refresh the page.</p>
            </div>
        `;
    }
}

/**
 * Callback when hand tracking data is updated
 */
function onHandUpdate(data) {
    handData = data;
    
    if (data.detected) {
        handStatusEl.textContent = 'Hand detected';
        handStatusEl.classList.add('detected');
        
        // Map hand data to point cloud transforms
        
        // Pinch controls scale (0.5 to 2.0)
        const scale = 0.5 + data.pinch * 1.5;
        pointCloud.setScale(scale);
        
        // Hand rotation controls point cloud rotation
        pointCloud.setRotation(data.rotation.x, data.rotation.y);
        
        // Forward/backward movement controls zoom
        pointCloud.setZoom(data.zoom);
        
    } else {
        handStatusEl.textContent = 'No hand detected';
        handStatusEl.classList.remove('detected');
    }
}

/**
 * Main animation loop
 */
function animate() {
    animationId = requestAnimationFrame(animate);
    
    const currentTime = performance.now();
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    
    // Update FPS counter
    frameCount++;
    if (currentTime - lastFpsUpdate > 500) {
        const fps = Math.round(frameCount / ((currentTime - lastFpsUpdate) / 1000));
        fpsEl.textContent = `${fps} FPS`;
        frameCount = 0;
        lastFpsUpdate = currentTime;
    }
    
    // Get elapsed time in seconds
    const time = currentTime / 1000;
    
    // Update point cloud animation
    pointCloud.update(time);
    
    // Update ambient effects
    ambientParticles.update(time);
    glowRing.update(time);
    
    // Render with post-processing
    sceneComponents.composer.render();
}

/**
 * Cleanup function
 */
function cleanup() {
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    if (handTracker && handTracker.camera) {
        handTracker.camera.stop();
    }
}

// Handle page visibility
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    } else if (handTracker && !animationId) {
        lastTime = performance.now();
        animate();
    }
});

// Handle page unload
window.addEventListener('beforeunload', cleanup);

// Start initialization
init().catch(console.error);
