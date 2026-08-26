import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

const viewer = document.getElementById("model-viewer");
const status = document.getElementById("model-status");
const resetButton = document.getElementById("model-reset");
const fullscreenButton = document.getElementById("model-fullscreen");

if (viewer && status && resetButton && fullscreenButton) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  viewer.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.screenSpacePanning = true;
  controls.minDistance = 50;
  controls.maxDistance = 20000;

  scene.add(new THREE.HemisphereLight(0xffffff, 0xaab5ae, 2.3));
  const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
  keyLight.position.set(3, 5, 4);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xd9eee5, 1.6);
  fillLight.position.set(-4, 2, -3);
  scene.add(fillLight);

  let homePosition = new THREE.Vector3(1000, 850, 1000);
  let homeTarget = new THREE.Vector3();

  function resetView() {
    camera.position.copy(homePosition);
    controls.target.copy(homeTarget);
    controls.update();
  }

  function resize() {
    const width = Math.max(1, viewer.clientWidth);
    const height = Math.max(1, viewer.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  async function loadModel() {
    const modelPath = "./models/redhill-peaks/";
    const materialLoader = new MTLLoader();
    materialLoader.setPath(modelPath);
    materialLoader.setResourcePath(modelPath);
    const materials = await materialLoader.loadAsync("redhill-peaks.mtl");
    materials.preload();

    const objectLoader = new OBJLoader();
    objectLoader.setPath(modelPath);
    objectLoader.setMaterials(materials);
    const flat = await objectLoader.loadAsync("redhill-peaks.obj");
    flat.traverse((child) => {
      if (!child.isMesh) return;
      const meshMaterials = Array.isArray(child.material) ? child.material : [child.material];
      meshMaterials.forEach((material) => {
        material.side = THREE.DoubleSide;
        if (material.name === "Glass") {
          material.transparent = true;
          material.opacity = 0.18;
          material.depthWrite = false;
        }
      });
    });

    const originalBox = new THREE.Box3().setFromObject(flat);
    const originalCenter = originalBox.getCenter(new THREE.Vector3());
    flat.position.set(-originalCenter.x, -originalBox.min.y, -originalCenter.z);
    scene.add(flat);

    const box = new THREE.Box3().setFromObject(flat);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const largestDimension = Math.max(size.x, size.y, size.z);
    homeTarget = center;
    homePosition = center.clone().add(new THREE.Vector3(
      largestDimension * 0.9,
      largestDimension * 0.72,
      largestDimension * 0.9,
    ));
    camera.near = Math.max(0.1, largestDimension / 1000);
    camera.far = largestDimension * 100;
    camera.updateProjectionMatrix();
    controls.minDistance = largestDimension * 0.15;
    controls.maxDistance = largestDimension * 8;
    resetView();
    status.hidden = true;
  }

  resetButton.addEventListener("click", resetView);
  fullscreenButton.addEventListener("click", async () => {
    if (document.fullscreenElement === viewer) await document.exitFullscreen();
    else await viewer.requestFullscreen();
  });
  document.addEventListener("fullscreenchange", () => {
    fullscreenButton.textContent = document.fullscreenElement === viewer ? "×" : "⛶";
    fullscreenButton.setAttribute(
      "aria-label",
      document.fullscreenElement === viewer ? "Exit full screen" : "Open 3D view in full screen",
    );
    resize();
  });

  new ResizeObserver(resize).observe(viewer);
  resize();
  loadModel().catch(() => {
    status.textContent = "The 3D flat could not be loaded. Please reload the page.";
    status.classList.add("error");
  });

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });
}
