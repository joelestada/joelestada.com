/**
 * La parte de three.js que usa la web: el empaquetador sirve este módulo cuando alguien importa 'three'
 * (alias en next.config.ts). Así no viaja three.js entero: el <Canvas> de R3F registra todo lo que
 * exporta 'three' como elementos JSX (`extend(THREE)`) y con el paquete completo arrastraba cargadores,
 * animación, audio, ayudas y geometrías que la nave no usa (medido: three pasa de 685 a 380 KB sin
 * comprimir y la portada descarga 35 KB menos con gzip).
 *
 * Tiene que estar todo lo que piden:
 * - el código de la escena (`THREE.X`) y los elementos JSX de la nave (<mesh>, <boxGeometry>…);
 * - R3F (cámaras, raycaster, reloj, renderer, constantes de sombras y tono);
 * - utils/BufferGeometryUtils de los ejemplos de three.
 * Si falta algo que se usa como `THREE.X`, la build falla («Export X doesn't exist in target module»).
 * Un elemento JSX que falte solo se nota al cargar: la nave no llega a montarse y la portada pasa a
 * láminas (también en desarrollo, donde se ve al momento). Al usar una clase nueva, añadirla aquí.
 *
 * Cada clase sale de su propio archivo de three/src: el empaquetador solo incluye esos módulos y sus
 * dependencias, sin depender de que sepa podar un archivo de 1 MB.
 */
export { Camera } from 'three/src/cameras/Camera.js';
export { OrthographicCamera } from 'three/src/cameras/OrthographicCamera.js';
export { PerspectiveCamera } from 'three/src/cameras/PerspectiveCamera.js';
export {
  ACESFilmicToneMapping,
  BasicShadowMap,
  DoubleSide,
  DynamicDrawUsage,
  FloatType,
  LinearFilter,
  LinearSRGBColorSpace,
  NearestFilter,
  NoColorSpace,
  NoToneMapping,
  PCFShadowMap,
  PCFSoftShadowMap,
  RGBAFormat,
  RedFormat,
  SRGBColorSpace,
  TriangleFanDrawMode,
  TriangleStripDrawMode,
  TrianglesDrawMode,
  UnsignedByteType,
  VSMShadowMap,
} from 'three/src/constants.js';
export { BufferAttribute, Float32BufferAttribute } from 'three/src/core/BufferAttribute.js';
export { BufferGeometry } from 'three/src/core/BufferGeometry.js';
export { Clock } from 'three/src/core/Clock.js';
export { InstancedBufferAttribute } from 'three/src/core/InstancedBufferAttribute.js';
export { InterleavedBuffer } from 'three/src/core/InterleavedBuffer.js';
export { InterleavedBufferAttribute } from 'three/src/core/InterleavedBufferAttribute.js';
export { Layers } from 'three/src/core/Layers.js';
export { Object3D } from 'three/src/core/Object3D.js';
export { Raycaster } from 'three/src/core/Raycaster.js';
export { Curve } from 'three/src/extras/core/Curve.js';
export { CurvePath } from 'three/src/extras/core/CurvePath.js';
export { Path } from 'three/src/extras/core/Path.js';
export { Shape } from 'three/src/extras/core/Shape.js';
export { CatmullRomCurve3 } from 'three/src/extras/curves/CatmullRomCurve3.js';
export { LineCurve3 } from 'three/src/extras/curves/LineCurve3.js';
export { QuadraticBezierCurve3 } from 'three/src/extras/curves/QuadraticBezierCurve3.js';
export { BoxGeometry } from 'three/src/geometries/BoxGeometry.js';
export { CapsuleGeometry } from 'three/src/geometries/CapsuleGeometry.js';
export { CircleGeometry } from 'three/src/geometries/CircleGeometry.js';
export { CylinderGeometry } from 'three/src/geometries/CylinderGeometry.js';
export { ExtrudeGeometry } from 'three/src/geometries/ExtrudeGeometry.js';
export { LatheGeometry } from 'three/src/geometries/LatheGeometry.js';
export { PlaneGeometry } from 'three/src/geometries/PlaneGeometry.js';
export { SphereGeometry } from 'three/src/geometries/SphereGeometry.js';
export { TorusGeometry } from 'three/src/geometries/TorusGeometry.js';
export { AmbientLight } from 'three/src/lights/AmbientLight.js';
export { DirectionalLight } from 'three/src/lights/DirectionalLight.js';
export { LineBasicMaterial } from 'three/src/materials/LineBasicMaterial.js';
export { Material } from 'three/src/materials/Material.js';
export { MeshBasicMaterial } from 'three/src/materials/MeshBasicMaterial.js';
export { MeshToonMaterial } from 'three/src/materials/MeshToonMaterial.js';
export { ShaderMaterial } from 'three/src/materials/ShaderMaterial.js';
export { Box3 } from 'three/src/math/Box3.js';
export { Color } from 'three/src/math/Color.js';
export { ColorManagement } from 'three/src/math/ColorManagement.js';
export { MathUtils } from 'three/src/math/MathUtils.js';
export { Matrix3 } from 'three/src/math/Matrix3.js';
export { Matrix4 } from 'three/src/math/Matrix4.js';
export { Quaternion } from 'three/src/math/Quaternion.js';
export { Ray } from 'three/src/math/Ray.js';
export { Sphere } from 'three/src/math/Sphere.js';
export { Vector2 } from 'three/src/math/Vector2.js';
export { Vector3 } from 'three/src/math/Vector3.js';
export { Vector4 } from 'three/src/math/Vector4.js';
export { Group } from 'three/src/objects/Group.js';
export { InstancedMesh } from 'three/src/objects/InstancedMesh.js';
export { LineSegments } from 'three/src/objects/LineSegments.js';
export { Mesh } from 'three/src/objects/Mesh.js';
export { WebGLRenderTarget } from 'three/src/renderers/WebGLRenderTarget.js';
export { WebGLRenderer } from 'three/src/renderers/WebGLRenderer.js';
export { Scene } from 'three/src/scenes/Scene.js';
export { CanvasTexture } from 'three/src/textures/CanvasTexture.js';
export { DataTexture } from 'three/src/textures/DataTexture.js';
export { DepthTexture } from 'three/src/textures/DepthTexture.js';
export { Texture } from 'three/src/textures/Texture.js';
