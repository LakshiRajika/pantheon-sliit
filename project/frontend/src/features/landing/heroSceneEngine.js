// Procedural 3D port scene for the landing hero: calm ocean, a container ship sailing in to the
// quay, a gantry crane moving containers between ship and dock in a loop, a container yard,
// a ship on the horizon, buoys, fog and a slow camera drift. No external models or images.
import * as THREE from 'three'

// Brand colours and tints/shades of them only.
const C = {
  cream: '#F3EEE3',
  creamShade: '#E8E0CF',
  sea: '#CFCAC0', // cream shaded with ink
  ink: '#111111',
  inkTint: '#2A2A2A',
  orange: '#D9541E',
  orangeShade: '#B8441A',
}

const CL = 1.55
const CH = 0.62
const CW = 0.66
const DECK_Y = 2.06
const QUAY_Y = 1.5
const LANE_Z = -1.6
const SAFE_Y = 6.2
const TROLLEY_Y = 9.05
const BAYS = [-4.9, -3.25, -1.6, 0.05, 1.7, 3.35, 5.0]
const ROWS = [-1.0, -0.335, 0.335, 1.0]
const MOVING_ROWS = [1, 2, 0, 3, 1, 2, 0]
const SHIP_START_X = -36
const ARRIVAL_SECONDS = 14

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const easeOut = (t) => 1 - (1 - t) ** 3

function seeded(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function ribbed(hex) {
  const c = document.createElement('canvas')
  c.width = 64; c.height = 32
  const g = c.getContext('2d')
  g.fillStyle = hex; g.fillRect(0, 0, 64, 32)
  g.fillStyle = 'rgba(17,17,17,0.13)'
  for (let x = 2; x < 64; x += 5) g.fillRect(x, 0, 2, 32)
  g.fillStyle = 'rgba(17,17,17,0.22)'
  g.fillRect(0, 0, 64, 2); g.fillRect(0, 30, 64, 2)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function createHeroScene(host, { reducedMotion = false, lowDetail = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: !lowDetail, alpha: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowDetail ? 1.5 : 2))
  renderer.setClearColor(0x000000, 0) // transparent: the CSS sky gradient shows through
  renderer.shadowMap.enabled = !lowDetail
  renderer.shadowMap.type = THREE.PCFShadowMap
  const canvas = renderer.domElement
  canvas.setAttribute('aria-hidden', 'true')
  Object.assign(canvas.style, { display: 'block', width: '100%', height: '100%' })
  host.appendChild(canvas)

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(C.cream, 30, 78)

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200)
  const LOOK = new THREE.Vector3(0, 3.4, 0)
  const CAM_BASE = new THREE.Vector3(20, 12, 29)
  const cam = CAM_BASE.clone()

  scene.add(new THREE.HemisphereLight(C.cream, C.inkTint, 1.25))
  const sun = new THREE.DirectionalLight(C.cream, 2.6)
  sun.position.set(14, 22, 12)
  sun.castShadow = !lowDetail
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 70 })
  sun.shadow.bias = -0.0005
  scene.add(sun)

  // ---------- helpers
  const materials = new Map()
  const mat = (color) => {
    if (!materials.has(color)) {
      materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.05, flatShading: true }))
    }
    return materials.get(color)
  }
  const box = (w, h, d, color, x, y, z, parent = scene, cast = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color))
    m.position.set(x, y, z)
    m.castShadow = cast && !lowDetail
    m.receiveShadow = !lowDetail
    parent.add(m)
    return m
  }
  const UP = new THREE.Vector3(0, 1, 0)
  const rod = (a, b, r, color, parent) => {
    const dir = new THREE.Vector3().subVectors(b, a)
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 6), mat(color))
    m.position.copy(a).addScaledVector(dir, 0.5)
    m.quaternion.setFromUnitVectors(UP, dir.normalize())
    parent.add(m)
  }

  // ---------- ocean
  const seg = lowDetail ? 48 : 90
  const waterGeo = new THREE.PlaneGeometry(160, 160, seg, seg)
  waterGeo.rotateX(-Math.PI / 2)
  const wpos = waterGeo.attributes.position
  const wbase = Float32Array.from(wpos.array)
  const water = new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({ color: C.sea, roughness: 0.6, metalness: 0.05, flatShading: true }))
  water.position.set(0, 0, 40)
  water.receiveShadow = !lowDetail
  scene.add(water)
  const animateWater = (t) => {
    const a = wpos.array
    for (let i = 0; i < wpos.count; i++) {
      const x = wbase[i * 3]
      const z = wbase[i * 3 + 2]
      a[i * 3 + 1] = 0.13 * Math.sin(x * 0.32 + t * 1.0) + 0.08 * Math.sin(z * 0.45 + t * 0.75) + 0.04 * Math.sin((x + z) * 0.9 + t * 1.6)
    }
    wpos.needsUpdate = true
  }

  // ---------- quay
  box(90, 2.4, 16, C.creamShade, 0, QUAY_Y - 1.2, -8, scene, false)
  box(90, 0.22, 0.35, C.inkTint, 0, QUAY_Y - 0.1, 0.05, scene, false)
  for (let x = -27; x <= 27; x += 3) box(0.5, 0.8, 0.25, C.ink, x, 0.55, 0.15, scene, false)
  for (const z of [-0.4, -3.4]) box(90, 0.06, 0.12, C.inkTint, 0, QUAY_Y + 0.03, z, scene, false)
  box(90, 0.02, 0.05, C.orange, 0, QUAY_Y + 0.01, -2.55, scene, false)
  for (const x of [-13, 13, -26, 26]) {
    box(0.12, 3.2, 0.12, C.ink, x, QUAY_Y + 1.6, -4.6)
    box(0.5, 0.14, 0.3, C.cream, x, QUAY_Y + 3.2, -4.6)
  }

  // ---------- containers
  const cGeo = new THREE.BoxGeometry(CL, CH, CW)
  const edgeGeo = new THREE.EdgesGeometry(cGeo)
  const edgeMat = new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: 0.35 })
  const PALETTE = [C.orange, C.orange, C.orangeShade, C.ink, C.inkTint, C.cream, C.creamShade]
  const cMats = new Map(PALETTE.map((c) => [c, new THREE.MeshStandardMaterial({ map: ribbed(c), roughness: 0.75, metalness: 0.05 })]))
  const rand = seeded(11)
  const container = (parent, x, y, z, color = PALETTE[Math.floor(rand() * PALETTE.length)]) => {
    const m = new THREE.Mesh(cGeo, cMats.get(color))
    if (!lowDetail) m.add(new THREE.LineSegments(edgeGeo, edgeMat))
    m.position.set(x, y, z)
    m.castShadow = !lowDetail
    m.receiveShadow = !lowDetail
    parent.add(m)
    return m
  }
  const tierY = (base, k) => base + CH / 2 + k * (CH + 0.01)

  // Dockside stacks.
  const yardRows = lowDetail ? [-5.6, -6.3, -7.0, -7.7] : [-5.6, -6.3, -7.0, -7.7, -9.2, -9.9, -10.6]
  const yardSpan = lowDetail ? 14 : 24
  for (const z of yardRows) {
    for (let x = -yardSpan; x <= yardSpan; x += 1.75) {
      if (rand() < 0.2) continue
      const h = 1 + Math.floor(rand() * 3)
      for (let k = 0; k < h; k++) container(scene, x, tierY(QUAY_Y, k), z)
    }
  }

  // ---------- the arriving ship
  const ship = new THREE.Group()
  ship.position.set(reducedMotion ? 0 : SHIP_START_X, 0, 2.95)
  scene.add(ship)

  const hull = new THREE.Shape()
  hull.moveTo(-7.6, -0.7)
  hull.lineTo(6.0, -0.7)
  hull.bezierCurveTo(7.6, -0.7, 8.7, 0.5, 9.1, 2.0)
  hull.lineTo(-7.9, 2.0)
  hull.lineTo(-7.9, 0.6)
  hull.closePath()
  const hullGeo = new THREE.ExtrudeGeometry(hull, { depth: 3.4, bevelEnabled: false })
  hullGeo.translate(0, 0, -1.7)
  const hp = hullGeo.attributes.position
  for (let i = 0; i < hp.count; i++) {
    const x = hp.getX(i)
    if (x > 5) hp.setZ(i, hp.getZ(i) * (1 - Math.min(1, (x - 5) / 4.3) * 0.85))
  }
  hullGeo.computeVertexNormals()
  const hullMesh = new THREE.Mesh(hullGeo, mat(C.inkTint))
  hullMesh.castShadow = !lowDetail
  ship.add(hullMesh)
  box(13.9, 0.2, 3.44, C.orange, -0.85, 0.35, 0, ship, false)
  box(13.4, 0.06, 3.3, C.creamShade, -1.2, DECK_Y - 0.03, 0, ship, false)
  box(1.7, 2.6, 3.0, C.cream, -6.7, DECK_Y + 1.3, 0, ship)
  box(1.72, 0.32, 3.02, C.ink, -6.7, DECK_Y + 2.05, 0, ship, false)
  box(0.5, 0.12, 4.2, C.cream, -6.0, DECK_Y + 2.55, 0, ship)
  box(0.8, 1.1, 0.9, C.orange, -7.4, DECK_Y + 3.15, 0, ship)
  box(0.82, 0.18, 0.92, C.ink, -7.4, DECK_Y + 3.62, 0, ship, false)
  box(0.12, 1.5, 0.12, C.cream, 8.1, DECK_Y + 0.75, 0, ship)

  BAYS.forEach((x) => ROWS.forEach((z) => { for (let k = 0; k < 2; k++) container(ship, x, tierY(DECK_Y, k), z) }))
  const moving = BAYS.map((x, i) => {
    const slot = new THREE.Vector3(x, tierY(DECK_Y, 2), ROWS[MOVING_ROWS[i]])
    return { mesh: container(ship, slot.x, slot.y, slot.z), slot, x }
  })

  // ---------- ship on the horizon
  let farShip = null
  if (!lowDetail) {
    farShip = new THREE.Group()
    box(9, 1.4, 2, C.inkTint, 0, 0.3, 0, farShip)
    box(1.2, 1.6, 1.8, C.cream, -3.8, 1.8, 0, farShip)
    for (let x = -2.6; x <= 3.4; x += 1.6) {
      for (let k = 0; k < 2; k++) container(farShip, x, 1.0 + CH / 2 + k * CH, 0)
    }
    farShip.position.set(55, 0, 26)
    farShip.rotation.y = Math.PI
    scene.add(farShip)
  }

  // ---------- gantry crane
  const crane = new THREE.Group()
  crane.position.set(BAYS[0], 0, 0)
  scene.add(crane)
  for (const sx of [-1.35, 1.35]) {
    for (const z of [-0.4, -3.4]) {
      box(0.24, 7.6, 0.24, C.orange, sx, QUAY_Y + 3.8, z, crane)
      box(0.6, 0.3, 0.5, C.ink, sx, QUAY_Y + 0.15, z, crane)
    }
    box(0.3, 0.3, 3.24, C.orange, sx, 4.2, -1.9, crane)
    box(0.3, 0.36, 3.24, C.orange, sx, 9.0, -1.9, crane)
  }
  for (const z of [-0.4, -3.4]) box(2.94, 0.36, 0.36, C.orange, 0, 9.0, z, crane)
  for (const sx of [-0.6, 0.6]) box(0.2, 0.4, 15.5, C.orange, sx, 9.4, 1.6, crane)
  for (let z = -5.5; z <= 9; z += 1.6) box(1.4, 0.1, 0.1, C.orangeShade, 0, 9.62, z, crane, false)
  for (const sx of [-0.6, 0.6]) {
    box(0.22, 3.2, 0.22, C.orange, sx, 11.2, -2.6, crane)
    rod(new THREE.Vector3(sx, 12.8, -2.6), new THREE.Vector3(sx, 9.6, 9.2), 0.05, C.orangeShade, crane)
    rod(new THREE.Vector3(sx, 12.8, -2.6), new THREE.Vector3(sx, 9.6, -6.0), 0.05, C.orangeShade, crane)
  }
  box(1.42, 0.24, 0.3, C.orange, 0, 12.8, -2.6, crane)
  box(1.5, 1.0, 1.7, C.cream, 0, 10.1, -5.0, crane)
  const trolley = new THREE.Group()
  crane.add(trolley)
  box(1.4, 0.3, 1.0, C.inkTint, 0, 0, 0, trolley)
  box(0.6, 0.5, 0.6, C.cream, 0.55, -0.42, 0, trolley)
  const spreader = box(1.7, 0.14, 0.74, C.orangeShade, 0, 0, 0, crane)
  const cables = [-0.45, 0.45].map((x) => box(0.035, 1, 0.035, C.ink, x, 0, 0, crane, false))

  // ---------- buoys
  const buoys = [[6, 9], [-9, 8], [13, 5.5], [-15, 12]].map(([x, z]) => {
    const g = new THREE.Group()
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.6, 8), mat(C.orange))
    g.add(b)
    box(0.06, 0.5, 0.06, C.ink, 0, 0.5, 0, g, false)
    g.position.set(x, 0.1, z)
    scene.add(g)
    return g
  })

  // ---------- crane routine: a queue of small eased steps
  const st = { tz: 2.95 + ROWS[1], sy: SAFE_Y, carrying: null, arrival: reducedMotion ? ARRIVAL_SECONDS : 0 }
  const tmp = new THREE.Vector3()
  const pause = (d) => ({ begin() { this.dur = d }, update() {} })
  const act = (fn) => ({ begin() { fn(); this.dur = 0 }, update() {} })
  const tween = (get, set, target, speed, minDur = 0.5) => ({
    begin() { this.from = get(); this.to = target(); this.dur = Math.max(minDur, Math.abs(this.to - this.from) / speed) },
    update(k) { set(this.from + (this.to - this.from) * ease(k)) },
  })
  const goX = (x) => tween(() => crane.position.x, (v) => { crane.position.x = v }, () => x, 3.2, 0.4)
  const goZ = (z) => tween(() => st.tz, (v) => { st.tz = v }, z, 2.4)
  const goY = (y) => tween(() => st.sy, (v) => { st.sy = v }, y, 2.2)

  function lift(i, toQuay) {
    const c = moving[i]
    const shipZ = () => ship.position.z + c.slot.z
    return [
      goX(c.x),
      goZ(() => (toQuay ? shipZ() : LANE_Z)),
      goY(() => c.mesh.getWorldPosition(tmp).y + CH / 2 + 0.07),
      pause(0.3),
      act(() => { scene.attach(c.mesh); c.mesh.rotation.set(0, 0, 0); st.carrying = c.mesh }),
      goY(() => SAFE_Y),
      goZ(() => (toQuay ? LANE_Z : shipZ())),
      goY(toQuay ? () => QUAY_Y + CH + 0.07 : () => ship.position.y + c.slot.y + CH / 2 + 0.07),
      pause(0.25),
      act(() => {
        st.carrying = null
        if (toQuay) {
          c.mesh.position.set(c.x, QUAY_Y + CH / 2, LANE_Z)
        } else {
          ship.add(c.mesh)
          c.mesh.position.copy(c.slot)
          c.mesh.rotation.set(0, 0, 0)
        }
      }),
      goY(() => SAFE_Y),
    ]
  }

  const routine = [
    ...BAYS.map((_, i) => ({ i, toQuay: true })),
    { wait: 1.5 },
    ...BAYS.map((_, i) => ({ i: BAYS.length - 1 - i, toQuay: false })),
    { wait: 1.5 },
  ]
  let routineIdx = 0
  let queue = []
  let step = null

  function advance(dt) {
    let left = dt
    let guard = 0
    while (left > 0 && guard++ < 50) {
      if (!step) {
        if (!queue.length) {
          const r = routine[routineIdx++ % routine.length]
          queue = r.wait ? [pause(r.wait)] : lift(r.i, r.toQuay)
        }
        step = queue.shift()
        step.begin()
        step.t = 0
      }
      const need = step.dur - step.t
      if (left >= need) {
        step.update(1)
        left -= need
        step = null
      } else {
        step.t += left
        step.update(step.t / step.dur)
        left = 0
      }
    }
  }

  function syncCrane() {
    trolley.position.set(0, TROLLEY_Y, st.tz)
    spreader.position.set(0, st.sy, st.tz)
    const top = TROLLEY_Y - 0.15
    const bottom = st.sy + 0.07
    for (const c of cables) {
      c.scale.y = Math.max(0.01, top - bottom)
      c.position.set(c.position.x, (top + bottom) / 2, st.tz)
    }
    if (st.carrying) st.carrying.position.set(crane.position.x, st.sy - 0.07 - CH / 2, st.tz)
  }

  // ---------- camera, pointer parallax, sizing
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
  const onMove = (e) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1
  }
  window.addEventListener('pointermove', onMove, { passive: true })

  let clock = 0
  function render(dt) {
    clock += dt
    if (st.arrival < ARRIVAL_SECONDS) {
      st.arrival = Math.min(ARRIVAL_SECONDS, st.arrival + dt)
      ship.position.x = SHIP_START_X * (1 - easeOut(st.arrival / ARRIVAL_SECONDS))
    } else if (dt > 0) {
      advance(dt)
    }
    syncCrane()
    animateWater(clock)
    ship.position.y = Math.sin(clock * 0.9) * 0.035
    ship.rotation.x = Math.sin(clock * 0.6) * 0.006
    buoys.forEach((b, i) => {
      b.position.y = 0.1 + Math.sin(clock * 1.3 + i) * 0.08
      b.rotation.z = Math.sin(clock * 1.1 + i * 2) * 0.12
    })
    if (farShip) {
      farShip.position.x -= dt * 1.4
      if (farShip.position.x < -70) farShip.position.x = 70
      farShip.position.y = Math.sin(clock * 0.8) * 0.04
    }
    pointer.x += (pointer.tx - pointer.x) * 0.04
    pointer.y += (pointer.ty - pointer.y) * 0.04
    camera.position.set(
      cam.x + Math.sin(clock * 0.05) * 1.6 + pointer.x * 1.4,
      cam.y + Math.sin(clock * 0.04) * 0.4 - pointer.y * 0.7,
      cam.z,
    )
    camera.lookAt(LOOK)
    renderer.render(scene, camera)
  }

  function resize() {
    const w = host.clientWidth
    const h = host.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    const aspect = w / h
    camera.aspect = aspect
    cam.copy(CAM_BASE).multiplyScalar(aspect >= 1.4 ? 1 : aspect >= 1 ? 1.15 : 1.45)
    // On wide screens the scene sits to the right of the headline.
    if (w >= 1024) camera.setViewOffset(w, h, -w * 0.3, 0, w, h)
    else camera.clearViewOffset()
    camera.updateProjectionMatrix()
    render(0)
  }

  function dispose() {
    window.removeEventListener('pointermove', onMove)
    scene.traverse((o) => {
      o.geometry?.dispose()
      const ms = Array.isArray(o.material) ? o.material : [o.material]
      ms.forEach((m) => { m?.map?.dispose(); m?.dispose() })
    })
    renderer.dispose()
    renderer.forceContextLoss()
    canvas.remove()
  }

  resize()
  return { render, resize, dispose }
}
