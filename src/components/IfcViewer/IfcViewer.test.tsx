import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen} from '@testing-library/react'
import { IfcViewer } from './IfcViewer'

// Create mock classes for Three.js
class MockVector3 {
  set = vi.fn().mockReturnThis()
  copy = vi.fn().mockReturnThis()
}

class MockBox3 {
  setFromObject = vi.fn().mockReturnThis()
  getCenter = vi.fn(() => new MockVector3())
  getSize = vi.fn(() => new MockVector3())
}

class MockMatrix4 {
  fromArray = vi.fn()
}

class MockBufferGeometry {
  setAttribute = vi.fn()
  setIndex = vi.fn()
  applyMatrix4 = vi.fn()
  dispose = vi.fn()
}

class MockMesh {
  castShadow = false
  receiveShadow = false
  geometry = { dispose: vi.fn() }
  material = { dispose: vi.fn() }
}

class MockGroup {
  children: unknown[] = []
  add = vi.fn()
  remove = vi.fn()
}

class MockScene {
  background = null
  add = vi.fn()
}

class MockPerspectiveCamera {
  position = { set: vi.fn() }
  aspect = 1
  updateProjectionMatrix = vi.fn()
}

class MockWebGLRenderer {
  setSize = vi.fn()
  setPixelRatio = vi.fn()
  render = vi.fn()
  dispose = vi.fn()
  domElement = document.createElement('canvas')
  shadowMap = { enabled: false, type: 0 }
}

class MockDirectionalLight {
  position = { set: vi.fn() }
  castShadow = false
  shadow = { mapSize: { width: 0, height: 0 } }
}

// Mock Three.js
vi.mock('three', () => ({
  Vector3: MockVector3,
  Box3: MockBox3,
  Matrix4: MockMatrix4,
  BufferAttribute: vi.fn(),
  BufferGeometry: MockBufferGeometry,
  MeshPhongMaterial: vi.fn(() => ({ dispose: vi.fn() })),
  Mesh: MockMesh,
  Group: MockGroup,
  Scene: MockScene,
  PerspectiveCamera: MockPerspectiveCamera,
  WebGLRenderer: MockWebGLRenderer,
  Color: vi.fn(),
  AmbientLight: vi.fn(),
  DirectionalLight: MockDirectionalLight,
  GridHelper: vi.fn(),
  AxesHelper: vi.fn(),
  DoubleSide: 2,
  PCFSoftShadowMap: 2,
}))

// Mock OrbitControls
vi.mock('three/addons/controls/OrbitControls.js', () => ({
  OrbitControls: vi.fn(function() {
    return {
      enableDamping: true,
      dampingFactor: 0.05,
      screenSpacePanning: true,
      minDistance: 1,
      maxDistance: 5000,
      target: { copy: vi.fn(), set: vi.fn() },
      update: vi.fn(),
    }
  }),
}))

// Mock web-ifc
vi.mock('web-ifc', () => ({
  IfcAPI: vi.fn(function() {
    return {
      SetWasmPath: vi.fn(),
      Init: vi.fn().mockResolvedValue(undefined),
      OpenModel: vi.fn().mockReturnValue(1),
      GetModelSchema: vi.fn().mockReturnValue('IFC4'),
      StreamAllMeshes: vi.fn(),
      GetGeometry: vi.fn(() => ({
        GetVertexData: vi.fn(),
        GetVertexDataSize: vi.fn(() => 0),
        GetIndexData: vi.fn(),
        GetIndexDataSize: vi.fn(() => 0),
        delete: vi.fn(),
      })),
      GetVertexArray: vi.fn(() => new Float32Array(0)),
      GetIndexArray: vi.fn(() => new Uint32Array(0)),
      CloseModel: vi.fn(),
      Dispose: vi.fn(),
    }
  }),
}))

describe('IfcViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders IFC viewer title', () => {
    render(<IfcViewer />)
    expect(screen.getByText('IFC Viewer')).toBeInTheDocument()
  })

  it('shows description text', () => {
    render(<IfcViewer />)
    expect(screen.getByText(/View BIM\/IFC files/)).toBeInTheDocument()
  })

  it('renders upload button', () => {
    render(<IfcViewer />)
    expect(screen.getByText('Upload IFC')).toBeInTheDocument()
  })

  it('renders reset view button', () => {
    render(<IfcViewer />)
    expect(screen.getByText('Reset View')).toBeInTheDocument()
  })

  it('has correct file input accept attribute', () => {
    render(<IfcViewer />)
    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toHaveAttribute('accept', '.ifc')
  })

  it('shows controls hint', () => {
    render(<IfcViewer />)
    expect(screen.getByText(/Left click \+ drag: Rotate/)).toBeInTheDocument()
    expect(screen.getByText(/Right click \+ drag: Pan/)).toBeInTheDocument()
    expect(screen.getByText(/Scroll: Zoom/)).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<IfcViewer className="custom-class" />)
    expect(container.querySelector('.ifc-viewer')).toHaveClass('custom-class')
  })

  it('has ifc-viewer container class', () => {
    const { container } = render(<IfcViewer />)
    expect(container.querySelector('.ifc-viewer')).toBeInTheDocument()
  })

  it('has ifc-toolbar class', () => {
    const { container } = render(<IfcViewer />)
    expect(container.querySelector('.ifc-toolbar')).toBeInTheDocument()
  })

  it('has ifc-container class', () => {
    const { container } = render(<IfcViewer />)
    expect(container.querySelector('.ifc-container')).toBeInTheDocument()
  })

  it('has drop zone element', () => {
    const { container } = render(<IfcViewer />)
    expect(container.querySelector('.ifc-drop-zone')).toBeInTheDocument()
  })

  it('renders h2 heading', () => {
    render(<IfcViewer />)
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading).toHaveTextContent('IFC Viewer')
  })
})
