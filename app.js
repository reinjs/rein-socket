const http = require('http');
const Socket = require('socket.io');
const { EventEmitter } = require('events');
let id = 0;

module.exports = async app => {
  Object.defineProperty(app.context, 'routerPath', {
    get() {
      return this.req.socketPath;
    }
  });
  Object.defineProperty(app.context, 'socket', {
    get() {
      return this.req.socket || new EventEmitter();
    }
  });
  app.starting(async server => {
    app.io = Socket(server);
    app.context.io = app.io;
    const callback = app.callback();
    
    for (let i = 0; i < app.router.sockets.length; i++) {
      const roomName = app.router.sockets[i];
      const room = app.io.of(roomName);
      
      room.on('connection', socket => {
        const request = socket.request;
        const response = new http.ServerResponse(request);
        
        request.socket = socket;
        request.method = 'SOCKET';
        request.socketPath = roomName;
        
        callback(request, response).then(response => {
          const ctx = response.socketContext;
          const target = response.socketResult;
          ctx.id = id++;
          
          socket.on('commander', data => {
            if (!data) return;
            ctx.socketBody = data.body;
            if (data.event && typeof target[data.event] === 'function') {
              target[data.event].call(target, ctx).catch(e => app.logger.error(`[${data.event}]`, e.message));
            }
          });
          
          socket.on('disconnect', () => {
            if (typeof target.disconnect === 'function') {
              target.disconnect.call(target, ctx).catch(e => app.logger.error('[disconnect error]', e.message));
            }
          });
          
          if (typeof target.connect === 'function') {
            target.connect.call(target, ctx)
            .then(() => socket.emit('commander_connect_success', { timestamp: Date.now() }))
            .catch(e => socket.emit('commander_connect_error', { message: e.message }));
          } else {
            socket.emit('commander_connect_success', { timestamp: Date.now() });
          }
        }).catch(e => socket.emit('commander_connect_error', { message: e.message }));
      });
    }
  });
};