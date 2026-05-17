// Media Library Diagnostics Tool
import { supabase } from '@/lib/supabase-client';

export interface DiagnosticResult {
  test: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

export async function runMediaDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];

  // Test 1: Supabase Connection
  try {
    const { data, error } = await supabase.from('media').select('count', { count: 'exact', head: true });
    if (error) throw error;
    results.push({
      test: 'Supabase Connection',
      status: 'pass',
      message: 'Successfully connected to Supabase',
      details: { count: data }
    });
  } catch (error) {
    results.push({
      test: 'Supabase Connection',
      status: 'fail',
      message: `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error
    });
  }

  // Test 2: Media Table Access
  try {
    const { data, error } = await supabase
      .from('media')
      .select('id, name, url, type')
      .limit(1);
    
    if (error) throw error;
    results.push({
      test: 'Media Table Access',
      status: 'pass',
      message: `Can read from media table (${data?.length || 0} sample records)`,
      details: data
    });
  } catch (error) {
    results.push({
      test: 'Media Table Access',
      status: 'fail',
      message: `Cannot read from media table: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error
    });
  }

  // Test 3: Storage Bucket Access
  try {
    const { data, error } = await supabase.storage.from('media-files').list('', { limit: 1 });
    if (error) throw error;
    results.push({
      test: 'Storage Bucket Access',
      status: 'pass',
      message: 'Can access media-files storage bucket',
      details: data
    });
  } catch (error) {
    results.push({
      test: 'Storage Bucket Access',
      status: 'fail',
      message: `Cannot access storage bucket: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error
    });
  }

  // Test 4: Storage Bucket Public Access
  try {
    const { data } = supabase.storage.from('media-files').getPublicUrl('test.txt');
    if (data.publicUrl) {
      results.push({
        test: 'Storage Public URL',
        status: 'pass',
        message: 'Can generate public URLs',
        details: { sampleUrl: data.publicUrl }
      });
    } else {
      results.push({
        test: 'Storage Public URL',
        status: 'warning',
        message: 'Public URL generation may not be configured',
        details: data
      });
    }
  } catch (error) {
    results.push({
      test: 'Storage Public URL',
      status: 'fail',
      message: `Cannot generate public URLs: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error
    });
  }

  // Test 5: Audio Playback Support
  try {
    const audio = new Audio();
    const canPlayMP3 = audio.canPlayType('audio/mpeg');
    const canPlayWAV = audio.canPlayType('audio/wav');
    const canPlayOGG = audio.canPlayType('audio/ogg');
    
    results.push({
      test: 'Audio Playback Support',
      status: canPlayMP3 || canPlayWAV ? 'pass' : 'warning',
      message: 'Browser audio support detected',
      details: {
        mp3: canPlayMP3,
        wav: canPlayWAV,
        ogg: canPlayOGG
      }
    });
  } catch (error) {
    results.push({
      test: 'Audio Playback Support',
      status: 'fail',
      message: 'Audio playback not supported',
      details: error
    });
  }

  // Test 6: CORS Configuration
  try {
    const { data } = supabase.storage.from('media-files').getPublicUrl('test.mp3');
    if (data.publicUrl) {
      // Try to fetch with CORS
      const response = await fetch(data.publicUrl, { method: 'HEAD', mode: 'cors' });
      results.push({
        test: 'CORS Configuration',
        status: 'pass',
        message: 'CORS is properly configured',
        details: { headers: Object.fromEntries(response.headers.entries()) }
      });
    }
  } catch (error) {
    results.push({
      test: 'CORS Configuration',
      status: 'warning',
      message: 'CORS may not be configured (this is normal if no files exist)',
      details: error
    });
  }

  // Test 7: Upload Permissions
  try {
    // Try to create a test file (we'll delete it immediately)
    const testBlob = new Blob(['test'], { type: 'text/plain' });
    const testFile = new File([testBlob], 'diagnostic-test.txt');
    
    const { data, error } = await supabase.storage
      .from('media-files')
      .upload(`diagnostic/${Date.now()}.txt`, testFile, { upsert: true });
    
    if (error) throw error;
    
    // Clean up
    if (data?.path) {
      await supabase.storage.from('media-files').remove([data.path]);
    }
    
    results.push({
      test: 'Upload Permissions',
      status: 'pass',
      message: 'Can upload files to storage',
      details: data
    });
  } catch (error) {
    results.push({
      test: 'Upload Permissions',
      status: 'fail',
      message: `Cannot upload files: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error
    });
  }

  return results;
}

export function printDiagnostics(results: DiagnosticResult[]) {
  
  results.forEach((result, index) => {
    const icon = result.status === 'pass' ? '' : result.status === 'fail' ? '' : '️';
    if (result.details) {
    }
  });
  
  
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  
}

