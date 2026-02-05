# sad_Jens - Document Viewer

A React + Vite project for viewing and editing Excel, PDF, and DWG/DXF files.

## Features

### Excel Viewer (Univer)
- Full spreadsheet editing
- Formula support
- Cell formatting
- Export to .xlsx

### PDF Viewer (SimplePDF)
- Inline PDF viewing
- Text and form editing
- Digital signatures
- Download edited files

### CAD Viewer (mlightcad)
- DWG/DXF file support
- Zoom and pan navigation
- Layer viewing
- WebAssembly-powered

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Project Structure

```
src/
├── components/
│   ├── Layout/
│   │   └── TabNavigation.tsx
│   ├── ExcelViewer/
│   │   └── ExcelViewer.tsx
│   ├── PdfViewer/
│   │   └── PdfViewer.tsx
│   └── CadViewer/
│       └── CadViewer.tsx
├── pages/
│   ├── ExcelPage.tsx
│   ├── PdfPage.tsx
│   └── CadPage.tsx
├── App.tsx
├── main.tsx
└── index.css
```

## Libraries Used

- **Univer** (Apache-2.0) - Excel editing
- **SimplePDF** (Free tier) - PDF viewing/editing
- **mlightcad** - DWG/DXF viewing

## License

MIT
