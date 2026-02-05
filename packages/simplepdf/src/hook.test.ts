import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEmbed, sendEvent } from './hook';

describe('sendEvent', () => {
  let mockIframe: HTMLIFrameElement;
  let messageHandler: ((event: MessageEvent) => void) | null = null;

  beforeEach(() => {
    mockIframe = document.createElement('iframe');
    document.body.appendChild(mockIframe);

    // Mock contentWindow
    Object.defineProperty(mockIframe, 'contentWindow', {
      value: {
        postMessage: vi.fn(),
      },
      writable: true,
    });

    // Capture message handlers
    const originalAddEventListener = window.addEventListener;
    vi.spyOn(window, 'addEventListener').mockImplementation((type, handler) => {
      if (type === 'message') {
        messageHandler = handler as (event: MessageEvent) => void;
      }
      return originalAddEventListener.call(window, type, handler);
    });
  });

  afterEach(() => {
    document.body.removeChild(mockIframe);
    messageHandler = null;
    vi.restoreAllMocks();
  });

  it('should send event via postMessage', async () => {
    const payload = { type: 'TEST_EVENT', data: { test: true } };

    // Start sending (don't await yet)
    const promise = sendEvent(mockIframe, payload);

    // Verify postMessage was called
    expect(mockIframe.contentWindow?.postMessage).toHaveBeenCalled();
    const [sentMessage] = (mockIframe.contentWindow?.postMessage as ReturnType<typeof vi.fn>).mock.calls[0];
    const parsed = JSON.parse(sentMessage);

    expect(parsed.type).toBe('TEST_EVENT');
    expect(parsed.data).toEqual({ test: true });
    expect(parsed.request_id).toBeTruthy();

    // Simulate response
    if (messageHandler) {
      const responseEvent = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'REQUEST_RESULT',
          data: {
            request_id: parsed.request_id,
            result: { success: true },
          },
        }),
        source: mockIframe.contentWindow,
      });
      messageHandler(responseEvent);
    }

    const result = await promise;
    expect(result).toEqual({ success: true });
  });

  it('should timeout after 30 seconds', async () => {
    vi.useFakeTimers();

    const payload = { type: 'TEST_EVENT', data: {} };
    const promise = sendEvent(mockIframe, payload);

    // Fast-forward past timeout
    vi.advanceTimersByTime(31000);

    const result = await promise;
    expect(result.success).toBe(false);
    expect((result as { error: { code: string } }).error.code).toBe('unexpected:request_timed_out');

    vi.useRealTimers();
  });
});

describe('useEmbed', () => {
  it('should return embedRef and actions', () => {
    const { result } = renderHook(() => useEmbed());

    expect(result.current.embedRef).toBeDefined();
    expect(result.current.embedRef.current).toBeNull();
    expect(result.current.actions).toBeDefined();
  });

  it('should have all action methods', () => {
    const { result } = renderHook(() => useEmbed());
    const { actions } = result.current;

    expect(typeof actions.goTo).toBe('function');
    expect(typeof actions.selectTool).toBe('function');
    expect(typeof actions.createField).toBe('function');
    expect(typeof actions.clearFields).toBe('function');
    expect(typeof actions.getDocumentContent).toBe('function');
    expect(typeof actions.submit).toBe('function');
  });

  it('should return error when embedRef is not available', async () => {
    const { result } = renderHook(() => useEmbed());

    let goToResult: { success: boolean; error?: { code: string } };
    await act(async () => {
      goToResult = await result.current.actions.goTo({ page: 1 });
    });

    expect(goToResult!.success).toBe(false);
    expect(goToResult!.error?.code).toBe('bad_request:embed_ref_not_available');
  });

  it('should return error for selectTool when ref not available', async () => {
    const { result } = renderHook(() => useEmbed());

    let selectResult: { success: boolean; error?: { code: string } };
    await act(async () => {
      selectResult = await result.current.actions.selectTool('TEXT');
    });

    expect(selectResult!.success).toBe(false);
    expect(selectResult!.error?.code).toBe('bad_request:embed_ref_not_available');
  });

  it('should return error for createField when ref not available', async () => {
    const { result } = renderHook(() => useEmbed());

    let createResult: { success: boolean; error?: { code: string } };
    await act(async () => {
      createResult = await result.current.actions.createField({
        type: 'TEXT',
        page: 1,
        x: 0,
        y: 0,
        width: 100,
        height: 50,
      });
    });

    expect(createResult!.success).toBe(false);
    expect(createResult!.error?.code).toBe('bad_request:embed_ref_not_available');
  });

  it('should return error for clearFields when ref not available', async () => {
    const { result } = renderHook(() => useEmbed());

    let clearResult: { success: boolean; error?: { code: string } };
    await act(async () => {
      clearResult = await result.current.actions.clearFields();
    });

    expect(clearResult!.success).toBe(false);
    expect(clearResult!.error?.code).toBe('bad_request:embed_ref_not_available');
  });

  it('should return error for getDocumentContent when ref not available', async () => {
    const { result } = renderHook(() => useEmbed());

    let contentResult: { success: boolean; error?: { code: string } };
    await act(async () => {
      contentResult = await result.current.actions.getDocumentContent({ extractionMode: 'auto' });
    });

    expect(contentResult!.success).toBe(false);
    expect(contentResult!.error?.code).toBe('bad_request:embed_ref_not_available');
  });

  it('should return error for submit when ref not available', async () => {
    const { result } = renderHook(() => useEmbed());

    let submitResult: { success: boolean; error?: { code: string } };
    await act(async () => {
      submitResult = await result.current.actions.submit({ downloadCopyOnDevice: false });
    });

    expect(submitResult!.success).toBe(false);
    expect(submitResult!.error?.code).toBe('bad_request:embed_ref_not_available');
  });

  it('should maintain stable reference across renders', () => {
    const { result, rerender } = renderHook(() => useEmbed());

    const firstRef = result.current.embedRef;
    const firstActions = result.current.actions;

    rerender();

    expect(result.current.embedRef).toBe(firstRef);
    expect(result.current.actions.goTo).toBe(firstActions.goTo);
    expect(result.current.actions.selectTool).toBe(firstActions.selectTool);
  });
});
