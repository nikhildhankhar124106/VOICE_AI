'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import VoiceAssistant from '@/components/VoiceAssistant';
import { Check, Zap, Shield, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Task {
  id: number;
  content: string;
  status: string;
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/tasks`);
      setTasks(response.data);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.status === b.status) return b.id - a.id;
      return a.status === 'pending' ? -1 : 1;
    });
  }, [tasks]);

  const toggleTask = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
      await axios.put(`${API_URL}/tasks/${task.id}`, { status: newStatus });
    } catch (err) {
      console.error('Error updating task:', err);
      fetchTasks();
    }
  };

  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const completionRate = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return (
    <main className="container animate-fade">
      <div className="hero-grid">
        <div className="hero-content">
          <nav className="breadcrumb" style={{ marginBottom: '3rem' }}>
            VOICE COMMAND <span style={{ opacity: 0.3 }}>/</span> WORKSPACE
          </nav>
          <h1>
            Effortless action. <br />
            <span>Simply spoken.</span>
          </h1>
          <p style={{ marginBottom: '3.5rem' }}>
            A minimalist voice interface for high-performance teams. 
            Transform natural speech into structured tasks and operations instantly.
          </p>
          <VoiceAssistant onRefreshTasks={fetchTasks} />
        </div>

        <div className="telemetry-card">
          <div className="telemetry-header">
            <span className="telemetry-label">WORKSPACE INSIGHTS</span>
            <span className="telemetry-live">
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }}></span>
              ACTIVE
            </span>
          </div>

          <div className="stats-grid">
            <div className="stat-box">
              <div className="label">PENDING</div>
              <div className="value">{pendingCount.toString().padStart(2, '0')}</div>
            </div>
            <div className="stat-box">
              <div className="label">DONE</div>
              <div className="value">{completedCount.toString().padStart(2, '0')}</div>
            </div>
          </div>

          <div className="progress-section">
            <div className="progress-header">
              <span>DAILY PROGRESS</span>
              <span>{completionRate}%</span>
            </div>
            <div className="progress-bar-bg">
              <motion.div 
                className="progress-bar-fill" 
                initial={{ width: 0 }}
                animate={{ width: `${completionRate}%` }}
                transition={{ duration: 0.8, ease: "circOut" }}
              />
            </div>
          </div>

          <div className="telemetry-badges">
            <div className="badge"><Globe size={12} /> Edge Engine</div>
            <div className="badge"><Shield size={12} /> Encrypted</div>
            <div className="badge"><Zap size={12} /> Real-time</div>
          </div>
        </div>
      </div>

      <section className="workspace-section">
        <div className="section-header">
          <div>
            <h2>Operations</h2>
            <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Your current queue of voice-captured tasks.</p>
          </div>
          <div className="badge">
            {pendingCount} TASKS REMAINING
          </div>
        </div>

        <div className="task-list">
          <AnimatePresence mode="popLayout">
            {sortedTasks.map((task) => (
              <motion.div
                layout
                key={task.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className={`task-item ${task.status === 'completed' ? 'completed' : ''}`}
                onClick={() => toggleTask(task)}
              >
                <div className="task-checkbox-outer">
                  <div className="task-checkbox-inner">
                    <Check size={12} strokeWidth={3} />
                  </div>
                </div>
                <div className="task-content-wrap">
                  <div className="task-title">
                    {task.content}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {!loading && tasks.length === 0 && (
            <div style={{ padding: '6rem 2rem', textAlign: 'center', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)' }}>
              <p style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>Workspace is clear. Speak to add a task.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
