import http from "k6/http";
import { check } from "k6";
import encoding from "k6/encoding";
import ws from "k6/ws";
import { Trend } from "k6/metrics";

// environment variables
const HTTP_API_HOST = assertNonEmptyString(__ENV.HTTP_API_HOST); // e.g. xxxxxxxxxx.appsync-api.us-east-1.amazonaws.com
const REALTIME_API_HOST = assertNonEmptyString(__ENV.REALTIME_API_HOST); // e.g. xxxxxxxxxx.appsync-realtime-api.us-east-1.amazonaws.com
const API_KEY = assertNonEmptyString(__ENV.API_KEY); // e.g. da2-xxx
const CHANNEL_COUNT = Number(__ENV.CHANNEL_COUNT || 1);
const CHANNEL_PREFIX = __ENV.CHANNEL_PREFIX || "channel-";
const SUBSCRIBER_COUNT = Number(__ENV.SUBSCRIBER_COUNT || 100);
const SUBSCRIBER_RAMP_UP_TIME = __ENV.SUBSCRIBER_RAMP_UP_TIME || "5s";
const SUBSCRIBER_DURATION = __ENV.SUBSCRIBER_DURATION || "30s";
const PUBLISHER_COUNT = Number(__ENV.PUBLISHER_COUNT || 100);
const PUBLISHER_RPS = Number(__ENV.PUBLISHER_RPS || 10);
const PUBLISHER_DURATION = __ENV.PUBLISHER_DURATION || "20s"; // should be smaller than SUBSCRIBER_DURATION

// construct endpoints
const authorization = {
  host: HTTP_API_HOST,
  "x-api-key": API_KEY,
};
const REALTIME_ENDPOINT = `wss://${REALTIME_API_HOST}:443/graphql?header=${encoding.b64encode(
  JSON.stringify(authorization)
)}&payload=e30=`;
const HTTP_ENDPOINT = `https://${HTTP_API_HOST}/graphql`;

// metrics
const channels = new Array(CHANNEL_COUNT).fill(0).map((_, i) => ({
  name: `${CHANNEL_PREFIX}${i}`,
  listenerCount: 0,
  expectCount: 0,
  responseCount: 0,
}));
const appsyncBroadcastRttMs = new Trend("appsync_broadcast_rtt_ms", true);

export function teardown() {
  // compare the number of expected responses to the actual number of responses
  channels.forEach((channel) => {
    const expected = channel.expectCount;
    const actual = channel.responseCount;
    check(actual, {
      [`channel ${channel.name} responses match`]: (v) => v === expected,
    });
  });
}

export const options = {
  scenarios: {
    "appsync-listener": {
      executor: "ramping-vus",
      exec: "listener",
      startVUs: 0,
      stages: [
        { duration: SUBSCRIBER_RAMP_UP_TIME, target: SUBSCRIBER_COUNT }, // wait for all websocket listeners to connect
        { duration: SUBSCRIBER_DURATION, target: SUBSCRIBER_COUNT }, // wait for messages
        { duration: "1s", target: 0 }, // ramp down
      ],
      gracefulRampDown: "3s",
      gracefulStop: "3s",
    },
    "appsync-broadcast": {
      executor: "constant-arrival-rate",
      exec: "broadcast",
      duration: PUBLISHER_DURATION,
      rate: PUBLISHER_RPS,
      preAllocatedVUs: PUBLISHER_COUNT,
      startTime: SUBSCRIBER_RAMP_UP_TIME,
    },
  },
};

// appsync websocket listener
export function listener() {
  // we are going to listen to a random channel
  const channelIndex = Math.floor(Math.random() * channels.length);
  const channel = channels[channelIndex];

  const response = ws.connect(
    REALTIME_ENDPOINT,
    {
      headers: { "Sec-WebSocket-Protocol": "graphql-ws" },
    },
    (socket) => {
      socket.on("open", () => {
        // console.log("connected");
        socket.send(JSON.stringify({ type: "connection_init" }));
        channel.listenerCount++;
      });

      socket.on("message", (msg) => {
        const e = JSON.parse(msg);
        if (e.type === "connection_ack") {
          // send subscription request
          socket.send(
            JSON.stringify({
              type: "start",
              id: `${Date.now()}`,
              payload: {
                data: JSON.stringify({
                  query:
                    "subscription SubscribeToData($name: String!) { subscribe(name: $name) { name data } }",
                  variables: {
                    name: channel.name,
                  },
                }),
                extensions: {
                  authorization,
                },
              },
            })
          );
        }
        if (e.type === "data") {
          appsyncBroadcastRttMs.add(
            Date.now() - Number(e.payload.data.subscribe.data)
          );
          channel.responseCount++;
        }
      });

      socket.on("close", () => console.log("disconnected"));
      socket.on("error", onError);
    }
  );

  check(response, { "status is 101": (r) => r && r.status === 101 });
}

// appsync http sender
export function broadcast() {
  // we are going to publish to a random channel
  const channelIndex = Math.floor(Math.random() * channels.length);
  const channel = channels[channelIndex];

  const res = http.post(
    HTTP_ENDPOINT,
    JSON.stringify({
      query:
        "mutation PublishData($name: String!, $data: AWSJSON!) { publish(name: $name, data: $data) { name data } }",
      variables: {
        // publish to a random channel
        name: channel.name,
        data: `${Date.now()}`,
      },
    }),
    {
      headers: {
        "x-api-key": authorization["x-api-key"],
      },
    }
  );

  channel.expectCount += channel.listenerCount;

  //  console.log('broadcast resp: ' + res.body);
}

function onError(e) {
  if (e.error() != "websocket: close sent") {
    console.log("An unexpected error occurred: ", e.error());
  }
}

function assertNonEmptyString(value) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid value: ${value}`);
  }
  return value;
}
