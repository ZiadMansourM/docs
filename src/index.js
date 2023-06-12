import * as THREE from 'three'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

const emitEvent = (element, eventName, data) => {
  element.dispatchEvent(new window.CustomEvent(eventName, {
    detail: data
  }))
}

const enableCache = () => {
  THREE.Cache.enable = true
}

const disableCache = () => {
  THREE.Cache.enable = false
}

const setCamera = (aspect) => {
  const camera = new THREE.PerspectiveCamera(
    45,
    aspect,
    0.01,
    1000
  )
  camera.position.z = 5
  camera.updateProjectionMatrix()
  return camera
}

const setLights = (scene) => {
  const ambient = new THREE.AmbientLight(0xffffff, 0.15)
  const backLight = new THREE.DirectionalLight(0xffffff, 0.3)
  const keyLight = new THREE.DirectionalLight(
    new THREE.Color('#EEEEEE'),
    0.3
  )
  const fillLight = new THREE.DirectionalLight(
    new THREE.Color('#EEEEEE'),
    0.2
  )

  keyLight.position.set(-100, 0, 100)
  fillLight.position.set(100, 0, 100)
  backLight.position.set(100, 0, -100).normalize()

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6)
  hemiLight.groundColor.setHSL(0.095, 1, 0.95)
  hemiLight.position.set(0, 100, 0)
  scene.add(hemiLight)

  scene.add(ambient)
  scene.add(keyLight)
  scene.add(fillLight)
  scene.add(backLight)

  scene.lights = { keyLight, fillLight, backLight, ambient }
  return scene
}

const setControls = (camera, renderer, isTrackball) => {
  let controls

  if (isTrackball) {
    controls = new TrackballControls(
      camera,
      renderer.domElement
    )
  } else {
    controls = new OrbitControls(
      camera,
      renderer.domElement
    )
  }
  controls.enableZoom = true
  camera.controls = controls
  return controls
}

const setRenderer = (width, height) => {
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setClearColor(new THREE.Color('hsl(0, 0%, 10%)'))
  return renderer
}

const render = (element, renderer, scene, camera, isTrackball) => {
  element.appendChild(renderer.domElement)
  const animate = () => {
    window.requestAnimationFrame(animate)
    renderer.render(scene, camera)
    // trackball controls needs to be updated in the animation loop before it will work
    if (isTrackball) camera.controls.update()
  }
  animate()
  return scene
}

const prepareScene = (domElement, opts) => {
  const scene = new THREE.Scene()
  const element = domElement
  const width = element.offsetWidth
  const height = element.offsetHeight

  const camera = setCamera(width / height)
  const renderer = setRenderer(width, height, scene, camera)
  setControls(camera, renderer, opts.trackball)
  setLights(scene)
  if (opts.grid) {
    showGrid(scene)
  }
  render(element, renderer, scene, camera, opts.trackball)
  window.addEventListener(
    'resize',
    onWindowResize(element, camera, renderer),
    false
  )
  scene.camera = camera
  scene.element = domElement
  return scene
}

const loadObject = (scene, url, materialUrl, callback) => {
  const objLoader = new OBJLoader()
  if (scene.locked) return false
  scene.locked = true

  if (materialUrl) {
    const mtlLoader = new MTLLoader()
    mtlLoader.load(materialUrl, (materials) => {
      materials.preload()
      objLoader.setMaterials(materials)
      loadObj(objLoader, scene, url, callback)
    })
  } else {
    loadObj(objLoader, scene, url, callback)
  }

  return objLoader
}

const loadGlb = (scene, url, callback) => {
  const loader = new GLTFLoader()
  if (scene.locked) {
    return false
  }
  scene.locked = true

  loader.load(url, (gltf) => {
    scene.add(gltf.scene)
    fitCameraToObject(scene.camera, gltf.scene, scene.lights)
    scene.locked = false
    if (callback) {
      callback(gltf)
    }
    emitEvent(scene.element, 'loaded', {gltf})
  },
  (xhr) => {
    if (xhr.total === 0) {
      emitEvent(scene.element, 'loading', {
        loaded: 0,
        total: 100
      })
    } else {
      emitEvent(scene.element, 'loading', {
        loaded: xhr.loaded,
        total: xhr.total
      })
    }
  },
  (err) => {
    emitEvent(scene.element, 'error', {err})
    if (callback) {
      callback(err)
    }
  })

  return loader
}

const loadObj = (objLoader, scene, url, callback) => {
  const material = new THREE.MeshPhongMaterial({ color: 0xbbbbcc })

  objLoader.load(url, (obj) => {
    if (!objLoader.materials) {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = material
        }
      })
    }
    scene.add(obj)
    fitCameraToObject(scene.camera, obj, scene.lights)
    scene.locked = false
    if (callback) callback(obj)
    emitEvent(scene.element, 'loaded', {obj})
  },
  (xhr) => {
    if (xhr.total === 0) {
      emitEvent(scene.element, 'loading', {
        loaded: 0,
        total: 100
      })
    } else {
      emitEvent(scene.element, 'loading', {
        loaded: xhr.loaded,
        total: xhr.total
      })
    }
  },
  (err) => {
    emitEvent(scene.element, 'error', {err})
    if (callback) callback(err)
  })
}

const loadPly = (scene, url, callback) => {
  const plyLoader = new PLYLoader();
  if (scene.locked) {
    return false;
  }
  scene.locked = true;

  scene.children.forEach((obj) => {
    scene.remove(obj)
  })

  plyLoader.load(url, (geometry) => {
    const material = new THREE.MeshPhongMaterial({ color: 0xbbbbcc })
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)
    fitCameraToObject(scene.camera, mesh, scene.lights)
    scene.locked = false
    if (callback) {
      callback(mesh)
    }
    emitEvent(scene.element, 'loaded', { mesh })
  });

  return plyLoader;
}

const loadStl = (scene, url, callback) => {
  const stlLoader = new STLLoader()
  if (scene.locked) {
    return false
  }
  scene.locked = true

  scene.children.forEach((obj) => {
    scene.remove(obj)
  })

  stlLoader.load(url, (geometry) => {
    const material = new THREE.MeshPhongMaterial({ color: 0xbbbbcc })
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)
    fitCameraToObject(scene.camera, mesh, scene.lights)
    scene.locked = false
    if (callback) {
      callback(mesh)
    }
    emitEvent(scene.element, 'loaded', { mesh })
  })

  return stlLoader;
}

const clearScene = (scene) => {
  scene.children.forEach((obj) => {
    if (obj.type === 'Group') {
      scene.remove(obj)
    }
  })
}

const resetCamera = (scene) => {
  scene.camera.controls.reset()
}

const showGrid = (scene) => {
  if (!scene.grid) {
    const size = 10
    const divisions = 10
    const gridHelper = new THREE.GridHelper(size, divisions)
    scene.add(gridHelper)
    scene.grid = gridHelper
  } else {
    scene.grid.visible = true
  }
}

const hideGrid = (scene) => {
  scene.grid.visible = false
}

const goFullScreen = (element) => {
  const hasWebkitFullScreen = 'webkitCancelFullScreen' in document
  const hasMozFullScreen = 'mozCancelFullScreen' in document

  if (hasWebkitFullScreen) {
    element.webkitRequestFullScreen()
    const evt = window.document.createEvent('UIEvents')
    evt.initUIEvent('resize', true, false, window, 0)
    window.dispatchEvent(evt)
    return true
  } else if (hasMozFullScreen) {
    return element.mozRequestFullScreen()
  } else {
    return false
  }
}

const onWindowResize = (element, camera, renderer) => () => {
  const resize = () => {
    const isFullscreen = !window.screenTop && !window.screenY
    const width = isFullscreen ? window.innerWidth : element.offsetWidth
    const height = isFullscreen ? window.innerHeight : element.offsetHeight
    const aspect = width / height
    camera.aspect = aspect
    camera.updateProjectionMatrix()
    renderer.setSize(width, height)
  }
  resize()
  setTimeout(resize, 100)
}

const fitCameraToObject = (camera, object, lights) => {
  const fov = camera.fov
  const boundingBox = new THREE.Box3()
  const size = new THREE.Vector3()
  boundingBox.setFromObject(object)
  resetObjectPosition(boundingBox, object)
  boundingBox.getSize(size)

  let cameraZ = Math.abs(size.y / 2 * Math.tan(fov * 2))
  const z = Math.max(cameraZ, size.z) * 1.5
  camera.position.z = z
  camera.updateProjectionMatrix()

  lights.keyLight.position.set(-z, 0, z)
  lights.fillLight.position.set(z, 0, z)
  lights.backLight.position.set(z, 0, -z)
}

const resetObjectPosition = (boundingBox, object) => {
  const size = new THREE.Vector3()
  boundingBox.setFromObject(object)
  boundingBox.getSize(size)
  object.position.x = -boundingBox.min.x - size.x / 2
  object.position.y = -boundingBox.min.y - size.y / 2
  object.position.z = -boundingBox.min.z - size.z / 2
  object.rotation.z = 0
}

export {
  prepareScene,
  loadObject,
  loadGlb,
  loadPly,
  loadStl,
  clearScene,
  resetCamera,
  goFullScreen,
  showGrid,
  hideGrid,
  enableCache,
  disableCache
}
