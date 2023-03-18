import * as THREE from 'three';

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
camera.position.z = 10;

let renderer: THREE.WebGLRenderer
// const renderer = new THREE.WebGLRenderer();
// renderer.setSize(450, 450);

// Create a new wireframe sphere geometry and material
const sphereGeometry = new THREE.SphereGeometry(6, 10, 10);
const sphereMaterial = new THREE.MeshBasicMaterial({
  color: 0x00ff00,
  wireframe: true
});

// Add the wireframe sphere to the Three.js scene
const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
scene.add(sphere);

// Add a spinning animation to the wireframe sphere
const animate = () => {
  sphere.rotation.y += 0.01;
  sphere.rotation.x += 0.01;
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

export const createScene = (el: any) => {
	renderer = new THREE.WebGLRenderer({ antialias: true, canvas: el });
  renderer.setSize(200, 200);
	animate();
};