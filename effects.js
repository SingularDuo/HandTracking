/**
 * Effects Module
 * Additional visual effects like trails and particle enhancements
 */

import * as THREE from 'three';

/**
 * Creates a particle trail system that follows point movements
 * @param {THREE.Scene} scene - Three.js scene
 * @param {number} maxTrails - Maximum number of trail particles
 * @returns {Object} Trail system with update method
 */
export function createTrailSystem(scene, maxTrails = 200) {
    const positions = new Float32Array(maxTrails * 3);
    const colors = new Float32Array(maxTrails * 3);
    const sizes = new Float32Array(maxTrails);
    const alphas = new Float32Array(maxTrails);
    
    // Initialize with hidden particles
    for (let i = 0; i < maxTrails; i++) {
        positions[i * 3] = 0;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = -1000; // Hidden
        colors[i * 3] = 0.5;
        colors[i * 3 + 1] = 0.3;
        colors[i * 3 + 2] = 1;
        sizes[i] = 0.02;
        alphas[i] = 0;
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const material = new THREE.PointsMaterial({
        size: 0.03,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    
    const trails = new THREE.Points(geometry, material);
    scene.add(trails);
    
    let trailIndex = 0;
    const trailPositions = [];
    
    /**
     * Adds a new trail particle at position
     */
    function addTrail(x, y, z, hue = 0.75) {
        const idx = trailIndex % maxTrails;
        
        positions[idx * 3] = x;
        positions[idx * 3 + 1] = y;
        positions[idx * 3 + 2] = z;
        
        const color = new THREE.Color();
        color.setHSL(hue, 0.8, 0.6);
        colors[idx * 3] = color.r;
        colors[idx * 3 + 1] = color.g;
        colors[idx * 3 + 2] = color.b;
        
        sizes[idx] = 0.03;
        alphas[idx] = 1;
        
        trailIndex++;
        
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.needsUpdate = true;
    }
    
    /**
     * Updates trail particles (fade out over time)
     */
    function update(deltaTime) {
        for (let i = 0; i < maxTrails; i++) {
            if (alphas[i] > 0) {
                alphas[i] -= deltaTime * 0.5;
                sizes[i] *= 0.98;
                
                if (alphas[i] <= 0) {
                    positions[i * 3 + 2] = -1000; // Hide
                }
            }
        }
        
        geometry.attributes.position.needsUpdate = true;
        material.opacity = 0.6;
    }
    
    return {
        trails,
        addTrail,
        update
    };
}

/**
 * Creates ambient floating particles for atmosphere
 * @param {THREE.Scene} scene - Three.js scene
 * @param {number} count - Number of particles
 * @returns {Object} Ambient particle system
 */
export function createAmbientParticles(scene, count = 100) {
    const positions = new Float32Array(count * 3);
    const velocities = [];
    
    for (let i = 0; i < count; i++) {
        // Random position in a large sphere
        const radius = 5 + Math.random() * 10;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = radius * Math.cos(phi);
        
        // Random velocity
        velocities.push({
            x: (Math.random() - 0.5) * 0.01,
            y: (Math.random() - 0.5) * 0.01,
            z: (Math.random() - 0.5) * 0.01
        });
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
        size: 0.02,
        color: 0x8b5cf6,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    
    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    
    /**
     * Updates ambient particle positions
     */
    function update(time) {
        const pos = geometry.attributes.position.array;
        
        for (let i = 0; i < count; i++) {
            const idx = i * 3;
            
            // Gentle floating motion
            pos[idx] += velocities[i].x + Math.sin(time + i) * 0.002;
            pos[idx + 1] += velocities[i].y + Math.cos(time * 0.7 + i) * 0.002;
            pos[idx + 2] += velocities[i].z + Math.sin(time * 0.5 + i) * 0.002;
            
            // Wrap around if too far
            const dist = Math.sqrt(pos[idx] ** 2 + pos[idx + 1] ** 2 + pos[idx + 2] ** 2);
            if (dist > 15) {
                const scale = 5 / dist;
                pos[idx] *= scale;
                pos[idx + 1] *= scale;
                pos[idx + 2] *= scale;
            }
        }
        
        geometry.attributes.position.needsUpdate = true;
        
        // Pulse opacity
        material.opacity = 0.2 + Math.sin(time * 0.5) * 0.1;
    }
    
    return {
        particles,
        update
    };
}

/**
 * Creates a glow ring effect around the main sphere
 * @param {THREE.Scene} scene - Three.js scene
 * @returns {Object} Glow ring with update method
 */
export function createGlowRing(scene) {
    const geometry = new THREE.RingGeometry(1.8, 2.2, 64);
    const material = new THREE.MeshBasicMaterial({
        color: 0x8b5cf6,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
    
    const ring = new THREE.Mesh(geometry, material);
    scene.add(ring);
    
    function update(time) {
        ring.rotation.x = Math.PI / 2 + Math.sin(time * 0.3) * 0.1;
        ring.rotation.z = time * 0.2;
        
        // Pulse scale
        const scale = 1 + Math.sin(time * 0.8) * 0.05;
        ring.scale.setScalar(scale);
        
        // Color cycle
        const hue = (0.75 + time * 0.02) % 1;
        material.color.setHSL(hue, 0.8, 0.5);
    }
    
    return {
        ring,
        update
    };
}
