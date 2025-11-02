
// import { createClient } from 'redis';
import {Redis} from "ioredis"

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const client = new Redis(process.env.REDIS_URL + "?family=0")


client.on('error', (err) => {
  console.error('Redis Client Error', err);
});
client.on('connect', (err) => {
  console.log('Redis Conencted');
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


export { connect , disconnect  , client};


