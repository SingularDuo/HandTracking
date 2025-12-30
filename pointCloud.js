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
export function createPointCloud(scene) {
    const group = new THREE.Group();
    
    // Store original positions for animation
    const originalPositions = [];
    
    // Create main sphere point cloud
    const sphereGeometry = createSphereGeometry();
    const sphereMaterial = createPointMaterial();
    const spherePoints = new THREE.Points(sphereGeometry, sphereMaterial);
    
    // Store original positions
    const positions = sphereGeometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
        originalPositions.push({
            x: positions[i],
            y: positions[i + 1],
            z: positions[i + 2]
        });
    }
    
    group.add(spherePoints);
    
    // Create orbital rings
    const rings = [];
    for (let i = 0; i < CONFIG.ringCount; i++) {
        const ring = createOrbitalRing(i);
        rings.push(ring);
        group.add(ring.points);
    }
    
    scene.add(group);
    
    // Transform state (controlled by hand)
    const state = {
        targetScale: 1,
        currentScale: 1,
        targetRotationX: 0,
        targetRotationY: 0,
        currentRotationX: 0,
        currentRotationY: 0,
        targetZoom: 0,
        currentZoom: 0,
        particleDensity: 1  // 0-1, affects opacity
    };
    
    /**
     * Updates point cloud based on time and hand input
     * @param {number} time - Elapsed time in seconds
     */
    function update(time) {
        // Smooth interpolation of transforms
        state.currentScale += (state.targetScale - state.currentScale) * 0.08;
        state.currentRotationX += (state.targetRotationX - state.currentRotationX) * 0.06;
        state.currentRotationY += (state.targetRotationY - state.currentRotationY) * 0.06;
        state.currentZoom += (state.targetZoom - state.currentZoom) * 0.05;
        
        // Apply transforms to group
        group.scale.setScalar(state.currentScale);
        group.rotation.x = state.currentRotationX + time * CONFIG.animation.rotationSpeed * 0.3;
        group.rotation.y = state.currentRotationY + time * CONFIG.animation.rotationSpeed;
        group.position.z = state.currentZoom;
        
        // Animate sphere points
        animateSpherePoints(sphereGeometry, originalPositions, time);
        
        // Animate orbital rings
        rings.forEach((ring, i) => {
            ring.points.rotation.x = time * 0.5 * (i % 2 === 0 ? 1 : -1);
            ring.points.rotation.y = time * 0.3 * (i % 2 === 0 ? -1 : 1);
            ring.points.rotation.z = time * 0.2;
            animateRingPoints(ring, time, i);
        });
        
        // Pulse point sizes
        const pulse = 1 + Math.sin(time * CONFIG.animation.pulseSpeed) * CONFIG.animation.pulseAmount;
        sphereMaterial.size = CONFIG.sphere.pointSize * pulse;
        
        // Cycle colors
        const hue = (CONFIG.colors.primary.h + time * CONFIG.animation.colorCycleSpeed * 0.1) % 1;
        sphereMaterial.color.setHSL(hue, CONFIG.colors.primary.s, CONFIG.colors.primary.l);
    }
    
    /**
     * Sets target scale (controlled by pinch gesture)
     */
    function setScale(scale) {
        state.targetScale = Math.max(0.3, Math.min(3, scale));
    }
    
    /**
     * Sets target rotation (controlled by hand rotation)
     */
    function setRotation(x, y) {
        state.targetRotationX = x;
        state.targetRotationY = y;
    }
    
    /**
     * Sets zoom level (controlled by hand depth)
     */
    function setZoom(zoom) {
        state.targetZoom = Math.max(-3, Math.min(3, zoom));
    }
    
    return {
        group,
        update,
        setScale,
        setRotation,
        setZoom,
        state
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
function createOrbitalRing(index) {
    const radius = CONFIG.sphere.radius + (index + 1) * CONFIG.ringSpacing;
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
        const hue = (CONFIG.colors.secondary.h + index * 0.1 + i / segments * 0.1) % 1;
        color.setHSL(hue, CONFIG.colors.secondary.s, CONFIG.colors.secondary.l);
        colors.push(color.r, color.g, color.b);
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    const material = new THREE.PointsMaterial({
        size: CONFIG.sphere.pointSize * 0.7,
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
    });
    
    const points = new THREE.Points(geometry, material);
    
    return { points, geometry, originalPositions, radius };
}

/**
 * Animates sphere points with wave effect
 */
function animateSpherePoints(geometry, originalPositions, time) {
    const positions = geometry.attributes.position.array;
    
    for (let i = 0; i < originalPositions.length; i++) {
        const orig = originalPositions[i];
        const idx = i * 3;
        
        // Wave displacement
        const wave = Math.sin(orig.y * 4 + time * CONFIG.animation.waveSpeed) * CONFIG.animation.waveAmount;
        const wave2 = Math.cos(orig.x * 3 + time * CONFIG.animation.waveSpeed * 0.7) * CONFIG.animation.waveAmount * 0.5;
        
        // Apply wave to position (radially outward)
        const length = Math.sqrt(orig.x ** 2 + orig.y ** 2 + orig.z ** 2);
        const factor = 1 + wave + wave2;
        
        positions[idx] = orig.x * factor;
        positions[idx + 1] = orig.y * factor;
        positions[idx + 2] = orig.z * factor;
    }
    
    geometry.attributes.position.needsUpdate = true;
}

/**
 * Animates ring points with oscillation
 */
function animateRingPoints(ring, time, index) {
    const positions = ring.geometry.attributes.position.array;
    
    for (let i = 0; i < ring.originalPositions.length; i++) {
        const orig = ring.originalPositions[i];
        const idx = i * 3;
        
        // Oscillate along Y axis
        const yOffset = Math.sin(orig.angle * 3 + time * 2 + index) * 0.1;
        // Slight radius variation
        const radiusOffset = Math.sin(orig.angle * 5 + time * 1.5) * 0.05;
        
        const r = ring.radius + radiusOffset;
        positions[idx] = r * Math.cos(orig.angle);
        positions[idx + 1] = yOffset;
        positions[idx + 2] = r * Math.sin(orig.angle);
    }
    
    ring.geometry.attributes.position.needsUpdate = true;
}
