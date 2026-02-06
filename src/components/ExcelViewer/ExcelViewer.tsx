import { useEffect, useRef, useState, useCallback } from 'react';
import { createUniver, IWorkbookData, ICellData, IObjectMatrixPrimitiveType, LocaleType, mergeLocales } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/presets/preset-sheets-core';
import sheetsEnUS from '@univerjs/presets/preset-sheets-core/locales/en-US';
import * as XLSX from 'xlsx';

import '@univerjs/presets/lib/styles/preset-sheets-core.css';
import './ExcelViewer.css';

interface LoadingState {
  isLoading: boolean;
  progress: number;
  message: string;
}

// Convert Excel column letter to index (A=0, B=1, etc.)
function colLetterToIndex(col: string): number {
  let result = 0;
  for (let i = 0; i < col.length; i++) {
    result = result * 26 + (col.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
  }
  return result - 1;
}

// Parse cell address (e.g., "A1" -> {row: 0, col: 0})
function parseCellAddress(address: string): { row: number; col: number } {
  const match = address.match(/^([A-Z]+)(\d+)$/);
  if (!match) {
    return { row: 0, col: 0 };
  }
  const col = colLetterToIndex(match[1]);
  const row = parseInt(match[2], 10) - 1;
  return { row, col };
}

// Convert XLSX worksheet to Univer cell data format
function convertSheetToUniverCellData(worksheet: XLSX.WorkSheet): IObjectMatrixPrimitiveType<ICellData> {
  const cellData: IObjectMatrixPrimitiveType<ICellData> = {};

  if (!worksheet['!ref']) {
    return cellData;
  }

  for (const cellAddress in worksheet) {
    if (cellAddress.startsWith('!')) continue;

    const cell = worksheet[cellAddress] as XLSX.CellObject;
    const { row, col } = parseCellAddress(cellAddress);

    if (!cellData[row]) {
      cellData[row] = {};
    }

    const univerCell: ICellData = {};

    if (cell.t === 'n') {
      univerCell.v = cell.v as number;
    } else if (cell.t === 'b') {
      univerCell.v = cell.v ? 1 : 0;
    } else if (cell.t === 's') {
      univerCell.v = cell.v as string;
    } else if (cell.t === 'd') {
      univerCell.v = cell.w || String(cell.v);
    } else if (cell.v !== undefined) {
      univerCell.v = String(cell.v);
    }

    if (cell.f) {
      univerCell.f = cell.f;
    }

    cellData[row][col] = univerCell;
  }

  return cellData;
}

// Convert XLSX workbook to Univer IWorkbookData format
function convertXLSXToUniver(workbook: XLSX.WorkBook): IWorkbookData {
  const sheetOrder: string[] = [];
  const sheets: IWorkbookData['sheets'] = {};

  workbook.SheetNames.forEach((sheetName, index) => {
    const sheetId = `sheet-${index}`;
    sheetOrder.push(sheetId);

    const worksheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

    const rowCount = Math.max(range.e.r + 1, 100);
    const columnCount = Math.max(range.e.c + 1, 26);

    sheets[sheetId] = {
      id: sheetId,
      name: sheetName,
      rowCount,
      columnCount,
      cellData: convertSheetToUniverCellData(worksheet),
    };
  });

  return {
    id: 'workbook-imported',
    name: workbook.Props?.Title || 'Imported Workbook',
    sheetOrder,
    sheets,
  };
}

let containerIdCounter = 0;

export function ExcelViewer() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const univerInstanceRef = useRef<{ univerAPI: ReturnType<typeof createUniver>['univerAPI'] } | null>(null);
  const univerContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false,
    progress: 0,
    message: '',
  });
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Initialize Univer with presets API
  const initializeUniver = useCallback((workbookData?: IWorkbookData) => {
    if (!wrapperRef.current) return;

    // Dispose previous instance
    if (univerInstanceRef.current) {
      try {
        univerInstanceRef.current.univerAPI.dispose();
      } catch {
        // Ignore dispose errors
      }
      univerInstanceRef.current = null;
    }

    // Remove old Univer container
    if (univerContainerRef.current && univerContainerRef.current.parentNode) {
      univerContainerRef.current.parentNode.removeChild(univerContainerRef.current);
      univerContainerRef.current = null;
    }

    // Create a fresh DOM element with unique ID
    const containerId = `univer-container-${++containerIdCounter}`;
    const univerDiv = document.createElement('div');
    univerDiv.id = containerId;
    univerDiv.style.width = '100%';
    univerDiv.style.height = '100%';
    wrapperRef.current.appendChild(univerDiv);
    univerContainerRef.current = univerDiv;

    try {
      const { univerAPI } = createUniver({
        locale: LocaleType.EN_US,
        locales: {
          [LocaleType.EN_US]: mergeLocales(sheetsEnUS),
        },
        presets: [
          UniverSheetsCorePreset({
            container: containerId,
          }),
        ],
      });

      // Create workbook using the API (as per documentation)
      const defaultWorkbook: IWorkbookData = workbookData || {
        id: 'workbook-1',
        name: 'New Workbook',
        sheetOrder: ['sheet-1'],
        sheets: {
          'sheet-1': {
            id: 'sheet-1',
            name: 'Sheet 1',
            rowCount: 100,
            columnCount: 26,
          },
        },
      };

      univerAPI.createWorkbook(defaultWorkbook);
      univerInstanceRef.current = { univerAPI };
    } catch (err) {
      console.error('Failed to initialize Univer:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize spreadsheet engine');
    }
  }, []);

  // Load XLSX file
  const loadXLSXFile = useCallback(async (file: File) => {
    setError('');
    setLoadingState({ isLoading: true, progress: 10, message: 'Reading file...' });

    try {
      const arrayBuffer = await file.arrayBuffer();
      setLoadingState({ isLoading: true, progress: 30, message: 'Parsing XLSX...' });

      const workbook = XLSX.read(arrayBuffer, {
        type: 'array',
        cellFormula: true,
        cellStyles: false,
        cellDates: true,
      });

      setLoadingState({ isLoading: true, progress: 60, message: 'Converting to Univer format...' });

      const univerData = convertXLSXToUniver(workbook);

      setLoadingState({ isLoading: true, progress: 80, message: 'Rendering spreadsheet...' });

      initializeUniver(univerData);

      setFileName(file.name);
      setLoadingState({ isLoading: true, progress: 100, message: 'Complete!' });

      setTimeout(() => {
        setLoadingState({ isLoading: false, progress: 0, message: '' });
      }, 500);

    } catch (err) {
      console.error('Error loading XLSX file:', err);
      setError(err instanceof Error ? err.message : 'Failed to load file');
      setLoadingState({ isLoading: false, progress: 0, message: '' });
    }
  }, [initializeUniver]);

  // Handle file input change
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      loadXLSXFile(file);
    }
  }, [loadXLSXFile]);

  // Handle drag and drop
  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const file = event.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      loadXLSXFile(file);
    } else {
      setError('Please drop a valid Excel file (.xlsx or .xls)');
    }
  }, [loadXLSXFile]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  // Load from URL
  const loadFromUrl = useCallback(async (url: string) => {
    setError('');
    setLoadingState({ isLoading: true, progress: 5, message: 'Fetching file...' });

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const name = url.split('/').pop() || 'downloaded.xlsx';
      const file = new File([blob], name, { type: blob.type });

      await loadXLSXFile(file);
    } catch (err) {
      console.error('Error loading from URL:', err);
      setError(err instanceof Error ? err.message : 'Failed to load file from URL');
      setLoadingState({ isLoading: false, progress: 0, message: '' });
    }
  }, [loadXLSXFile]);

  // Load test file
  const loadTestFile = useCallback(() => {
    loadFromUrl('/test-files/test.xlsx');
  }, [loadFromUrl]);

  // Initialize empty Univer on mount
  useEffect(() => {
    initializeUniver();

    return () => {
      if (univerInstanceRef.current) {
        try {
          univerInstanceRef.current.univerAPI.dispose();
        } catch {
          // Ignore
        }
        univerInstanceRef.current = null;
      }
    };
  }, [initializeUniver]);

  return (
    <div
      className="excel-viewer"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <div className="excel-toolbar">
        <div className="toolbar-header">
          <h2>Excel Viewer</h2>
          {fileName && <span className="file-name" data-testid="loaded-file-name">{fileName}</span>}
        </div>
        <p>Powered by Univer - Edit cells, use formulas, and format your spreadsheet</p>

        <div className="toolbar-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="file-input"
            id="xlsx-file-input"
            data-testid="xlsx-file-input"
          />
          <label htmlFor="xlsx-file-input" className="upload-button">
            Upload XLSX File
          </label>

          <button
            className="load-test-button"
            onClick={loadTestFile}
            disabled={loadingState.isLoading}
            data-testid="load-test-file-button"
          >
            Load Test File (test.xlsx)
          </button>
        </div>

        {loadingState.isLoading && (
          <div className="loading-indicator" data-testid="loading-indicator">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${loadingState.progress}%` }}
              />
            </div>
            <span className="loading-message">{loadingState.message}</span>
          </div>
        )}

        {error && (
          <div className="error-message" data-testid="error-message">
            {error}
          </div>
        )}
      </div>
      <div ref={wrapperRef} className="excel-container" data-testid="excel-container" />
    </div>
  );
}
