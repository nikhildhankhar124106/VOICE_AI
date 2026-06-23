'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Mic, Loader2, Command } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function VoiceAssistant({ onRefreshTasks }: { onRefreshTasks: () => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState("Try: 'Schedule a call tomorrow at 9'");
  const [volume, setVolume] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const startVisualizer = (stream: MediaStream) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 32;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const update = () => {
        if (!analyserRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setVolume(avg);
        animationFrameRef.current = requestAnimationFrame(update);
      };
      
      if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => update());
      } else {
        update();
      }
    } catch (e) {
      console.error("Visualizer failed to start:", e);
    }
  };

  const stopVisualizer = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    setVolume(0);
  };

  const startRecording = useCallback(async () => {
    if (isRecording || isProcessing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      startVisualizer(stream);
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await handleAudioUpload(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setStatus("");
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setStatus('Microphone access denied');
    }
  }, [isRecording, isProcessing]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
      stopVisualizer();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  }, [isRecording]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault();
        if (isRecording) stopRecording();
        else startRecording();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      stopVisualizer();
    };
  }, [isRecording, startRecording, stopRecording]);

  const handleAudioUpload = async (blob: Blob) => {
    setStatus("Transcribing...");
    const formData = new FormData();
    formData.append('file', blob, 'audio.webm');

    try {
      const transResponse = await axios.post(`${API_URL}/transcribe`, formData);
      const userText = transResponse.data.text;
      setStatus(userText);

      const chatResponse = await axios.post(`${API_URL}/chat`, { text: userText });
      const aiResponse = chatResponse.data.response;
      
      setStatus(aiResponse);
      speak(aiResponse);
      onRefreshTasks();
    } catch (err) {
      console.error('Error processing voice:', err);
      setStatus('An error occurred. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="command-container">
      <div className={`command-bar ${isRecording ? 'active recording' : ''}`}>
        <button 
          className="mic-button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <Mic size={20} />
          )}
        </button>

        <div className="transcription-area">
          <AnimatePresence mode="wait">
            {isRecording ? (
              <motion.div 
                key="waveform"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="waveform"
                style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '24px' }}
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <motion.div 
                    key={i} 
                    className="wave-bar" 
                    animate={{ 
                      height: [
                        4 + (volume / 255) * 20, 
                        12 + (volume / 255) * 60, 
                        4 + (volume / 255) * 20
                      ],
                      opacity: [0.4, 1, 0.4] 
                    }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: 0.8, 
                      delay: i * 0.08,
                      ease: "easeInOut"
                    }}
                    style={{ width: 3, background: 'var(--primary)', borderRadius: 10 }}
                  />
                ))}
                <span style={{ marginLeft: '12px', fontSize: '0.9rem', color: 'var(--muted)', fontWeight: 500 }}>
                  Listening...
                </span>
              </motion.div>
            ) : (
              <motion.div 
                key={status || 'empty'}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                style={{ fontSize: '1rem', color: 'var(--secondary)', fontWeight: 400 }}
              >
                {status || "Try: 'Schedule a call tomorrow at 9'"}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="kbd-badge">
          <Command size={10} /> L
        </div>
      </div>



      <div className="suggested-commands" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {[
          'Add a sync at 4pm', 
          'Review my pending tasks', 
          'Mark latest task as completed'
        ].map(cmd => (
          <button 
            key={cmd} 
            className="command-pill" 
            onClick={() => setStatus(`Try: "${cmd}"`)}
          >
            {cmd}
          </button>
        ))}
      </div>
    </div>
  );
}
