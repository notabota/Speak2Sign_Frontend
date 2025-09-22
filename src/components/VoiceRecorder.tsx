import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mic, MicOff, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

type RecordingState = 'idle' | 'recording' | 'processing';

interface VoiceRecorderProps {
  onGlossGenerated: (gloss: string) => void;
}

// Sample gloss data for demonstration
const sampleGlosses = [
  "HELLO MY NAME J-O-H-N",
  "HOW YOU TODAY FEEL?",
  "I WANT LEARN SIGN LANGUAGE",
  "THANK YOU HELP ME",
  "WEATHER TODAY BEAUTIFUL",
  "I HUNGRY WANT EAT",
  "WHERE BATHROOM?",
  "NICE MEET YOU",
  "I LOVE COFFEE MORNING",
  "SEE YOU LATER"
];

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onGlossGenerated }) => {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const audioChunks: BlobPart[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        // Use AI model to process audio 
        processAudio(audioBlob);
      };
      
      mediaRecorder.start();
      setRecordingState('recording');
      setRecordingTime(0);
      
      // Start timer
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.stop();
      setRecordingState('processing');
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate random sample gloss
    const randomGloss = sampleGlosses[Math.floor(Math.random() * sampleGlosses.length)];
    onGlossGenerated(randomGloss);
    
    setRecordingState('idle');
    setRecordingTime(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getButtonConfig = () => {
    switch (recordingState) {
      case 'recording':
        return {
          icon: Square,
          text: 'Stop Recording',
          className: 'bg-recording hover:bg-recording/90 text-recording-foreground shadow-recording animate-pulse-recording',
          onClick: stopRecording
        };
      case 'processing':
        return {
          icon: MicOff,
          text: 'Processing...',
          className: 'bg-processing hover:bg-processing/90 text-processing-foreground cursor-not-allowed',
          onClick: () => {}
        };
      default:
        return {
          icon: Mic,
          text: 'Start Recording',
          className: 'bg-blue-600 hover:scale-105 text-primary-foreground shadow-glow transition-all duration-300',
          onClick: startRecording
        };
    }
  };

  const buttonConfig = getButtonConfig();
  const Icon = buttonConfig.icon;

  return (
    <Card className="p-8 bg-card/50 backdrop-blur-sm border-2 border-border/50 shadow-soft">
      <div className="flex flex-col items-center space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Voice to Sign Language</h2>
          <p className="text-muted-foreground">
            {recordingState === 'idle' && "Click the button below to start recording"}
            {recordingState === 'recording' && "Listening... Speak clearly into your microphone"}
            {recordingState === 'processing' && "Converting your speech to sign language..."}
          </p>
        </div>

        <div className="relative">
          <Button
            size="lg"
            className={cn(
              "h-24 w-24 rounded-full p-0 transition-all duration-300",
              buttonConfig.className
            )}
            onClick={buttonConfig.onClick}
            disabled={recordingState === 'processing'}
          >
            <Icon size={32} />
          </Button>
          
          {recordingState === 'recording' && (
            <div className="absolute -top-2 -right-2 bg-recording text-recording-foreground text-xs px-2 py-1 rounded-full animate-bounce-subtle">
              {formatTime(recordingTime)}
            </div>
          )}
        </div>

        <div className="text-center">
          <p className="text-sm font-medium">{buttonConfig.text}</p>
          {recordingState === 'recording' && (
            <p className="text-xs text-muted-foreground mt-1">
              Recording will automatically stop after a pause
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};