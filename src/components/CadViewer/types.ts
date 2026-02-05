/**
 * Type definitions for CAD Viewer component
 * Re-exports types from @mlightcad/cad-simple-viewer for convenience
 */

export type {
  AcApDocManager,
  AcApDocManagerOptions,
  AcDbDocumentEventArgs,
  AcApWebworkerFiles,
  AcApOpenDatabaseOptions,
  AcApDocument,
  AcEdOpenMode
} from '@mlightcad/cad-simple-viewer';

/** Props for the CadViewer component */
export interface CadViewerProps {
  /** Initial URL to load a CAD file from */
  initialUrl?: string;
  /** Callback when a document is loaded */
  onDocumentLoaded?: (title: string) => void;
  /** Callback when an error occurs */
  onError?: (error: string) => void;
  /** Custom options for the CAD viewer (excluding container which is managed internally) */
  viewerOptions?: Partial<Omit<import('@mlightcad/cad-simple-viewer').AcApDocManagerOptions, 'container'>>;
}

/** State of the CAD viewer */
export interface CadViewerState {
  /** Whether the viewer is currently loading */
  isLoading: boolean;
  /** Current error message, if any */
  error: string | null;
  /** Whether the viewer is ready to use */
  viewerReady: boolean;
  /** Title of the currently loaded document */
  documentTitle: string | null;
}
