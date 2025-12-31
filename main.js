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
let pinkObject;   // ALWAYS Left Hand
let blueObject;   // ALWAYS Right Hand
let ambientParticles;
let glowRing;
let handTracker;

// Animation state
let animationId;
let lastTime = 0;
let frameCount = 0;
let lastFpsUpdate = 0;

// Layout State Machine
// Defines target properties for each object based on hand state
const LAYOUT_TARGETS = {
    IDLE: {
        pink: { x: 0, opacity: 0, scale: 0.1, wave: 0 },
        blue: { x: 0, opacity: 0, scale: 0.1, wave: 0 }
    },
    LEFT_SOLO: {
        pink: { x: 0, opacity: 1, scale: 1.0, wave: 0 },    // Center, Stable
        blue: { x: 4, opacity: 0, scale: 0.5, wave: 1 }     // Hidden right
    },
    RIGHT_SOLO: {
        pink: { x: -4, opacity: 0, scale: 0.5, wave: 1 },   // Hidden left
        blue: { x: 0, opacity: 1, scale: 1.0, wave: 0 }     // Center, Stable
    },
    DUAL: {
        pink: { x: -2.2, opacity: 1, scale: 0.8, wave: 1 }, // Left, Wavy
        blue: { x: 2.2, opacity: 1, scale: 0.8, wave: 1 }   // Right, Wavy
    }
};

// Current interpolated state
const currentLayout = {
    pink: { x: 0, opacity: 0, scale: 1, wave: 0 },
    blue: { x: 0, opacity: 0, scale: 1, wave: 0 }
};

// Hand data state
let handData = { 
    left: { detected: false }, 
    right: { detected: false }, 
    bothDetected: false 
};

/**
 * Initializes the application
 */
async function init() {
    console.log('Initializing Hand-Tracked 3D Point Cloud...');
    
    // Create Three.js scene
    sceneComponents = createScene(container);
    const { scene } = sceneComponents;
    
    // Create point cloud objects
    // PINK OBJECT (Left Hand) - Hue ~0.9 (Pink/Magenta)
    pinkObject = createPointCloud(scene); 
    pinkObject.setVisualState({ hue: 0.85, opacity: 0 });
    
    // BLUE OBJECT (Right Hand) - Hue ~0.6 (Blue/Cyan)
    blueObject = createPointCloud(scene);
    blueObject.setVisualState({ hue: 0.55, opacity: 0 });
    
    // Create ambient effects
    ambientParticles = createAmbientParticles(scene, 200);
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
    
    const statusText = [];
    if (data.left.detected) statusText.push("Left");
    if (data.right.detected) statusText.push("Right");
    
    if (statusText.length > 0) {
        handStatusEl.textContent = statusText.join(' + ') + ' Hand Detected';
        handStatusEl.classList.add('detected');
    } else {
        handStatusEl.textContent = 'No hand detected';
        handStatusEl.classList.remove('detected');
    }
}

/**
 * Main animation loop with State Transition Logic
 */
function animate() {
    animationId = requestAnimationFrame(animate);
    
    const currentTime = performance.now();
    const dt = (currentTime - lastTime) / 1000;
    const time = currentTime / 1000;
    lastTime = currentTime;
    
    // 1. Determine Target State
    let targetKey = 'IDLE';
    if (handData.bothDetected) {
        targetKey = 'DUAL';
    } else if (handData.left.detected) {
        targetKey = 'LEFT_SOLO';
    } else if (handData.right.detected) {
        targetKey = 'RIGHT_SOLO';
    }
    
    const target = LAYOUT_TARGETS[targetKey];
    
    // 2. Smoothly Interpolate Current Layout
    const lerpSpeed = 3.0 * dt; // Adjust for smoothness
    
    // Helper to lerp object state
    function lerpObjectState(current, targetObj) {
        current.x += (targetObj.x - current.x) * lerpSpeed;
        current.opacity += (targetObj.opacity - current.opacity) * lerpSpeed;
        current.scale += (targetObj.scale - current.scale) * lerpSpeed;
        current.wave += (targetObj.wave - current.wave) * lerpSpeed;
    }
    
    lerpObjectState(currentLayout.pink, target.pink);
    lerpObjectState(currentLayout.blue, target.blue);
    
    // 3. Apply Visuals to Objects
    
    // PINK OBJECT (Left)
    pinkObject.group.position.x = currentLayout.pink.x;
    pinkObject.setVisualState({
        opacity: currentLayout.pink.opacity,
        radiusScale: currentLayout.pink.scale,
        waveAmount: currentLayout.pink.wave
    });
    
    // BLUE OBJECT (Right)
    blueObject.group.position.x = currentLayout.blue.x;
    blueObject.setVisualState({
        opacity: currentLayout.blue.opacity,
        radiusScale: currentLayout.blue.scale,
        waveAmount: currentLayout.blue.wave
    });

    // 4. Strict Control Mapping
    // Left Hand -> Pink Object
    if (handData.left.detected) {
        updateObjectFromHand(pinkObject, handData.left);
    }
    
    // Right Hand -> Blue Object
    if (handData.right.detected) {
        updateObjectFromHand(blueObject, handData.right);
    }
    
    // 5. Ambient Effects
    // Glow ring fades out in DUAL mode, stays in Solo
    const isDual = targetKey === 'DUAL';
    const glowTarget = isDual ? 0 : 0.2;
    // Simple lerp for glow opacity
    glowRing.ring.material.opacity += (glowTarget - glowRing.ring.material.opacity) * lerpSpeed;
    
    // Update Scene Components
    pinkObject.update(time);
    blueObject.update(time);
    ambientParticles.update(time);
    glowRing.update(time);
    
    // FPS
    frameCount++;
    if (currentTime - lastFpsUpdate > 500) {
        const fps = Math.round(frameCount / ((currentTime - lastFpsUpdate) / 1000));
        fpsEl.textContent = `${fps} FPS`;
        frameCount = 0;
        lastFpsUpdate = currentTime;
    }
    
    sceneComponents.composer.render();
}

function updateObjectFromHand(object, handState) {
    const scale = 0.5 + handState.pinch * 1.5;
    object.setScale(scale);
    object.setRotation(handState.rotation.x, handState.rotation.y);
    object.setZoom(handState.zoom);
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
