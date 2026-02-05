import { describe, it, expect, vi } from 'vitest';
import {
  generateRandomID,
  buildEditorDomain,
  encodeContext,
  buildEditorURL,
  extractDocumentName,
} from './utils';

describe('generateRandomID', () => {
  it('should generate a unique ID', () => {
    const id1 = generateRandomID();
    const id2 = generateRandomID();

    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
  });

  it('should contain timestamp and random part', () => {
    const id = generateRandomID();
    const parts = id.split('_');

    expect(parts).toHaveLength(2);
    expect(Number(parts[0])).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
  });
});

describe('buildEditorDomain', () => {
  it('should use default domain and subdomain when not provided', () => {
    const result = buildEditorDomain({
      baseDomain: undefined,
      companyIdentifier: undefined,
    });

    expect(result).toBe('https://react-editor.simplepdf.com');
  });

  it('should use custom company identifier', () => {
    const result = buildEditorDomain({
      baseDomain: undefined,
      companyIdentifier: 'mycompany',
    });

    expect(result).toBe('https://mycompany.simplepdf.com');
  });

  it('should use custom base domain', () => {
    const result = buildEditorDomain({
      baseDomain: 'custom.com',
      companyIdentifier: undefined,
    });

    expect(result).toBe('https://react-editor.custom.com');
  });

  it('should use both custom domain and identifier', () => {
    const result = buildEditorDomain({
      baseDomain: 'custom.com',
      companyIdentifier: 'mycompany',
    });

    expect(result).toBe('https://mycompany.custom.com');
  });

  it('should use http for localhost', () => {
    const result = buildEditorDomain({
      baseDomain: 'localhost:3000',
      companyIdentifier: 'test',
    });

    expect(result).toBe('http://test.localhost:3000');
  });

  it('should use http for .nil domains', () => {
    const result = buildEditorDomain({
      baseDomain: 'dev.nil',
      companyIdentifier: 'test',
    });

    expect(result).toBe('http://test.dev.nil');
  });
});

describe('encodeContext', () => {
  it('should return null for undefined context', () => {
    const result = encodeContext(undefined);
    expect(result).toBeNull();
  });

  it('should encode context object', () => {
    const context = { key: 'value', number: 123 };
    const result = encodeContext(context);

    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('should produce decodable result', () => {
    const context = { user: 'test', id: 42 };
    const encoded = encodeContext(context);

    expect(encoded).toBeTruthy();

    const decoded = JSON.parse(atob(decodeURIComponent(encoded!)));
    expect(decoded).toEqual(context);
  });

  it('should handle complex nested objects', () => {
    const context = {
      nested: { deep: { value: 'test' } },
      array: [1, 2, 3],
    };
    const result = encodeContext(context);

    expect(result).toBeTruthy();
  });

  it('should handle errors gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Create circular reference which can't be stringified
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const result = encodeContext(circular);

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});

describe('buildEditorURL', () => {
  it('should build basic URL with default locale', () => {
    const result = buildEditorURL({
      editorDomain: 'https://editor.simplepdf.com',
      locale: undefined,
      encodedContext: null,
      hasDocumentUrl: false,
      corsProxyFallbackUrl: null,
    });

    expect(result).toBe('https://editor.simplepdf.com/en/editor');
  });

  it('should use specified locale', () => {
    const result = buildEditorURL({
      editorDomain: 'https://editor.simplepdf.com',
      locale: 'de',
      encodedContext: null,
      hasDocumentUrl: false,
      corsProxyFallbackUrl: null,
    });

    expect(result).toContain('/de/editor');
  });

  it('should add context parameter', () => {
    const result = buildEditorURL({
      editorDomain: 'https://editor.simplepdf.com',
      locale: 'en',
      encodedContext: 'encoded123',
      hasDocumentUrl: false,
      corsProxyFallbackUrl: null,
    });

    expect(result).toContain('context=encoded123');
  });

  it('should add loadingPlaceholder when document URL exists', () => {
    const result = buildEditorURL({
      editorDomain: 'https://editor.simplepdf.com',
      locale: 'en',
      encodedContext: null,
      hasDocumentUrl: true,
      corsProxyFallbackUrl: null,
    });

    expect(result).toContain('loadingPlaceholder=true');
  });

  it('should add open parameter for CORS fallback', () => {
    const result = buildEditorURL({
      editorDomain: 'https://editor.simplepdf.com',
      locale: 'en',
      encodedContext: null,
      hasDocumentUrl: false,
      corsProxyFallbackUrl: 'https://example.com/doc.pdf',
    });

    expect(result).toContain('open=');
    expect(result).toContain('example.com');
  });
});

describe('extractDocumentName', () => {
  it('should extract filename from simple URL', () => {
    const result = extractDocumentName('https://example.com/document.pdf');
    expect(result).toBe('document.pdf');
  });

  it('should extract filename from URL with query params', () => {
    const result = extractDocumentName('https://example.com/document.pdf?token=abc');
    expect(result).toBe('document.pdf');
  });

  it('should extract filename from path', () => {
    const result = extractDocumentName('/path/to/file.pdf');
    expect(result).toBe('file.pdf');
  });

  it('should handle URL without filename', () => {
    const result = extractDocumentName('https://example.com/');
    expect(result).toBe('');
  });

  it('should handle complex paths', () => {
    const result = extractDocumentName('https://cdn.example.com/uploads/2024/01/report.pdf');
    expect(result).toBe('report.pdf');
  });
});
