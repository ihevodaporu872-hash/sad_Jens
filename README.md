# Universal Document Viewer

A modern React application for viewing and editing various document formats including Excel spreadsheets, PDF documents, CAD drawings (DWG/DXF), and BIM/IFC files.

Built with React 19, Vite 7, TypeScript, and enterprise-grade document processing libraries.

## Features

### Excel Viewer (Univer)
- Full spreadsheet editing with formula support
- Cell formatting and styling
- Multiple sheets support
- Real-time calculations
- Export to .xlsx format

### PDF Viewer (SimplePDF)
- Inline PDF viewing and editing
- Drag & drop file upload
- Text and form field editing
- Digital signature support
- Download edited files
- Multi-language support (EN, DE, ES, FR, IT, PT, NL)

### CAD Viewer (mlightcad)
- DWG and DXF file support
- Drag & drop file upload
- Zoom, pan, and fit controls
- Layer viewing
- WebAssembly-powered rendering
- High-performance for large files

### IFC/BIM Viewer (web-ifc + Three.js)
- IFC2x3, IFC4, IFC4x3 support
- Drag & drop file upload
- Full 3D navigation (rotate, zoom, pan)
- Geometry streaming for large models
- File validation and error handling
- Progress indicator during loading

## Quick Start

```bash
# Clone the repository
git clone https://github.com/ihevodaporu872-hash/sad_Jens.git
cd sad_Jens

# Install dependencies
npm install

# Start development server
npm run dev

# Open in browser
# http://localhost:5173
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run test:coverage` | Run tests with coverage |
| `npm run typecheck` | TypeScript type checking |
| `npm run lint` | ESLint code linting |

## Project Structure

```
├── packages/                    # Local packages (source code)
│   ├── univer/                 # Univer spreadsheet engine
│   │   ├── core/
│   │   ├── sheets/
│   │   ├── sheets-ui/
│   │   ├── ui/
│   │   ├── engine-formula/
│   │   ├── engine-render/
│   │   └── ...
│   ├── simplepdf/              # SimplePDF React embed
│   │   └── src/
│   │       ├── index.tsx
│   │       ├── hook.tsx
│   │       └── utils.ts
│   ├── cad-viewer/             # mlightcad CAD viewer
│   │   ├── core/
│   │   ├── svg-renderer/
│   │   └── three-renderer/
│   └── web-ifc/                # IFC parser (WebAssembly)
│       ├── web-ifc-api.js
│       ├── web-ifc.wasm
│       └── helpers/
│
├── src/
│   ├── components/
│   │   ├── ExcelViewer/
│   │   │   ├── ExcelViewer.tsx
│   │   │   ├── ExcelViewer.css
│   │   │   └── ExcelViewer.test.tsx
│   │   ├── PdfViewer/
│   │   │   ├── PdfViewer.tsx
│   │   │   ├── PdfViewer.css
│   │   │   └── PdfViewer.test.tsx
│   │   ├── CadViewer/
│   │   │   ├── CadViewer.tsx
│   │   │   ├── CadViewer.css
│   │   │   ├── CadViewer.test.tsx
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── IfcViewer/
│   │   │   ├── IfcViewer.tsx
│   │   │   ├── IfcViewer.css
│   │   │   ├── IfcViewer.test.tsx
│   │   │   └── index.ts
│   │   └── Layout/
│   │       ├── TabNavigation.tsx
│   │       ├── TabNavigation.css
│   │       └── TabNavigation.test.tsx
│   ├── pages/
│   │   ├── ExcelPage.tsx
│   │   ├── PdfPage.tsx
│   │   ├── CadPage.tsx
│   │   └── IfcPage.tsx
│   ├── test/
│   │   └── setup.ts
│   ├── App.tsx
│   ├── App.css
│   ├── main.tsx
│   └── index.css
│
├── public/
│   └── wasm/                   # WebAssembly files for IFC
│
├── vite.config.ts              # Vite configuration with aliases
├── tsconfig.app.json           # TypeScript configuration
├── vitest.config.ts            # Vitest test configuration
└── package.json
```

## Component Usage

### PDF Viewer

```tsx
import { PdfViewer } from './components/PdfViewer/PdfViewer';

function App() {
  return (
    <PdfViewer
      documentURL="/sample.pdf"
      locale="en"
      onDocumentLoaded={(name) => console.log('Loaded:', name)}
      onError={(error) => console.error('Error:', error)}
    />
  );
}
```

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `documentURL` | `string` | URL to PDF file (optional) |
| `locale` | `'en' \| 'de' \| 'es' \| 'fr' \| 'it' \| 'pt' \| 'nl'` | UI language |
| `onDocumentLoaded` | `(name: string) => void` | Callback when document loads |
| `onError` | `(error: string) => void` | Callback on error |
| `onEmbedEvent` | `(event: EmbedEvent) => void` | PDF editor events |

### CAD Viewer

```tsx
import { CadViewer } from './components/CadViewer/CadViewer';

function App() {
  return (
    <CadViewer
      initialUrl="/drawing.dwg"
      onDocumentLoaded={(title) => console.log('Loaded:', title)}
      onError={(error) => console.error('Error:', error)}
    />
  );
}
```

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `initialUrl` | `string` | URL to DWG/DXF file (optional) |
| `onDocumentLoaded` | `(title: string) => void` | Callback when document loads |
| `onError` | `(error: string) => void` | Callback on error |
| `viewerOptions` | `AcApDocManagerOptions` | Custom viewer options |
| `className` | `string` | Additional CSS class |

### IFC Viewer

```tsx
import { IfcViewer } from './components/IfcViewer/IfcViewer';

function App() {
  return (
    <IfcViewer
      onModelLoaded={(info) => console.log('Model:', info)}
      onError={(error) => console.error('Error:', error)}
    />
  );
}
```

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `onModelLoaded` | `(info: string) => void` | Callback when model loads |
| `onError` | `(error: string) => void` | Callback on error |
| `className` | `string` | Additional CSS class |

## Supported File Formats

| Viewer | Extensions | Description |
|--------|------------|-------------|
| Excel | `.xlsx`, `.xls` | Microsoft Excel spreadsheets |
| PDF | `.pdf` | PDF documents |
| CAD | `.dwg`, `.dxf` | AutoCAD drawings |
| IFC | `.ifc` | Industry Foundation Classes (BIM) |

## Features Across All Viewers

- **Drag & Drop** - Drop files directly onto the viewer
- **File Upload Button** - Traditional file picker
- **Loading Indicators** - Spinner with progress messages
- **Error Handling** - User-friendly error messages
- **Responsive Design** - Works on desktop and mobile
- **Dark/Light Theme** - Respects system preferences
- **Keyboard Navigation** - Accessible controls

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.0 | UI Framework |
| Vite | 7.2.4 | Build Tool |
| TypeScript | 5.9.3 | Type Safety |
| Three.js | 0.182.0 | 3D Rendering (IFC) |
| Vitest | 4.0.18 | Testing |
| React Router | 7.13.0 | Routing |

## Libraries & Licenses

| Library | License | Purpose |
|---------|---------|---------|
| [Univer](https://github.com/dream-num/univer) | Apache-2.0 | Excel editing |
| [SimplePDF](https://simplepdf.com) | Commercial (Free tier) | PDF viewing/editing |
| [mlightcad](https://mlightcad.com) | Commercial | DWG/DXF viewing |
| [web-ifc](https://github.com/IFCjs/web-ifc) | MPL-2.0 | IFC parsing |
| [Three.js](https://threejs.org) | MIT | 3D rendering |

## Testing

```bash
# Run all tests
npm run test

# Run tests once (CI mode)
npm run test:run

# Run with coverage report
npm run test:coverage
```

Test files are located alongside components with `.test.tsx` extension.

## Building for Production

```bash
# Build
npm run build

# Preview the build
npm run preview
```

The build output will be in the `dist/` directory.

## Browser Support

- Chrome 90+
- Firefox 90+
- Safari 14+
- Edge 90+

**Requirements:**
- WebAssembly support (for CAD and IFC viewers)
- WebGL support (for IFC 3D viewer)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Univer](https://univer.ai) - For the powerful spreadsheet engine
- [SimplePDF](https://simplepdf.com) - For PDF editing capabilities
- [mlightcad](https://mlightcad.com) - For CAD file support
- [IFC.js](https://ifcjs.io) - For BIM/IFC parsing
- [Three.js](https://threejs.org) - For 3D rendering

---

Made with React + Vite + TypeScript
