/**
 * Scene Module
 * Sets up Three.js scene, camera, renderer, and post-processing effects
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// Scene configuration
const CONFIG = {
    camera: {
        fov: 60,
        near: 0.1,
        far: 1000,
        position: { x: 0, y: 0, z: 5 }
    },
    bloom: {
        strength: 1.5,
        radius: 0.8,
        threshold: 0.2
    }
};

/**
 * Creates and configures the Three.js scene
 * @param {HTMLElement} container - DOM element to attach renderer
 * @returns {Object} Scene components (scene, camera, renderer, composer)
 */
export function createScene(container) {
    // Create scene with dark background
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);

    // Setup camera with responsive aspect ratio
    const aspect = window.innerWidth / window.innerHeight;
    const camera = new THREE.PerspectiveCamera(
        CONFIG.camera.fov,
        aspect,
        CONFIG.camera.near,
        CONFIG.camera.far
    );
    camera.position.set(
        CONFIG.camera.position.x,
        CONFIG.camera.position.y,
        CONFIG.camera.position.z
    );

    // Create WebGL renderer with antialiasing
    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap for performance
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // Setup post-processing with bloom effect
    const composer = new EffectComposer(renderer);
    
    // Base render pass
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    
    // Bloom pass for glow effect
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        CONFIG.bloom.strength,
        CONFIG.bloom.radius,
        CONFIG.bloom.threshold
    );
    composer.addPass(bloomPass);

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    return { scene, camera, renderer, composer, bloomPass };
}

/**
 * Handles window resize events
 * @param {Object} sceneComponents - Scene components from createScene
 */
export function handleResize(sceneComponents) {
    const { camera, renderer, composer } = sceneComponents;
    
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
    composer.setSize(width, height);
}
