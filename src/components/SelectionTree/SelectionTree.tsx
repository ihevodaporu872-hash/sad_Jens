import { useState, useMemo, useCallback } from 'react';
import type { DbSpatialNode } from '../../lib/supabase';
import type { ElementIndexEntry } from '../../types/ifc';
import './SelectionTree.css';

export interface SelectionTreeProps {
  spatialTree: DbSpatialNode[];
  elementIndex: ElementIndexEntry[];
  onSelectElements: (expressIds: number[]) => void;
  className?: string;
}

// Internal tree node used for rendering
interface TreeNode {
  key: string;
  label: string;
  ifcType: string;
  expressId: number | null;
  elementCount: number;
  expressIds: number[];
  children: TreeNode[];
}

/**
 * SelectionTree -- hierarchical IFC spatial tree:
 * IfcProject > IfcSite > IfcBuilding > IfcBuildingStorey > elements grouped by type
 */
export function SelectionTree({
  spatialTree,
  elementIndex,
  onSelectElements,
  className,
}: SelectionTreeProps) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Build a mapping from floor name to elements grouped by ifcType
  const floorElementGroups = useMemo(() => {
    const map = new Map<string, Map<string, number[]>>();
    for (const entry of elementIndex) {
      const floor = entry.floor || '';
      if (!map.has(floor)) {
        map.set(floor, new Map());
      }
      const typeMap = map.get(floor)!;
      if (!typeMap.has(entry.ifcType)) {
        typeMap.set(entry.ifcType, []);
      }
      typeMap.get(entry.ifcType)!.push(entry.expressId);
    }
    return map;
  }, [elementIndex]);

  // Build the tree from flat spatial nodes
  const treeRoots = useMemo(() => {
    if (spatialTree.length === 0) return [];

    // Map express_id -> DbSpatialNode
    const nodeMap = new Map<number, DbSpatialNode>();
    for (const node of spatialTree) {
      nodeMap.set(node.express_id, node);
    }

    // Find which floor names correspond to which spatial storey nodes
    // Match by name or long_name
    const storeyNames = new Map<number, string>();
    for (const node of spatialTree) {
      if (node.ifc_type === 'IfcBuildingStorey') {
        // The floor name in elementIndex might match name or long_name
        storeyNames.set(node.express_id, node.name || node.long_name || '');
      }
    }

    // Build children map
    const childrenMap = new Map<number | null, DbSpatialNode[]>();
    for (const node of spatialTree) {
      const parentId = node.parent_express_id;
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }
      childrenMap.get(parentId)!.push(node);
    }

    // Collect all expressIds under a spatial node (recursively through element groups)
    function getExpressIdsForStorey(node: DbSpatialNode): number[] {
      const name = node.name || node.long_name || '';
      const typeMap = floorElementGroups.get(name);
      if (!typeMap) return [];
      const ids: number[] = [];
      for (const expressIds of typeMap.values()) {
        ids.push(...expressIds);
      }
      return ids;
    }

    function collectAllExpressIds(node: DbSpatialNode): number[] {
      const ids: number[] = [];
      if (node.ifc_type === 'IfcBuildingStorey') {
        ids.push(...getExpressIdsForStorey(node));
      }
      const children = childrenMap.get(node.express_id) || [];
      for (const child of children) {
        ids.push(...collectAllExpressIds(child));
      }
      return ids;
    }

    function buildTreeNode(node: DbSpatialNode): TreeNode {
      const key = `spatial-${node.express_id}`;
      const children: TreeNode[] = [];

      // Add spatial children first
      const spatialChildren = childrenMap.get(node.express_id) || [];
      for (const child of spatialChildren) {
        children.push(buildTreeNode(child));
      }

      // If this is a storey, add element type groups as children
      if (node.ifc_type === 'IfcBuildingStorey') {
        const name = node.name || node.long_name || '';
        const typeMap = floorElementGroups.get(name);
        if (typeMap) {
          const sortedTypes = Array.from(typeMap.entries()).sort((a, b) =>
            a[0].localeCompare(b[0])
          );
          for (const [ifcType, expressIds] of sortedTypes) {
            children.push({
              key: `${key}-type-${ifcType}`,
              label: ifcType,
              ifcType,
              expressId: null,
              elementCount: expressIds.length,
              expressIds,
              children: [],
            });
          }
        }
      }

      const allIds = collectAllExpressIds(node);

      const label = node.name || node.long_name || node.ifc_type;

      return {
        key,
        label,
        ifcType: node.ifc_type,
        expressId: node.express_id,
        elementCount: allIds.length,
        expressIds: allIds,
        children,
      };
    }

    // Roots are nodes with no parent
    const roots = childrenMap.get(null) || [];
    return roots.map(buildTreeNode);
  }, [spatialTree, floorElementGroups]);

  // Toggle expand/collapse
  const toggleExpand = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Select a node
  const handleNodeClick = useCallback(
    (node: TreeNode) => {
      setSelectedKey(node.key);
      if (node.expressIds.length > 0) {
        onSelectElements(node.expressIds);
      }
    },
    [onSelectElements]
  );

  // Render a single tree node recursively
  const renderNode = (node: TreeNode, depth: number) => {
    const isExpanded = expandedKeys.has(node.key);
    const isSelected = selectedKey === node.key;
    const hasChildren = node.children.length > 0;

    return (
      <div key={node.key} className="st-node-wrapper">
        <div
          className={`st-node ${isSelected ? 'st-node-selected' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {/* Expand/collapse arrow */}
          <button
            className={`st-arrow ${hasChildren ? '' : 'st-arrow-hidden'} ${isExpanded ? 'st-arrow-expanded' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) toggleExpand(node.key);
            }}
            tabIndex={-1}
          >
            {hasChildren ? '\u25B6' : ''}
          </button>

          {/* Folder icon */}
          <span className="st-icon">
            {hasChildren
              ? isExpanded
                ? '\uD83D\uDCC2'
                : '\uD83D\uDCC1'
              : '\uD83D\uDCC4'}
          </span>

          {/* Node label */}
          <span
            className="st-label"
            onClick={() => handleNodeClick(node)}
            title={`${node.label} (${node.ifcType})`}
          >
            {node.label}
          </span>

          {/* Element count badge */}
          {node.elementCount > 0 && (
            <span className="st-badge">{node.elementCount}</span>
          )}
        </div>

        {/* Children */}
        {isExpanded && hasChildren && (
          <div className="st-children">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (spatialTree.length === 0) {
    return (
      <div className={`selection-tree ${className || ''}`}>
        <div className="st-empty">No spatial tree data available</div>
      </div>
    );
  }

  return (
    <div className={`selection-tree ${className || ''}`}>
      <div className="st-header">Spatial Structure</div>
      <div className="st-tree-container">
        {treeRoots.map((root) => renderNode(root, 0))}
      </div>
    </div>
  );
}
