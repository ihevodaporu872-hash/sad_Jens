import { useState, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import type { ElementIndexEntry, QuantificationRow } from '../../types/ifc';
import './Quantification.css';

export interface QuantificationProps {
  elementIndex: ElementIndexEntry[];
  onSelectElements: (expressIds: number[]) => void;
  className?: string;
}

type GroupByField = 'ifcType' | 'floor' | 'material';
type SortField = 'groupKey' | 'count' | 'totalVolume' | 'totalArea';
type SortDir = 'asc' | 'desc';

export function Quantification({
  elementIndex,
  onSelectElements,
  className,
}: QuantificationProps) {
  const [groupBy, setGroupBy] = useState<GroupByField>('ifcType');
  const [sortField, setSortField] = useState<SortField>('count');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);

  const rows: QuantificationRow[] = useMemo(() => {
    const map = new Map<string, { count: number; volume: number; area: number; ids: number[] }>();

    for (const entry of elementIndex) {
      let key = '';
      switch (groupBy) {
        case 'ifcType':
          key = entry.ifcType || 'Unknown';
          break;
        case 'floor':
          key = entry.floor || 'No Floor';
          break;
        case 'material':
          key = entry.material || 'No Material';
          break;
      }

      if (!map.has(key)) {
        map.set(key, { count: 0, volume: 0, area: 0, ids: [] });
      }
      const group = map.get(key)!;
      group.count++;
      group.volume += entry.volume;
      group.area += entry.area;
      group.ids.push(entry.expressId);
    }

    const result: QuantificationRow[] = [];
    for (const [key, data] of map) {
      result.push({
        groupKey: key,
        count: data.count,
        totalVolume: data.volume,
        totalArea: data.area,
        expressIds: data.ids,
      });
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'groupKey':
          cmp = a.groupKey.localeCompare(b.groupKey);
          break;
        case 'count':
          cmp = a.count - b.count;
          break;
        case 'totalVolume':
          cmp = a.totalVolume - b.totalVolume;
          break;
        case 'totalArea':
          cmp = a.totalArea - b.totalArea;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [elementIndex, groupBy, sortField, sortDir]);

  // Totals
  const totals = useMemo(() => {
    let count = 0;
    let volume = 0;
    let area = 0;
    for (const r of rows) {
      count += r.count;
      volume += r.totalVolume;
      area += r.totalArea;
    }
    return { count, volume, area };
  }, [rows]);

  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('desc');
      return field;
    });
  }, []);

  const handleRowClick = useCallback(
    (row: QuantificationRow) => {
      if (selectedRowKey === row.groupKey) {
        setSelectedRowKey(null);
        onSelectElements([]);
      } else {
        setSelectedRowKey(row.groupKey);
        onSelectElements(row.expressIds);
      }
    },
    [selectedRowKey, onSelectElements]
  );

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  const fmtNum = (n: number) => (n === 0 ? '—' : n.toFixed(2));

  const handleExportXlsx = useCallback(() => {
    const wb = XLSX.utils.book_new();

    // Sheet 1 — Summary (grouped table)
    const summaryData = rows.map((row) => ({
      groupKey: row.groupKey,
      count: row.count,
      totalVolume: Number(row.totalVolume.toFixed(4)),
      totalArea: Number(row.totalArea.toFixed(4)),
    }));
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // Sheet 2 — Details (individual elements)
    const detailsData = elementIndex.map((el) => ({
      expressId: el.expressId,
      ifcType: el.ifcType,
      name: el.name,
      floor: el.floor,
      material: el.material,
      volume: Number(el.volume.toFixed(4)),
      area: Number(el.area.toFixed(4)),
      height: Number(el.height.toFixed(4)),
      length: Number(el.length.toFixed(4)),
    }));
    const wsDetails = XLSX.utils.json_to_sheet(detailsData);
    XLSX.utils.book_append_sheet(wb, wsDetails, 'Details');

    // Build filename: quantification-{groupBy}-{YYYY-MM-DD}.xlsx
    const date = new Date().toISOString().slice(0, 10);
    const fileName = `quantification-${groupBy}-${date}.xlsx`;

    XLSX.writeFile(wb, fileName);
  }, [rows, elementIndex, groupBy]);

  return (
    <div className={`quantification ${className || ''}`}>
      <div className="quant-header">
        <h3>Quantification</h3>
        <button
          className="quant-export-btn"
          onClick={handleExportXlsx}
          disabled={rows.length === 0}
          title="Export to XLSX"
        >
          Export XLSX
        </button>
      </div>

      <div className="quant-controls">
        <div className="quant-group-toggle">
          {(['ifcType', 'floor', 'material'] as GroupByField[]).map((field) => (
            <button
              key={field}
              className={`quant-toggle-btn ${groupBy === field ? 'active' : ''}`}
              onClick={() => {
                setGroupBy(field);
                setSelectedRowKey(null);
              }}
            >
              {field === 'ifcType' ? 'Type' : field === 'floor' ? 'Floor' : 'Material'}
            </button>
          ))}
        </div>
      </div>

      <div className="quant-table-wrapper">
        <table className="quant-table">
          <thead>
            <tr>
              <th className="quant-th-name" onClick={() => handleSort('groupKey')}>
                {groupBy === 'ifcType' ? 'Type' : groupBy === 'floor' ? 'Floor' : 'Material'}
                {sortIndicator('groupKey')}
              </th>
              <th className="quant-th-num" onClick={() => handleSort('count')}>
                Count{sortIndicator('count')}
              </th>
              <th className="quant-th-num" onClick={() => handleSort('totalVolume')}>
                Volume (m³){sortIndicator('totalVolume')}
              </th>
              <th className="quant-th-num" onClick={() => handleSort('totalArea')}>
                Area (m²){sortIndicator('totalArea')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.groupKey}
                className={`quant-row ${selectedRowKey === row.groupKey ? 'selected' : ''}`}
                onClick={() => handleRowClick(row)}
              >
                <td className="quant-td-name" title={row.groupKey}>{row.groupKey}</td>
                <td className="quant-td-num">{row.count}</td>
                <td className="quant-td-num">{fmtNum(row.totalVolume)}</td>
                <td className="quant-td-num">{fmtNum(row.totalArea)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="quant-empty">
                  No elements indexed yet.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="quant-totals">
                <td className="quant-td-name">Total</td>
                <td className="quant-td-num">{totals.count}</td>
                <td className="quant-td-num">{fmtNum(totals.volume)}</td>
                <td className="quant-td-num">{fmtNum(totals.area)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
