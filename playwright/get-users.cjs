/**
 * Get FoundryVTT user list via socket.io
 */
const io = require('socket.io-client');
const http = require('http');

async function getAdminSession() {
  return new Promise((resolve, reject) => {
    const postData = 'adminPassword=';
    const options = {
      hostname: 'localhost', port: 30000, path: '/auth', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) },
    };
    const req = http.request(options, (res) => {
      const setCookie = res.headers['set-cookie'];
      let sessionId = null;
      if (setCookie) {
        const match = setCookie.join(';').match(/session=([a-f0-9]+)/);
        if (match) sessionId = match[1];
      }
      res.resume();
      res.on('end', () => resolve(sessionId));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function getJoinData(sessionId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Socket timeout after 15s'));
    }, 15000);

    const socket = io('http://localhost:30000', {
      path: '/socket.io',
      query: { session: sessionId },
      transports: ['websocket', 'polling'],
      reconnection: false,
    });

    let sessionReceived = false;

    socket.on('session', (data) => {
      sessionReceived = true;
      console.log('Session data:', JSON.stringify(data));

      // Emit getJoinData after session is confirmed
      setTimeout(() => {
        socket.emit('getJoinData', (data) => {
          clearTimeout(timeout);
          socket.disconnect();
          resolve(data);
        });
      }, 200);
    });

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      // If session event doesn't come in 2s, try anyway
      setTimeout(() => {
        if (!sessionReceived) {
          socket.emit('getJoinData', (data) => {
            clearTimeout(timeout);
            socket.disconnect();
            resolve(data);
          });
        }
      }, 2000);
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timeout);
      socket.disconnect();
      reject(err);
    });
  });
}

(async () => {
  try {
    const sessionId = await getAdminSession();
    console.log('Session ID:', sessionId);

    const joinData = await getJoinData(sessionId);
    console.log('JoinData keys:', Object.keys(joinData || {}));
    const users = joinData?.users || [];
    console.log('Users:', JSON.stringify(users.map(u => ({ id: u._id, name: u.name, role: u.role })), null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
