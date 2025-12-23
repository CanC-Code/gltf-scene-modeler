import { ViewGizmo } from "./viewGizmo.js";

const viewGizmo = new ViewGizmo(camera, controls);

// In render loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);

  // Update view cube
  viewGizmo.update();
}
animate();
