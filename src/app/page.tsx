import React from 'react';

export default function BackendHome() {
  return (
    <div style={{ 
      fontFamily: 'system-ui, sans-serif', 
      lineHeight: '1.5', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh',
      backgroundColor: '#f8fafc',
      color: '#1e293b'
    }}>
      <div style={{
        padding: '2rem',
        backgroundColor: 'white',
        borderRadius: '1rem',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        textAlign: 'center'
      }}>
        <h1 style={{ color: '#6366f1', marginBottom: '0.5rem' }}>Rehearsal Hub Backend</h1>
        <p style={{ color: '#64748b' }}>Universal API & Logic Engine for LWSRH</p>
        <div style={{ 
          marginTop: '2rem', 
          padding: '1rem', 
          backgroundColor: '#f1f5f9', 
          borderRadius: '0.5rem',
          fontSize: '0.875rem'
        }}>
          Status: <span style={{ color: '#10b981', fontWeight: 'bold' }}>Active</span>
        </div>
      </div>
    </div>
  );
}
