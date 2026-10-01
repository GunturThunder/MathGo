// @colyseus/sdk imports Node's `ws` but only uses it when there is no global WebSocket.
// React Native always has one, so the app bundles this empty stand-in instead (metro.config.cjs).
export default undefined;
