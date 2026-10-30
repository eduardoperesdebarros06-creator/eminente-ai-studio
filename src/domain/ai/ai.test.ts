import { describe, expect, it } from 'vitest';
import { DEFAULT_AI, normalizeOllamaUrl, pickModel, readAiSettings } from './ai';

describe('IA local', () => {
  it('aceita só endereços desta máquina', () => {
    expect(normalizeOllamaUrl('http://127.0.0.1:11434/')).toBe('http://127.0.0.1:11434');
    expect(normalizeOllamaUrl('localhost:11434')).toBe('http://localhost:11434');
    expect(normalizeOllamaUrl('http://[::1]:11434')).toBe('http://[::1]:11434');
    expect(normalizeOllamaUrl('https://LOCALHOST')).toBe('https://localhost');
    expect(normalizeOllamaUrl('http://192.168.0.10:11434')).toBeNull();
    expect(normalizeOllamaUrl('http://ollama.example.com')).toBeNull();
    expect(normalizeOllamaUrl('http://127.0.0.1.example.com')).toBeNull();
    expect(normalizeOllamaUrl('http://user:pw@localhost:11434')).toBeNull();
    expect(normalizeOllamaUrl('http://localhost:11434/api')).toBeNull();
    expect(normalizeOllamaUrl('file:///etc/passwd')).toBeNull();
    expect(normalizeOllamaUrl('')).toBeNull();
  });

  it('configurações: padrão desligado e valores inválidos corrigidos', () => {
    expect(readAiSettings(undefined)).toEqual(DEFAULT_AI);
    expect(readAiSettings({ enabled: 'sim', url: 'http://10.0.0.1', model: '  ', temperature: -2 })).toEqual({
      ...DEFAULT_AI,
      temperature: 0,
    });
    expect(readAiSettings({ enabled: true, url: 'localhost:11500', model: 'qwen2.5:7b', temperature: 0.333 })).toEqual({
      enabled: true,
      url: 'http://localhost:11500',
      model: 'qwen2.5:7b',
      temperature: 0.33,
    });
  });

  it('modelo: o escolhido, o mesmo com ":latest", ou o primeiro instalado', () => {
    const models = [
      { name: 'llama3.2:latest', size: 1, parameters: '3.2B' },
      { name: 'qwen2.5:7b', size: 2, parameters: '7B' },
    ];
    expect(pickModel(models, 'qwen2.5:7b')).toBe('qwen2.5:7b');
    expect(pickModel(models, 'llama3.2')).toBe('llama3.2:latest');
    expect(pickModel(models, 'removido:1b')).toBe('llama3.2:latest');
    expect(pickModel(models, null)).toBe('llama3.2:latest');
    expect(pickModel([], 'x')).toBeNull();
  });
});
