/**
 * Hand Tracking Module
 * Integrates MediaPipe Hands for gesture detection and hand landmark tracking
 */

// Hand tracking configuration
const CONFIG = {
    // MediaPipe Hands options
    hands: {
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5
    },
    // Gesture thresholds
    gestures: {
        pinchThreshold: 0.08,      // Distance between thumb and index
        fistThreshold: 0.15,       // Average finger curl
        depthSensitivity: 3,       // Multiplier for Z movement
        rotationSensitivity: 2     // Multiplier for rotation
    },
    // Smoothing
    smoothing: {
        position: 0.3,             // Lower = smoother, Higher = responsive
        gesture: 0.2
    }
};

// Landmark indices for MediaPipe Hands
const LANDMARKS = {
    WRIST: 0,
    THUMB_TIP: 4,
    INDEX_TIP: 8,
    MIDDLE_TIP: 12,
    RING_TIP: 16,
    PINKY_TIP: 20,
    INDEX_MCP: 5,
    MIDDLE_MCP: 9,
    RING_MCP: 13,
    PINKY_MCP: 17
};

/**
 * Initializes hand tracking with MediaPipe
 * @param {HTMLVideoElement} videoElement - Video element for camera feed
 * @param {HTMLCanvasElement} canvasElement - Canvas for hand visualization
 * @param {Function} onHandUpdate - Callback when hand data is processed
 * @returns {Object} Hand tracking controller
 */
export async function initHandTracking(videoElement, canvasElement, onHandUpdate) {
    const ctx = canvasElement.getContext('2d');
    
    // State for smoothed values
    const state = {
        handDetected: false,
        smoothedPosition: { x: 0.5, y: 0.5, z: 0.5 },
        smoothedPinch: 1,
        smoothedRotation: { x: 0, y: 0 },
        baselineZ: null,     // Reference Z position
        lastLandmarks: null
    };
    
    // Initialize MediaPipe Hands
    const hands = new window.Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`;
        }
    });
    
    hands.setOptions({
        maxNumHands: CONFIG.hands.maxNumHands,
        modelComplexity: CONFIG.hands.modelComplexity,
        minDetectionConfidence: CONFIG.hands.minDetectionConfidence,
        minTrackingConfidence: CONFIG.hands.minTrackingConfidence
    });
    
    // Process hand detection results
    hands.onResults((results) => {
        // Clear and draw video frame
        ctx.save();
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        ctx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
        
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            state.handDetected = true;
            state.lastLandmarks = landmarks;
            
            // Draw hand landmarks
            drawHand(ctx, landmarks, canvasElement.width, canvasElement.height);
            
            // Extract and smooth gesture data
            const gestureData = extractGestureData(landmarks, state);
            
            // Call update callback with processed data
            onHandUpdate({
                detected: true,
                position: gestureData.position,
                pinch: gestureData.pinch,
                rotation: gestureData.rotation,
                zoom: gestureData.zoom,
                fist: gestureData.fist
            });
        } else {
            state.handDetected = false;
            onHandUpdate({ detected: false });
        }
        
        ctx.restore();
    });
    
    // Initialize camera
    const camera = new window.Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        },
        width: 640,
        height: 480
    });
    
    await camera.start();
    
    return {
        state,
        camera,
        /**
         * Resets baseline position for depth tracking
         */
        resetBaseline() {
            state.baselineZ = null;
        },
        /**
         * Updates canvas size
         */
        resize(width, height) {
            canvasElement.width = width;
            canvasElement.height = height;
        }
    };
}

/**
 * Extracts gesture data from hand landmarks
 */
function extractGestureData(landmarks, state) {
    const wrist = landmarks[LANDMARKS.WRIST];
    const thumbTip = landmarks[LANDMARKS.THUMB_TIP];
    const indexTip = landmarks[LANDMARKS.INDEX_TIP];
    const middleTip = landmarks[LANDMARKS.MIDDLE_TIP];
    const indexMcp = landmarks[LANDMARKS.INDEX_MCP];
    
    // Calculate hand center position
    const centerX = wrist.x;
    const centerY = wrist.y;
    const centerZ = wrist.z;
    
    // Initialize baseline Z if not set
    if (state.baselineZ === null) {
        state.baselineZ = centerZ;
    }
    
    // Smooth position
    state.smoothedPosition.x = lerp(state.smoothedPosition.x, centerX, CONFIG.smoothing.position);
    state.smoothedPosition.y = lerp(state.smoothedPosition.y, centerY, CONFIG.smoothing.position);
    state.smoothedPosition.z = lerp(state.smoothedPosition.z, centerZ, CONFIG.smoothing.position);
    
    // Calculate pinch distance (thumb to index)
    const pinchDist = distance3D(thumbTip, indexTip);
    const pinchNormalized = Math.min(1, pinchDist / 0.2);
    state.smoothedPinch = lerp(state.smoothedPinch, pinchNormalized, CONFIG.smoothing.gesture);
    
    // Calculate hand rotation based on palm orientation
    const palmVector = {
        x: middleTip.x - wrist.x,
        y: middleTip.y - wrist.y,
        z: middleTip.z - wrist.z
    };
    
    const rotationX = Math.atan2(palmVector.z, palmVector.y) * CONFIG.gestures.rotationSensitivity;
    const rotationY = Math.atan2(palmVector.x, palmVector.y) * CONFIG.gestures.rotationSensitivity;
    
    state.smoothedRotation.x = lerp(state.smoothedRotation.x, rotationX, CONFIG.smoothing.gesture);
    state.smoothedRotation.y = lerp(state.smoothedRotation.y, rotationY, CONFIG.smoothing.gesture);
    
    // Calculate zoom from Z depth change
    const zDelta = (state.baselineZ - state.smoothedPosition.z) * CONFIG.gestures.depthSensitivity;
    
    // Detect fist (average finger curl)
    const fistAmount = calculateFistAmount(landmarks);
    
    return {
        position: { ...state.smoothedPosition },
        pinch: state.smoothedPinch,
        rotation: { ...state.smoothedRotation },
        zoom: zDelta,
        fist: fistAmount
    };
}

/**
 * Calculates how closed the hand is (fist detection)
 */
function calculateFistAmount(landmarks) {
    const fingerTips = [
        LANDMARKS.INDEX_TIP,
        LANDMARKS.MIDDLE_TIP,
        LANDMARKS.RING_TIP,
        LANDMARKS.PINKY_TIP
    ];
    const fingerMcps = [
        LANDMARKS.INDEX_MCP,
        LANDMARKS.MIDDLE_MCP,
        LANDMARKS.RING_MCP,
        LANDMARKS.PINKY_MCP
    ];
    
    const wrist = landmarks[LANDMARKS.WRIST];
    let totalCurl = 0;
    
    for (let i = 0; i < fingerTips.length; i++) {
        const tip = landmarks[fingerTips[i]];
        const mcp = landmarks[fingerMcps[i]];
        
        // Distance from fingertip to wrist vs MCP to wrist
        const tipDist = distance3D(tip, wrist);
        const mcpDist = distance3D(mcp, wrist);
        
        // If tip is closer to wrist than MCP, finger is curled
        const curl = tipDist < mcpDist ? 1 - (tipDist / mcpDist) : 0;
        totalCurl += curl;
    }
    
    return totalCurl / fingerTips.length;
}

/**
 * Draws hand landmarks on canvas
 */
function drawHand(ctx, landmarks, width, height) {
    // Draw connections
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],           // Thumb
        [0, 5], [5, 6], [6, 7], [7, 8],           // Index
        [0, 9], [9, 10], [10, 11], [11, 12],      // Middle
        [0, 13], [13, 14], [14, 15], [15, 16],    // Ring
        [0, 17], [17, 18], [18, 19], [19, 20],    // Pinky
        [5, 9], [9, 13], [13, 17]                  // Palm
    ];
    
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.6)';
    ctx.lineWidth = 2;
    
    for (const [i, j] of connections) {
        const start = landmarks[i];
        const end = landmarks[j];
        ctx.beginPath();
        ctx.moveTo(start.x * width, start.y * height);
        ctx.lineTo(end.x * width, end.y * height);
        ctx.stroke();
    }
    
    // Draw landmarks
    for (let i = 0; i < landmarks.length; i++) {
        const landmark = landmarks[i];
        const x = landmark.x * width;
        const y = landmark.y * height;
        
        // Gradient from purple to cyan based on index
        const hue = 280 - (i / landmarks.length) * 100;
        ctx.fillStyle = `hsla(${hue}, 80%, 60%, 0.9)`;
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Linear interpolation helper
 */
function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * 3D distance between two points
 */
function distance3D(a, b) {
    return Math.sqrt(
        (a.x - b.x) ** 2 +
        (a.y - b.y) ** 2 +
        (a.z - b.z) ** 2
    );
}
