// Local MQTT-over-WebSocket broker for end-to-end tests (no internet needed).
// usage: node scripts/local-broker.mjs [port]
import { Aedes } from 'aedes';
import { createServer } from 'aedes-server-factory';

const port = Number(process.argv[2] || 8883);
const broker = await Aedes.createBroker();
const server = createServer(broker, { ws: true });
let msgs = 0;
broker.on('publish', (p, c) => {
  if (c) msgs++;
});
broker.on('client', (c) => console.log('client+', c.id));
broker.on('clientDisconnect', (c) => console.log('client-', c.id));
server.listen(port, () => console.log(`ws broker on ${port}`));
setInterval(() => console.log('msgs', msgs), 10000).unref();
