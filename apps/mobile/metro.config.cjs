// Metro config. Expo's defaults handle the pnpm monorepo; we only replace Node-only modules.
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const NODE_ONLY = { ws: path.resolve(__dirname, 'shims/ws.js') };

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const shim = NODE_ONLY[moduleName];
  if (shim !== undefined) return { type: 'sourceFile', filePath: shim };
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
