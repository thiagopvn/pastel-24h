import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';

const shiftConnections = new Map<number, Set<WebSocket>>();

export function initWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws-api' // Use um path específico para evitar conflito com Vite
  });

  wss.on('connection', (ws, req) => {
    console.log('WebSocket connection established on /ws-api');
    
    const url = new URL(req.url!, 'http://localhost');
    const shiftIdParam = url.searchParams.get('shiftId');
    
    if (!shiftIdParam) {
      ws.close(1008, 'Missing shiftId parameter');
      return;
    }

    const shiftId = Number(shiftIdParam);
    
    if (isNaN(shiftId)) {
      ws.close(1008, 'Invalid shiftId parameter');
      return;
    }

    console.log(`Client connected to shift ${shiftId}`);

    if (!shiftConnections.has(shiftId)) {
      shiftConnections.set(shiftId, new Set());
    }
    
    shiftConnections.get(shiftId)!.add(ws);

    ws.on('close', () => {
      console.log(`Client disconnected from shift ${shiftId}`);
      shiftConnections.get(shiftId)?.delete(ws);
      
      if (shiftConnections.get(shiftId)?.size === 0) {
        shiftConnections.delete(shiftId);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      shiftConnections.get(shiftId)?.delete(ws);
    });

    ws.send(JSON.stringify({ type: 'CONNECTION_ESTABLISHED', shiftId }));
  });

  return wss;
}

export function notifyShiftClients(shiftId: number, payload: any) {
  const clients = shiftConnections.get(shiftId);
  
  if (!clients || clients.size === 0) {
    console.log(`No clients connected to shift ${shiftId}`);
    return;
  }

  const message = JSON.stringify({ 
    type: 'SHIFT_DATA_UPDATED', 
    payload,
    timestamp: Date.now()
  });

  console.log(`Notifying ${clients.size} clients for shift ${shiftId}`);

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (error) {
        console.error('Error sending message to client:', error);
        clients.delete(client);
      }
    } else {
      clients.delete(client);
    }
  });
}

export function getActiveConnections() {
  const stats = new Map<number, number>();
  shiftConnections.forEach((clients, shiftId) => {
    stats.set(shiftId, clients.size);
  });
  return stats;
}