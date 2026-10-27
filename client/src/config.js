// Dynamic API & WebSocket Base URL resolver for Desktop, Mobile Phone (LAN), and Live Web Tunnel (HTTPS/WSS)
export const getApiBase = () => {
  if (typeof window === 'undefined') return 'http://localhost:5000';
  const { protocol, hostname, port, origin } = window.location;
  // When running on Vite dev server port 5173 locally or over LAN IP
  if (port === '5173' && (hostname === 'localhost' || hostname === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname))) {
    return `${protocol}//${hostname}:5000`;
  }
  // When served from unified production server (port 5000) or public HTTPS web tunnel
  return origin;
};

export const getWsUrl = () => {
  if (typeof window === 'undefined') return 'ws://localhost:5000';
  const { protocol, hostname, port, host } = window.location;
  const wsProto = protocol === 'https:' ? 'wss:' : 'ws:';
  if (port === '5173' && (hostname === 'localhost' || hostname === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname))) {
    return `${wsProto}//${hostname}:5000`;
  }
  return `${wsProto}//${host}`;
};

export const apiUrl = (path) => `${getApiBase()}${path}`;
export const EXECUTIVE_USERS = [
  { id: 'Sarthak (Ops Manager)', name: 'Sarthak', role: 'Operations Manager (24/7 Lead)', icon: '👑' },
  { id: 'Vikas (Ops Manager)', name: 'Vikas', role: 'Operations Manager (24/7 Lead)', icon: '👑' },
  { id: 'Dhiren (Director)', name: 'Dhiren', role: 'Director / Leadership', icon: '💎' }
];
