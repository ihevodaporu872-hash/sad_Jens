import { useEffect, useRef } from 'react';
import { Univer, LocaleType, UniverInstanceType } from '@univerjs/core';
import { defaultTheme } from '@univerjs/design';
import { UniverSheetsPlugin } from '@univerjs/sheets';
import { UniverSheetsUIPlugin } from '@univerjs/sheets-ui';
import { UniverUIPlugin } from '@univerjs/ui';
import { UniverFormulaEnginePlugin } from '@univerjs/engine-formula';
import { UniverRenderEnginePlugin } from '@univerjs/engine-render';

import '@univerjs/design/global.css';
import '@univerjs/ui/global.css';
import '@univerjs/sheets-ui/global.css';

import './ExcelViewer.css';

export function ExcelViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const univerRef = useRef<Univer | null>(null);

  useEffect(() => {
    if (!containerRef.current || univerRef.current) return;

    const univer = new Univer({
      theme: defaultTheme,
      locale: LocaleType.EN_US,
    });

    univerRef.current = univer;

    univer.registerPlugin(UniverRenderEnginePlugin);
    univer.registerPlugin(UniverFormulaEnginePlugin);
    univer.registerPlugin(UniverUIPlugin, {
      container: containerRef.current,
    });
    univer.registerPlugin(UniverSheetsPlugin);
    univer.registerPlugin(UniverSheetsUIPlugin);

    univer.createUnit(UniverInstanceType.UNIVER_SHEET, {
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
    });

    return () => {
      univer.dispose();
      univerRef.current = null;
    };
  }, []);

  return (
    <div className="excel-viewer">
      <div className="excel-toolbar">
        <h2>Excel Viewer</h2>
        <p>Powered by Univer - Edit cells, use formulas, and format your spreadsheet</p>
      </div>
      <div ref={containerRef} className="excel-container" />
    </div>
  );
}
