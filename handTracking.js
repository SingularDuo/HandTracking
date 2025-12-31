/**
 * Hand Tracking Module
 * Integrates MediaPipe Hands for gesture detection and hand landmark tracking
 */

// Hand tracking configuration
const CONFIG = {
    // MediaPipe Hands options
    hands: {
        maxNumHands: 2,
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
/**
 * Initializes hand tracking with MediaPipe
 * @param {HTMLVideoElement} videoElement - Video element for camera feed
 * @param {HTMLCanvasElement} canvasElement - Canvas for hand visualization
 * @param {Function} onHandUpdate - Callback when hand data is processed
 * @returns {Object} Hand tracking controller
 */
export async function initHandTracking(videoElement, canvasElement, onHandUpdate) {
    const ctx = canvasElement.getContext('2d');
    
    // State for smoothed values - separated by hand
    const createHandState = () => ({
        detected: false,
        smoothedPosition: { x: 0.5, y: 0.5, z: 0.5 },
        smoothedPinch: 1,
        smoothedRotation: { x: 0, y: 0 },
        baselineZ: null,
        lastLandmarks: null
    });

    const state = {
        left: createHandState(),
        right: createHandState(),
        bothDetected: false
    };
    
    // Initialize MediaPipe Hands
    const hands = new window.Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`;
        }
    });
    
    hands.setOptions({
        maxNumHands: 2, // Changed from 1 to 2
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

        // Reset detection status before processing
        state.left.detected = false;
        state.right.detected = false;
        state.bothDetected = false;

        const outputData = {
            left: { detected: false },
            right: { detected: false },
            bothDetected: false
        };
        
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            
            // Helper to get raw data bundle
            const handsData = [];
            for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                const landmarks = results.multiHandLandmarks[i];
                const label = results.multiHandedness[i].label;
                const wristX = landmarks[0].x; // Use wrist X for sorting
                handsData.push({ landmarks, label, x: wristX });
            }

            // SPATIAL SORTING LOGIC
            // If 2 hands, FORCE Leftmost -> Left, Rightmost -> Right
            // If 1 hand, Use label (maybe adjusted for mirroring)

            if (handsData.length === 2) {
                // Sort by X coordinate (ascending)
                // 0.0 is left, 1.0 is right
                handsData.sort((a, b) => a.x - b.x);

                // Assign Left (index 0)
                processHand(handsData[0], 'Left');
                
                // Assign Right (index 1)
                processHand(handsData[1], 'Right');
                
                state.bothDetected = true;
                outputData.bothDetected = true;

            } else {
                // Single Hand Case
                // MediaPipe 'Left' usually appears on Right side of screen in mirror mode?
                // Actually, let's trust the label but be consistent. 
                // Or better: Spatial check. If x < 0.5 -> Left, else Right? 
                // Let's stick to the label for strict "Handedness", but many users find 
                // "Left side of screen controls Left" more intuitive.
                // Given the user request for "Pink=Left", let's trust the label provided by MP which is generally robust for single hands.
                
                const hand = handsData[0];
                processHand(hand, hand.label);
            }
        }
        
        // Helper to process a single hand
        function processHand(handDataRaw, forcedLabel) {
             const handKey = forcedLabel.toLowerCase(); // 'left' or 'right'
             
             if (state[handKey]) {
                const handState = state[handKey];
                handState.detected = true;
                handState.lastLandmarks = handDataRaw.landmarks;

                // Draw hand landmarks with the ASSIGNED label color
                drawHand(ctx, handDataRaw.landmarks, canvasElement.width, canvasElement.height, forcedLabel);

                // Extract and smooth gesture data
                const gestureData = extractGestureData(handDataRaw.landmarks, handState);
                
                outputData[handKey] = {
                    detected: true,
                    position: gestureData.position,
                    pinch: gestureData.pinch,
                    rotation: gestureData.rotation,
                    zoom: gestureData.zoom,
                    fist: gestureData.fist
                };
             }
        }
        
        onHandUpdate(outputData);
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
            state.left.baselineZ = null;
            state.right.baselineZ = null;
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
function extractGestureData(landmarks, handState) {
    const wrist = landmarks[LANDMARKS.WRIST];
    const thumbTip = landmarks[LANDMARKS.THUMB_TIP];
    const indexTip = landmarks[LANDMARKS.INDEX_TIP];
    const middleTip = landmarks[LANDMARKS.MIDDLE_TIP];
    
    // Calculate hand center position
    const centerX = wrist.x;
    const centerY = wrist.y;
    const centerZ = wrist.z;
    
    // Initialize baseline Z if not set
    if (handState.baselineZ === null) {
        handState.baselineZ = centerZ;
    }
    
    // Smooth position
    handState.smoothedPosition.x = lerp(handState.smoothedPosition.x, centerX, CONFIG.smoothing.position);
    handState.smoothedPosition.y = lerp(handState.smoothedPosition.y, centerY, CONFIG.smoothing.position);
    handState.smoothedPosition.z = lerp(handState.smoothedPosition.z, centerZ, CONFIG.smoothing.position);
    
    // Calculate pinch distance (thumb to index)
    const pinchDist = distance3D(thumbTip, indexTip);
    const pinchNormalized = Math.min(1, pinchDist / 0.2);
    handState.smoothedPinch = lerp(handState.smoothedPinch, pinchNormalized, CONFIG.smoothing.gesture);
    
    // Calculate hand rotation based on palm orientation
    const palmVector = {
        x: middleTip.x - wrist.x,
        y: middleTip.y - wrist.y,
        z: middleTip.z - wrist.z
    };
    
    const rotationX = Math.atan2(palmVector.z, palmVector.y) * CONFIG.gestures.rotationSensitivity;
    const rotationY = Math.atan2(palmVector.x, palmVector.y) * CONFIG.gestures.rotationSensitivity;
    
    handState.smoothedRotation.x = lerp(handState.smoothedRotation.x, rotationX, CONFIG.smoothing.gesture);
    handState.smoothedRotation.y = lerp(handState.smoothedRotation.y, rotationY, CONFIG.smoothing.gesture);
    
    // Calculate zoom from Z depth change
    const zDelta = (handState.baselineZ - handState.smoothedPosition.z) * CONFIG.gestures.depthSensitivity;
    
    // Detect fist (average finger curl)
    const fistAmount = calculateFistAmount(landmarks);
    
    return {
        position: { ...handState.smoothedPosition },
        pinch: handState.smoothedPinch,
        rotation: { ...handState.smoothedRotation },
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

    // Clamp value between 0 and 1
    return Math.max(0, Math.min(1, totalCurl / fingerTips.length));
}

/**
 * Draws hand landmarks on canvas
 */
/**
 * Draws hand landmarks on canvas
 */
function drawHand(ctx, landmarks, width, height, label) {
    // Draw connections
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],           // Thumb
        [0, 5], [5, 6], [6, 7], [7, 8],           // Index
        [0, 9], [9, 10], [10, 11], [11, 12],      // Middle
        [0, 13], [13, 14], [14, 15], [15, 16],    // Ring
        [0, 17], [17, 18], [18, 19], [19, 20],    // Pinky
        [5, 9], [9, 13], [13, 17]                  // Palm
    ];
    
    // Color scheme based on hand side -- MATCHING 3D OBJECT COLORS
    // LEFT HAND -> PINK (Hue ~320/0.9)
    // RIGHT HAND -> BLUE/CYAN (Hue ~180/0.55)
    
    // Note: 'label' here comes from our Spatial Sorting (Left side of screen = 'Left')
    const isLeft = label === 'Left';
    const mainColor = isLeft ? 'rgba(236, 72, 153, 0.6)' : 'rgba(6, 182, 212, 0.6)'; // Pink vs Cyan
    
    ctx.strokeStyle = mainColor;
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
        
        // Gradient coloring
        ctx.fillStyle = isLeft 
            ? `hsla(${320 + i * 2}, 80%, 60%, 0.9)` // Pink range
            : `hsla(${180 + i * 2}, 80%, 60%, 0.9)`; // Cyan range
        
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
