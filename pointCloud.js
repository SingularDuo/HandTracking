/**
 * Point Cloud Module
 * Creates and animates a sphere with rings point cloud
 */

import * as THREE from 'three';

// Point cloud configuration
const CONFIG = {
    // Sphere parameters
    sphere: {
        radius: 1.5,
        segments: 64,          // Points per ring
        rings: 40,             // Number of rings
        pointSize: 0.03,
        pointSizeVariation: 0.01
    },
    // Ring parameters
    ringCount: 5,              // Number of distinct orbital rings
    ringSpacing: 0.4,          // Spacing between orbital rings
    // Animation
    animation: {
        rotationSpeed: 0.1,
        pulseSpeed: 2,
        pulseAmount: 0.15,
        colorCycleSpeed: 0.2, 
        waveSpeed: 1.5,
        waveAmount: 0.05
    },
    // Colors (HSL values for cycling)
    colors: {
        primary: { h: 0.75, s: 0.8, l: 0.6 },    // Purple
        secondary: { h: 0.55, s: 0.9, l: 0.5 },  // Cyan
        tertiary: { h: 0.9, s: 0.8, l: 0.6 }     // Pink
    }
};

/**
 * Creates the main point cloud with sphere and rings
 * @param {THREE.Scene} scene - Three.js scene
 * @returns {Object} Point cloud object with update methods
 */
/**
 * Creates the main point cloud with sphere and rings
 * @param {THREE.Scene} scene - Three.js scene
 * @param {string} type - 'center' | 'side'
 * @param {number} colorHue - Base hue for the object
 * @returns {Object} Point cloud object with update methods
 */
/**
 * Creates the main point cloud with sphere and rings
 * @param {THREE.Scene} scene - Three.js scene
 * @returns {Object} Point cloud object with update methods
 */
export function createPointCloud(scene) {
    const group = new THREE.Group();
    
    // We'll initialize with "Max" settings (Center-like) to allocate enough points
    const config = { ...CONFIG };
    config.colors = { ...CONFIG.colors, primary: { ...CONFIG.colors.primary } };
    
    // Create geometry with max settings
    const sphereGeometry = createSphereGeometry(config);
    const sphereMaterial = createPointMaterial(config);
    const spherePoints = new THREE.Points(sphereGeometry, sphereMaterial);
    
    // Store original positions for animation
    const originalPositions = [];
    const positions = sphereGeometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
        originalPositions.push({
            x: positions[i],
            y: positions[i + 1],
            z: positions[i + 2]
        });
    }
    
    group.add(spherePoints);
    
    // Create orbital rings (max count)
    const rings = [];
    for (let i = 0; i < config.ringCount; i++) {
        const ring = createOrbitalRing(i, config);
        rings.push(ring);
        group.add(ring.points);
    }
    
    scene.add(group);
    
    // Visual State Management
    // We lerp these values every frame
    const currentState = {
        hue: config.colors.primary.h,
        waveAmount: 0,          // 0 = perfect sphere, >0 = wavy
        radiusScale: 1.0,       // 1.0 = center size, 0.7 = side size
        spinSpeedMultiplier: 1, // 1 = normal, >1 = fast
        opacity: 1.0            // Master opacity
    };
    
    const targetState = { ...currentState };
    
    // Transform State (Interactive)
    const transformState = {
        targetScale: 1,
        currentScale: 1,
        targetRotationX: 0,
        targetRotationY: 0,
        currentRotationX: 0,
        currentRotationY: 0,
        targetZoom: 0,
        currentZoom: 0
    };
    
    /**
     * Updates point cloud visuals and physics
     */
    function update(time) {
        // 1. Lerp Visual State (Smooth transition between Center/Side modes)
        const lerpSpeed = 0.05;
        currentState.hue += (targetState.hue - currentState.hue) * lerpSpeed;
        currentState.waveAmount += (targetState.waveAmount - currentState.waveAmount) * lerpSpeed;
        currentState.radiusScale += (targetState.radiusScale - currentState.radiusScale) * lerpSpeed;
        currentState.spinSpeedMultiplier += (targetState.spinSpeedMultiplier - currentState.spinSpeedMultiplier) * lerpSpeed;
        currentState.opacity += (targetState.opacity - currentState.opacity) * lerpSpeed;

        // Apply Opacity
        sphereMaterial.opacity = 0.9 * currentState.opacity;
        sphereMaterial.visible = currentState.opacity > 0.01;
        rings.forEach(r => {
             r.points.material.opacity = 0.6 * currentState.opacity;
             r.points.visible = currentState.opacity > 0.01;
        });

        // 2. Lerp Interactive Transforms
        transformState.currentScale += (transformState.targetScale - transformState.currentScale) * 0.1;
        transformState.currentRotationX += (transformState.targetRotationX - transformState.currentRotationX) * 0.1;
        transformState.currentRotationY += (transformState.targetRotationY - transformState.currentRotationY) * 0.1;
        transformState.currentZoom += (transformState.targetZoom - transformState.currentZoom) * 0.08;
        
        // 3. Apply Group Transforms
        // Base scale combined with visual mode radius scale
        group.scale.setScalar(transformState.currentScale * currentState.radiusScale);
        
        // Rotation: Mix of auto-spin and user control
        // If waveAmount is high (Side mode), we allow more X rotation
        const userRotInfluence = Math.min(1, currentState.waveAmount * 5); // 0 at center, 1 at side
        
        // Auto spin (Y)
        const autoSpin = time * 0.05 * currentState.spinSpeedMultiplier;
        
        group.rotation.y = autoSpin + transformState.currentRotationY;
        // X rotation: mostly user controlled, but stabilized when in 'center' mode
        group.rotation.x = (Math.sin(time * 0.2) * 0.05) * (1 - userRotInfluence) + transformState.currentRotationX * userRotInfluence;
        
        group.position.z = transformState.currentZoom;
        
        // 4. Animate Points
        animateSpherePoints(sphereGeometry, originalPositions, time, currentState);
        
        // 5. Animate Rings
        rings.forEach((ring, i) => {
            // Rings rotate faster/differently based on mode? 
            // Keep it simple for continuity
            ring.points.rotation.x = time * 0.1 * (i % 2 === 0 ? 1 : -1);
            ring.points.rotation.y = time * 0.05;
            
            // Fade out outer rings if scaling down
            // If radiusScale < 0.8, hide outer rings? 
            // Let's just scale them with the group for now.
            
            animateRingPoints(ring, time, i, currentState);
        });
        
        // 6. Pulse & Color
        const pulse = 1 + Math.sin(time * CONFIG.animation.pulseSpeed) * CONFIG.animation.pulseAmount * currentState.spinSpeedMultiplier;
        sphereMaterial.size = CONFIG.sphere.pointSize * pulse;
        
        // Color
        // Dynamic hue cycling if it's the specific side hue (optional)
        // For now just stick to current Hue
        const cycle = Math.sin(time * 0.2) * 0.05;
        // If strictly center (waveAmount 0), less cycle
        const cycleAmount = cycle * Math.min(1, currentState.waveAmount * 2);
        
        sphereMaterial.color.setHSL(currentState.hue + cycleAmount, 0.8, 0.6);
    }
    
    /**
     * Sets the high-level visual mode parameters
     * @param {Object} params - { hue, waveAmount, radiusScale, opacity }
     */
    function setVisualState(params) {
        if (params.hue !== undefined) targetState.hue = params.hue;
        if (params.waveAmount !== undefined) targetState.waveAmount = params.waveAmount;
        if (params.radiusScale !== undefined) targetState.radiusScale = params.radiusScale;
        if (params.spinSpeed !== undefined) targetState.spinSpeedMultiplier = params.spinSpeed;
        if (params.opacity !== undefined) targetState.opacity = params.opacity;
    }
    
    // ... Control methods ...
    function setScale(scale) {
        transformState.targetScale = Math.max(0.1, Math.min(3, scale));
    }
    function setRotation(x, y) {
        transformState.targetRotationX = x;
        transformState.targetRotationY = y;
    }
    function setZoom(zoom) {
        transformState.targetZoom = Math.max(-5, Math.min(2, zoom));
    }

    return {
        group,
        update,
        setVisualState, // New API
        setScale,
        setRotation,
        setZoom
    };
}

/**
 * Creates sphere geometry with points distributed over surface
 */
function createSphereGeometry() {
    const { radius, segments, rings } = CONFIG.sphere;
    const positions = [];
    const colors = [];
    const sizes = [];
    
    // Generate points on sphere surface using fibonacci sphere
    const totalPoints = segments * rings;
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    
    for (let i = 0; i < totalPoints; i++) {
        // Fibonacci sphere distribution
        const theta = 2 * Math.PI * i / goldenRatio;
        const phi = Math.acos(1 - 2 * (i + 0.5) / totalPoints);
        
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi);
        
        positions.push(x, y, z);
        
        // Gradient color based on position
        const t = (y / radius + 1) / 2;
        const color = new THREE.Color();
        color.setHSL(
            CONFIG.colors.primary.h + t * 0.2,
            CONFIG.colors.primary.s,
            CONFIG.colors.primary.l + t * 0.2
        );
        colors.push(color.r, color.g, color.b);
        
        // Random size variation
        sizes.push(CONFIG.sphere.pointSize + (Math.random() - 0.5) * CONFIG.sphere.pointSizeVariation);
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    
    return geometry;
}

/**
 * Creates custom point material with glow effect
 */
function createPointMaterial() {
    return new THREE.PointsMaterial({
        size: CONFIG.sphere.pointSize,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
    });
}

/**
 * Creates an orbital ring of particles
 */
/**
 * Creates an orbital ring of particles
 */
function createOrbitalRing(index, config) {
    const radius = config.sphere.radius + (index + 1) * config.ringSpacing;
    const segments = 80 + index * 20;
    const positions = [];
    const colors = [];
    const originalPositions = [];
    
    for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const x = radius * Math.cos(angle);
        const y = 0;
        const z = radius * Math.sin(angle);
        
        positions.push(x, y, z);
        originalPositions.push({ x, y, z, angle });
        
        // Color varies along ring
        const color = new THREE.Color();
        // Use complementary or analogous color
        const hue = (config.colors.primary.h + 0.5 + index * 0.05) % 1; 
        color.setHSL(hue, 0.8, 0.6);
        colors.push(color.r, color.g, color.b);
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    const material = new THREE.PointsMaterial({
        size: config.sphere.pointSize * 0.7,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
    });
    
    const points = new THREE.Points(geometry, material);
    
    return { points, geometry, originalPositions, radius };
}

/**
 * Animates sphere points - STABLE (Center)
 */
/**
 * Animates sphere points blending between Stable (Center) and Dynamic (Side) based on state
 */
function animateSpherePoints(geometry, originalPositions, time, state) {
    const positions = geometry.attributes.position.array;
    const waveInfluence = Math.min(1, state.waveAmount * 2); // 0 to 1
    
    for (let i = 0; i < originalPositions.length; i++) {
        const orig = originalPositions[i];
        const idx = i * 3;
        
        // 1. Stable Behavior (Breathing)
        const breathe = 1 + Math.sin(time * 2) * 0.005 * state.spinSpeedMultiplier;
        
        // 2. Dynamic Behavior (Wave)
        const wave = Math.sin(orig.y * 4 + time * CONFIG.animation.waveSpeed) * CONFIG.animation.waveAmount;
        const wave2 = Math.cos(orig.x * 3 + time * CONFIG.animation.waveSpeed * 0.7) * CONFIG.animation.waveAmount * 0.5;
        const dynamicFactor = 1 + wave + wave2;

        // Blend based on waveInfluence
        // If waveInfluence is 0, we use breathe. If 1, we use dynamicFactor.
        const startX = orig.x * breathe;
        const startY = orig.y * breathe;
        const startZ = orig.z * breathe;
        
        const endX = orig.x * dynamicFactor;
        const endY = orig.y * dynamicFactor;
        const endZ = orig.z * dynamicFactor;

        positions[idx] = startX + (endX - startX) * waveInfluence;
        positions[idx + 1] = startY + (endY - startY) * waveInfluence;
        positions[idx + 2] = startZ + (endZ - startZ) * waveInfluence;
    }
    
    geometry.attributes.position.needsUpdate = true;
}

/**
 * Animates ring points blending behaviors
 */
function animateRingPoints(ring, time, index, state) {
    const positions = ring.geometry.attributes.position.array;
    const waveInfluence = Math.min(1, state.waveAmount * 2); 
    
    for (let i = 0; i < ring.originalPositions.length; i++) {
        const orig = ring.originalPositions[i];
        const idx = i * 3;
        
        // Stable chaos vs Dynamic chaos
        const stableChaos = 0.02;
        const dynamicChaos = 0.1;
        const chaos = stableChaos + (dynamicChaos - stableChaos) * waveInfluence;
        
        const yOffset = Math.sin(orig.angle * 3 + time * 2 + index) * chaos;
        const radiusOffset = Math.sin(orig.angle * 5 + time * 1.5) * (chaos * 0.5);
        
        const r = ring.radius + radiusOffset;
        positions[idx] = r * Math.cos(orig.angle);
        positions[idx + 1] = yOffset;
        positions[idx + 2] = r * Math.sin(orig.angle);
    }
    
    ring.geometry.attributes.position.needsUpdate = true;
}
