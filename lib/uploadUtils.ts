import * as FileSystem from 'expo-file-system';
import { decode as decodeBase64 } from 'base64-arraybuffer';

/**
 * Base64 string'den ArrayBuffer oluşturur (Supabase için).
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  return decodeBase64(base64);
}

/**
 * URI'den ArrayBuffer oluşturur.
 * Önce fetch dener, başarısız olursa expo-file-system kullanır.
 */
export async function uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  try {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('Fetch failed');
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    if (arrayBuffer.byteLength === 0) throw new Error('Boş dosya');
    return arrayBuffer;
  } catch {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (!base64) throw new Error('Dosya okunamadı');
    return base64ToArrayBuffer(base64);
  }
}

/**
 * ImagePicker'dan gelen base64 ile doğrudan ArrayBuffer oluşturur.
 * URI sorunlarını bypass eder.
 */
export function base64ToArrayBufferFromPicker(base64: string): ArrayBuffer {
  return base64ToArrayBuffer(base64);
}
