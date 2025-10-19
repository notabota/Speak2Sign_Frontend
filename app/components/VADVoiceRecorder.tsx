"use client";

import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Progress } from "@/app/components/ui/progress";
import { Mic, MicOff, Loader2, Volume2, VolumeX } from "lucide-react";

interface VADResult {
    transcription?: string;
    gloss?: string;
    sigml?: string;
    isNewSegment?: boolean;
}

interface VADVoiceRecorderProps {
    onResult?: (result: VADResult) => void;
    onClear?: () => void;
    /**
     * Preferred BCP‑47 locale for transcription (e.g. "en-US", "en-AU").
     * Defaults to "en-US" if not provided.
     */
    transcriptionLocale?: string;
    /**
     * Fast Transcription API endpoint. If not provided, falls back to env var
     * NEXT_PUBLIC_FALLBACK_TRANSCRIBER_URL or Microsoft's public preview URL.
     */
    fastApiUrl?: string;
    /**
     * API key header value for Fast Transcription API ("Ocp-Apim-Subscription-Key").
     * If not provided, uses env var NEXT_PUBLIC_FALLBACK_API_KEY.
     */
    fastApiKey?: string;
}

/**
 * A zero-dependency client-side VAD using short-term energy with adaptive noise floor + hangover logic.
 * Goal: detect end of each speech segment and POST it to Fast Transcription API as WAV (16 kHz mono).
 *
 * No ONNX/WebAssembly. Works in modern browsers without cross-origin isolation.
 */
export function VADVoiceRecorder({
                                     onResult,
                                     onClear,
                                     transcriptionLocale = "en-US",
                                     fastApiUrl =
                                         process.env.NEXT_PUBLIC_FALLBACK_TRANSCRIBER_URL ||
                                         "https://australiaeast.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe?api-version=2024-11-15",
                                     fastApiKey = process.env.NEXT_PUBLIC_FALLBACK_API_KEY || "7feed90e615f47f88fdf24fd66743a29",
                                 }: VADVoiceRecorderProps) {
    const [status, setStatus] = useState<"idle" | "listening" | "error">("idle");
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [audioLevel, setAudioLevel] = useState(0);
    const [totalRecordings, setTotalRecordings] = useState(0);
    const [lastRecordingDuration, setLastRecordingDuration] = useState(0);
    const [isSpeaking, setIsSpeaking] = useState(false); // live speaking indicator

    // Audio graph refs
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const workletNodeRef = useRef<AudioWorkletNode | ScriptProcessorNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const rafRef = useRef<number | null>(null);

    // Buffering for current speech segment (captured at input sample rate)
    const captureBufRef = useRef<Float32Array[]>([]);
    const inputSampleRateRef = useRef<number>(48000);

    // ====== VAD parameters (tweak to taste) ======
    const FRAME_SIZE_MS = 10; // analysis frame size
    const HOP_MS = 10; // hop == frame size (no overlap)
    const MIN_VOICE_MS = 200; // minimum speech to keep a segment (reduced from 250ms)
    // More sensitive: allow only ~0.4s of silence before we close a segment (reduced from 900ms)
    const MAX_SILENCE_HANGOVER_MS = 400;
    // Require fewer consecutive voiced frames to start a segment (reduced from 4)
    const START_TRIGGER_FRAMES = 2;
    const STOP_TRIGGER_FRAMES = Math.ceil(MAX_SILENCE_HANGOVER_MS / HOP_MS);
    const TARGET_SR = 16000;

    // Adaptive threshold params - more sensitive
    const NOISE_ALPHA = 0.95; // higher -> slower noise tracking
    const LEVEL_SENSITIVITY = 1.5; // threshold = noiseRms * LEVEL_SENSITIVITY (reduced from 2.0)
    const MIN_DBFS_GATE = -55; // below this (approx), treat as silence regardless of noise (more sensitive)

    // Internal VAD state
    const vadStateRef = useRef({
        inSpeech: false,
        consecVoiced: 0,
        consecUnvoiced: 0,
        noiseRms: 0.001,
        maxRms: 0.001,
        samplesPerFrame: 480, // initial for 10ms @ 48k; will set on start from actual rate
        frameBuf: new Float32Array(0),
    });

    // === Utilities ===
    const floatTo16BitPCM = (input: Float32Array) => {
        const output = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
            let s = Math.max(-1, Math.min(1, input[i]));
            output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        return output;
    };

    const encodeWav = (pcm16: Int16Array, sampleRate: number) => {
        const buffer = new ArrayBuffer(44 + pcm16.length * 2);
        const view = new DataView(buffer);

        const writeString = (offset: number, str: string) => {
            for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
        };

        writeString(0, "RIFF");
        view.setUint32(4, 36 + pcm16.length * 2, true);
        writeString(8, "WAVE");
        writeString(12, "fmt ");
        view.setUint32(16, 16, true); // PCM
        view.setUint16(20, 1, true); // format
        view.setUint16(22, 1, true); // channels
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true); // byte rate
        view.setUint16(32, 2, true); // block align
        view.setUint16(34, 16, true); // bits per sample
        writeString(36, "data");
        view.setUint32(40, pcm16.length * 2, true);

        let offset = 44;
        for (let i = 0; i < pcm16.length; i++, offset += 2) view.setInt16(offset, pcm16[i], true);

        return new Blob([view], { type: "audio/wav" });
    };

    // Simple streaming resampler from arbitrary input SR -> 16k using linear interpolation.
    // Keeps fractional phase between calls.
    const resampleStateRef = useRef({ phase: 0 });
    const resampleTo16k = (input: Float32Array, inSr: number) => {
        if (inSr === TARGET_SR) return input;
        const ratio = TARGET_SR / inSr;
        const outLen = Math.floor(input.length * ratio + 1);
        const out = new Float32Array(outLen);
        let phase = resampleStateRef.current.phase;
        for (let i = 0; i < outLen; i++) {
            const pos = phase;
            const idx = Math.floor(pos);
            const frac = pos - idx;
            const s0 = input[idx] ?? input[input.length - 1] ?? 0;
            const s1 = input[idx + 1] ?? s0;
            out[i] = s0 + (s1 - s0) * frac;
            phase += 1 / ratio;
            if (phase >= input.length - 1) break;
        }
        // Keep leftover phase within current input window for continuity
        resampleStateRef.current.phase = phase - (input.length - 1);
        return out;
    };

    const dbfs = (rms: number) => 20 * Math.log10(Math.max(1e-9, rms));

    // === Transcription via Fast Transcription API ===
    const transcribeWithFastAPI = async (wavBlob: Blob): Promise<string> => {
        // Build multipart form: { audio, definition }
        const form = new FormData();
        form.append("audio", wavBlob, "segment.wav");
        const definition = { locales: [transcriptionLocale || "en-US"] } as const;
        form.append("definition", JSON.stringify(definition));

        const resp = await fetch(fastApiUrl, {
            method: "POST",
            headers: {
                "Ocp-Apim-Subscription-Key": fastApiKey,
            },
            body: form,
        });

        if (!resp.ok) {
            const text = await resp.text().catch(() => "");
            throw new Error(`Fast Transcription failed: HTTP ${resp.status} ${resp.statusText} ${text}`);
        }
        const data = await resp.json();
        // Microsoft FT response shape: combinedPhrases[0].text
        const text: string | undefined = data?.combinedPhrases?.[0]?.text;
        return text ?? "";
    };

    // Called when a full speech segment is detected
    const handleSegment = async (monoSegment: Float32Array, inSr: number) => {
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

        try {
            // Resample to 16k
            resampleStateRef.current.phase = 0; // reset per segment
            const segment16k = resampleTo16k(monoSegment, inSr);
            const pcm16 = floatTo16BitPCM(segment16k);
            const wav = encodeWav(pcm16, TARGET_SR);

            setIsProcessing(true);

            // === Fast Transcription ===
            const transcription = await transcribeWithFastAPI(wav);

            if (!transcription) {
                // No text returned — do not emit gloss request
                return;
            }

            // Step 1: Send transcription for this segment
            onResult?.({
                transcription,
                gloss: "",
                sigml: ""
            });

            // Step 2: Generate gloss for THIS segment only
            const glossResponse = await fetch(`${backendUrl}/text-to-gloss`, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text: transcription })
            });
            if (!glossResponse.ok) throw new Error(`Gloss conversion failed: HTTP ${glossResponse.status}`);
            const glossResult = await glossResponse.json();

            // Step 3: Generate SiGML for this segment's gloss
            let sigmlContent = '';
            if (glossResult.gloss) {
                const sigmlResponse = await fetch(`${backendUrl}/gloss-to-sigml`, {
                    method: "POST",
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ gloss: glossResult.gloss })
                });
                if (sigmlResponse.ok) {
                    const sigmlResult = await sigmlResponse.json();
                    sigmlContent = sigmlResult.sigml || '';
                }
            }

            // Send complete result for this individual segment
            onResult?.({
                transcription: '',  // Empty since already sent
                gloss: glossResult.gloss || '',
                sigml: sigmlContent,
                isNewSegment: true  // Flag to indicate this is a new sentence segment
            });
        } catch (e: any) {
            setErrorMessage(e?.message || "Unknown error while processing segment");
        } finally {
            setIsProcessing(false);
        }
    };

    // ====== AudioWorklet-based frame pump ======
    const addWorkletProcessor = async (ctx: AudioContext) => {
        const processorCode = `
      class FramePumpProcessor extends AudioWorkletProcessor {
        constructor() { super(); this._buf = []; }
        process(inputs) {
          const input = inputs[0];
          if (!input || !input[0]) return true;
          const ch0 = input[0];
          this.port.postMessage(ch0);
          return true;
        }
      }
      registerProcessor('frame-pump', FramePumpProcessor);
    `;
        const blob = new Blob([processorCode], { type: "application/javascript" });
        const url = URL.createObjectURL(blob);
        await (ctx as any).audioWorklet.addModule(url);
        URL.revokeObjectURL(url);
    };

    const start = async () => {
        try {
            setErrorMessage("");
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            });
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            mediaStreamRef.current = stream;
            audioCtxRef.current = ctx;
            inputSampleRateRef.current = ctx.sampleRate;

            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            analyserRef.current = analyser;

            const source = ctx.createMediaStreamSource(stream);
            sourceRef.current = source;

            await addWorkletProcessor(ctx);
            const node = new (window as any).AudioWorkletNode(ctx, "frame-pump");
            workletNodeRef.current = node;

            source.connect(analyser);
            source.connect(node as any);
            const gain = ctx.createGain();
            gain.gain.value = 0.0;
            (node as any).disconnect();
            (node as any).connect(gain);
            gain.connect(ctx.destination);

            const samplesPerFrame = Math.round((FRAME_SIZE_MS / 1000) * ctx.sampleRate);
            vadStateRef.current.samplesPerFrame = samplesPerFrame;
            vadStateRef.current.frameBuf = new Float32Array(0);

            (node as any).port.onmessage = (ev: MessageEvent<Float32Array>) => {
                const chunk = ev.data;
                if (!chunk) return;
                pushAndProcessFrames(chunk);
            };

            // UI meter via analyser
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const tick = () => {
                analyser.getByteTimeDomainData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    const v = (dataArray[i] - 128) / 128;
                    sum += v * v;
                }
                const rms = Math.sqrt(sum / dataArray.length);
                setAudioLevel(Math.min(100, Math.round(rms * 100)));
                rafRef.current = requestAnimationFrame(tick);
            };
            rafRef.current = requestAnimationFrame(tick);

            setStatus("listening");
        } catch (e: any) {
            console.error(e);
            setErrorMessage(e?.message || "Could not start microphone");
            setStatus("error");
        }
    };

    const stop = () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        workletNodeRef.current && (workletNodeRef.current as any).port && ((workletNodeRef.current as any).port.onmessage = null);
        workletNodeRef.current?.disconnect();
        sourceRef.current?.disconnect();
        analyserRef.current?.disconnect();
        audioCtxRef.current?.close().catch(() => {});
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());

        mediaStreamRef.current = null;
        audioCtxRef.current = null;
        analyserRef.current = null;
        workletNodeRef.current = null;
        sourceRef.current = null;

        // If we were mid-segment, flush it
        flushCurrentSegment();

        setIsSpeaking(false);
        setAudioLevel(0);
        setStatus("idle");
    };

    const pushAndProcessFrames = (chunk: Float32Array) => {
        const vs = vadStateRef.current;
        let buf = concatFloat32(vs.frameBuf, chunk);
        const spf = vs.samplesPerFrame;
        let offset = 0;
        while (offset + spf <= buf.length) {
            const frame = buf.subarray(offset, offset + spf);
            processFrame(frame);
            offset += spf;
        }
        vs.frameBuf = buf.subarray(offset);
    };

    const concatFloat32 = (a: Float32Array, b: Float32Array) => {
        const out = new Float32Array(a.length + b.length);
        out.set(a, 0);
        out.set(b, a.length);
        return out;
    };

    const processFrame = (frame: Float32Array) => {
        const vs = vadStateRef.current;
        let sum = 0;
        for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
        const rms = Math.sqrt(sum / frame.length) + 1e-12;

        vs.maxRms = Math.max(vs.maxRms * 0.999, rms);

        const levelDb = dbfs(rms);
        const gate = levelDb > MIN_DBFS_GATE;

        const thr = vs.noiseRms * LEVEL_SENSITIVITY;
        if (!vs.inSpeech && rms <= thr) {
            vs.noiseRms = NOISE_ALPHA * vs.noiseRms + (1 - NOISE_ALPHA) * rms;
        }

        const voiced = gate && rms > thr;

        if (voiced) {
            vs.consecVoiced += 1;
            vs.consecUnvoiced = 0;
        } else {
            vs.consecUnvoiced += 1;
            vs.consecVoiced = 0;
        }

        if (!vs.inSpeech && vs.consecVoiced >= START_TRIGGER_FRAMES) {
            vs.inSpeech = true;
            setIsSpeaking(true);
            captureBufRef.current = [];
        }

        if (vs.inSpeech) {
            captureBufRef.current.push(frame.slice());
            if (vs.consecUnvoiced >= STOP_TRIGGER_FRAMES) {
                vs.inSpeech = false;
                setIsSpeaking(false);
                finalizeSegment();
                vs.consecUnvoiced = 0;
            }
        }
    };

    const flushCurrentSegment = () => {
        const vs = vadStateRef.current;
        if (vs.inSpeech && captureBufRef.current.length > 0) {
            vs.inSpeech = false;
            setIsSpeaking(false);
            finalizeSegment();
        }
    };

    const finalizeSegment = () => {
        const inputSr = inputSampleRateRef.current;
        const frames = captureBufRef.current;
        captureBufRef.current = [];
        if (frames.length === 0) return;

        const mono = joinFloat32(frames);
        const durationSec = mono.length / inputSr;

        if (durationSec * 1000 < MIN_VOICE_MS) {
            return;
        }

        setLastRecordingDuration(durationSec);
        setTotalRecordings((n) => n + 1);
        handleSegment(mono, inputSr);
    };

    const joinFloat32 = (chunks: Float32Array[]) => {
        const total = chunks.reduce((a, c) => a + c.length, 0);
        const out = new Float32Array(total);
        let off = 0;
        for (const c of chunks) {
            out.set(c, off);
            off += c.length;
        }
        return out;
    };

    const handleToggle = () => {
        if (status === "listening") stop();
        else start();
    };

    useEffect(() => {
        return () => {
            stop();
        };
    }, []);

    return (
        <Card className="w-full">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                    Voice Detection
                    <div className="flex gap-2 items-center">
                        <Badge variant={isSpeaking ? "destructive" : "secondary"} className="flex items-center gap-1 text-xs">
                            <span className={`inline-block h-2 w-2 rounded-full ${isSpeaking ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"}`} />
                            {isSpeaking ? "Speaking" : "Silent"}
                        </Badge>
                        <Badge variant={status === "listening" ? "default" : "secondary"} className="text-xs">
                            {status === "listening" ? "Listening" : "Idle"}
                        </Badge>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex justify-center gap-3">
                    <Button onClick={handleToggle} disabled={status === "error"} size="sm" className="w-24">
                        {status === "listening" ? <MicOff className="mr-1 h-3 w-3" /> : <Mic className="mr-1 h-3 w-3" />}
                        {status === "listening" ? "Stop" : "Start"}
                    </Button>
                    <Button onClick={() => onClear?.()} variant="outline" size="sm" className="w-24" disabled={status === "error"}>
                        Clear
                    </Button>
                </div>

                {status === "listening" && (
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1">
                {audioLevel > 0 ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
                  Audio
              </span>
                            <span>{Math.round(audioLevel)}%</span>
                        </div>
                        <Progress value={audioLevel} className="h-1" />
                    </div>
                )}

                {isProcessing && (
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Processing...
                    </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                        <span className="text-muted-foreground">Recordings:</span>
                        <div className="font-mono">{totalRecordings}</div>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Duration:</span>
                        <div className="font-mono">{lastRecordingDuration.toFixed(1)}s</div>
                    </div>
                </div>

                {errorMessage && (
                    <div className="p-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded">{errorMessage}</div>
                )}
            </CardContent>
        </Card>
    );
}
