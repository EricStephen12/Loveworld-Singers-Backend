/**
 * EXPORT SERVICE
 * 
 * Handles mixing multiple tracks into a single WAV file
 */

export interface TrackToExport {
    id: string;
    name: string;
    audioUrl?: string;
    muted: boolean;
    effects?: {
        volume: number;
        pan: number;
        reverb: number;
        bass: number;
        treble: number;
        compression: number;
    };
}

export type ExportProgressCallback = (step: 'collecting' | 'processing' | 'exporting' | 'done', progress: number) => void;

/**
 * Mix tracks and export as WAV Blob
 */
export async function exportMix(
    tracks: TrackToExport[],
    onProgress?: ExportProgressCallback
): Promise<Blob> {
    const tracksWithAudio = tracks.filter(t => t.audioUrl && !t.muted);

    if (tracksWithAudio.length === 0) {
        throw new Error('No recordings to export');
    }

        onProgress?.('collecting', 0);
    const sampleRate = 44100;
    const audioBuffers: { buffer: AudioBuffer; track: TrackToExport }[] = [];

    for (let i = 0; i < tracksWithAudio.length; i++) {
        const track = tracksWithAudio[i];
        onProgress?.('collecting', Math.round((i / tracksWithAudio.length) * 30));

        try {
            const response = await fetch(track.audioUrl!);
            const arrayBuffer = await response.arrayBuffer();

            // Create a temporary context just for decoding
            const tempContext = new AudioContext({ sampleRate });
            const audioBuffer = await tempContext.decodeAudioData(arrayBuffer);
            await tempContext.close();

            audioBuffers.push({ buffer: audioBuffer, track });
        } catch (err) {
 console.error(`[ExportService] Failed to load track ${track.name}:`, err);
        }
    }

    if (audioBuffers.length === 0) {
        throw new Error('Failed to load any audio tracks');
    }

        onProgress?.('processing', 35);
    const maxDuration = Math.max(...audioBuffers.map(ab => ab.buffer.duration));
    const totalSamples = Math.ceil(maxDuration * sampleRate);

    const offlineContext = new OfflineAudioContext(2, totalSamples, sampleRate);

    // Process each track with effects
    for (const { buffer, track } of audioBuffers) {
        const source = offlineContext.createBufferSource();
        source.buffer = buffer;

        const gainNode = offlineContext.createGain();
        const volume = track.effects?.volume ?? 80;
        gainNode.gain.value = volume / 100;

        const panNode = offlineContext.createStereoPanner();
        const pan = track.effects?.pan ?? 0;
        panNode.pan.value = pan / 100;

        const bassFilter = offlineContext.createBiquadFilter();
        bassFilter.type = 'lowshelf';
        bassFilter.frequency.value = 200;
        bassFilter.gain.value = track.effects?.bass ?? 0;

        const trebleFilter = offlineContext.createBiquadFilter();
        trebleFilter.type = 'highshelf';
        trebleFilter.frequency.value = 3000;
        trebleFilter.gain.value = track.effects?.treble ?? 0;

        const compressor = offlineContext.createDynamicsCompressor();
        const compression = track.effects?.compression ?? 30;
        compressor.threshold.value = -50 + (compression / 100) * 40;
        compressor.knee.value = 30;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;

        source.connect(gainNode);
        gainNode.connect(panNode);
        panNode.connect(bassFilter);
        bassFilter.connect(trebleFilter);
        trebleFilter.connect(compressor);
        compressor.connect(offlineContext.destination);

        source.start(0);
    }

    onProgress?.('processing', 60);
    const renderedBuffer = await offlineContext.startRendering();

        onProgress?.('exporting', 75);
    const wavBlob = audioBufferToWav(renderedBuffer);
    onProgress?.('exporting', 100);

    return wavBlob;
}

/**
 * Convert AudioBuffer to WAV Blob
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    const dataLength = buffer.length * blockAlign;
    const bufferLength = 44 + dataLength;

    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, bufferLength - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    const channels: Float32Array[] = [];
    for (let i = 0; i < numChannels; i++) {
        channels.push(buffer.getChannelData(i));
    }

    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
            const sample = Math.max(-1, Math.min(1, channels[ch][i]));
            const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset, intSample, true);
            offset += 2;
        }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
}
