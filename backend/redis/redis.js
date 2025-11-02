
import { createClient } from 'redis';


const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const client = createClient({ url: REDIS_URL });



client.on('error', (err) => {
  console.error('Redis Client Error', err);
});

let connected = false;

async function connect() {
  if (connected) return client;
  await client.connect();
  connected = true;
  console.log('Connected to Redis:', REDIS_URL);
  return client;
}

async function disconnect() {
  if (!connected) return;
  await client.disconnect();
  
  connected = false;
}


export { connect, disconnect  , client};


