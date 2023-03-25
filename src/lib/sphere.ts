import * as THREE from "three";

export function createThreeDSphere(canvas: HTMLCanvasElement) {
  // Set the dimensions of the canvas
  const width = 300;
  const height = 300;
  canvas.width = width;
  canvas.height = height;

  // Create a new Three.js scene
  const scene = new THREE.Scene();

  // Create a new camera and position it in the center of the scene
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.set(0, 0, 10);

  // Create a new wireframe sphere
  const sphereGeometry = new THREE.SphereGeometry(5, 10, 10);
  const sphereMaterial = new THREE.MeshBasicMaterial({
    wireframe: true,
    color: "#00ff00",
  });
  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);

  // Add the sphere to the scene
  scene.add(sphere);

  // Create a new renderer
  const renderer = new THREE.WebGLRenderer({ canvas });

  // Set the background color of the renderer
  // renderer.setClearColor("#333");

  // Define the animate function
  function animate() {
    // Rotate the sphere
    sphere.rotation.x += 0.01;
    sphere.rotation.y += 0.01;

    // Render the scene
    renderer.render(scene, camera);

    // Request a new animation frame
    requestAnimationFrame(animate);
  }

  // Return the animate function
  return { animate };
}