'use client';

import { useState } from 'react';

export default function StreamTest() {
  const [hash, setHash] = useState('61d0ec5059e0c05d3957869dcb530b5f035735e9');
  const [status, setStatus] = useState('idle');
  const [info, setInfo] = useState('');

  const testStream = async () => {
    setStatus('loading');
    setInfo('Testando conexão...');
    
    try {
      // Test health
      const healthRes = await fetch('http://147.15.92.17/health');
      const healthData = await healthRes.json();
      setInfo(prev => prev + '\n✓ Servidor OK: ' + JSON.stringify(healthData));
      
      // Test status
      const statusRes = await fetch(`http://147.15.92.17/status/${hash}`);
      const statusData = await statusRes.json();
      setInfo(prev => prev + '\n✓ Status do torrent: ' + JSON.stringify(statusData));
      
      // Test stream
      setInfo(prev => prev + '\n📡 Iniciando stream...');
      const streamRes = await fetch(`http://147.15.92.17/stream/${hash}`);
      
      if (streamRes.ok) {
        setInfo(prev => prev + '\n✓ Stream conectado! Content-Type: ' + streamRes.headers.get('content-type'));
        setStatus('success');
      } else {
        setInfo(prev => prev + `\n✗ Erro no stream: ${streamRes.status} ${streamRes.statusText}`);
        setStatus('error');
      }
    } catch (err) {
      setInfo(prev => prev + '\n✗ Erro: ' + err.message);
      setStatus('error');
    }
  };

  return (
    <div style={{ padding: '40px', backgroundColor: '#000', color: '#fff', minHeight: '100vh' }}>
      <h1>🧪 Teste de Streaming</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <label>Hash do Torrent (40 caracteres):</label><br />
        <input
          type="text"
          value={hash}
          onChange={(e) => setHash(e.target.value)}
          style={{ width: '100%', padding: '10px', marginTop: '10px', backgroundColor: '#222', color: '#fff', border: '1px solid #555' }}
        />
      </div>

      <button
        onClick={testStream}
        disabled={status === 'loading'}
        style={{
          padding: '10px 20px',
          backgroundColor: '#e50914',
          color: '#fff',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          fontSize: '16px'
        }}
      >
        {status === 'loading' ? 'Testando...' : 'Testar Streaming'}
      </button>

      <pre style={{
        marginTop: '20px',
        backgroundColor: '#111',
        padding: '15px',
        borderRadius: '5px',
        border: '1px solid #555',
        overflow: 'auto',
        minHeight: '200px',
        color: status === 'success' ? '#4ade80' : status === 'error' ? '#ef4444' : '#888'
      }}>
        {info || 'Clique em "Testar Streaming" para começar...'}
      </pre>

      <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
        <p>
          <strong>URLs testadas:</strong><br/>
          • http://147.15.92.17/health<br/>
          • http://147.15.92.17/status/[hash]<br/>
          • http://147.15.92.17/stream/[hash]
        </p>
      </div>
    </div>
  );
}
