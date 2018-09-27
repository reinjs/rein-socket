const fs = require('fs');
const path = require('path');
const Socket = require('socket.io');
module.exports = async app => {
  app.loader.addCompiler('socket', dirs => {
    const result = {};
    dirs.forEach(dir => {
      const dic = path.resolve(dir.pathname, 'app/io');
      readDir(dic, dic, result);
    });
    app.__sockets__ = result;
  });
  app.starting(async server => {
    app.io = Socket(server);
    app.context.io = app.io;
    if (app.__sockets__) {
      for (const res in app.__sockets__) {
        let result = app.__sockets__[res];
        if (typeof result === 'function') {
          result = await result(app);
        }
        if (result && typeof result === 'object') {
          const room = app.io.of(res);
          for (const i in result) {
            if (typeof result[i] === 'function') {
              room.on(i, result[i]);
            }
          }
        }
      }
    }
  });
};

function readDir(base, dir, result) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(file => {
    const realPath = path.resolve(dir, file);
    const target = fs.statSync(realPath);
    if (target.isFile()) {
      if (/.js$/.test(file)) {
        const relative = '/' + path.relative(base, realPath);
        const moduleExports = require(realPath);
        const dirname = path.dirname(relative);
        const basename = path.basename(relative, '.js');
        const name = dirname === '/' ? dirname + basename : dirname + '/' + basename;
        result[name] = moduleExports;
      }
    } else {
      readDir(base, realPath, result);
    }
  })
}