import http from "k6/http";
import { check } from "k6";
import encoding from "k6/encoding";
import ws from "k6/ws";
import { Rate, Trend } from "k6/metrics";

const HTTP_API_HOST = __ENV.HTTP_API_HOST; // e.g. xxxxxxxxxx.appsync-api.us-east-1.amazonaws.com
const REALTIME_API_HOST = __ENV.REALTIME_API_HOST; // e.g. xxxxxxxxxx.appsync-realtime-api.us-east-1.amazonaws.com
const API_KEY = __ENV.API_KEY; // e.g. da2-xxx

const authorization = {
  host: HTTP_API_HOST,
  "x-api-key": API_KEY,
};

const REALTIME_ENDPOINT = `wss://${REALTIME_API_HOST}:443/graphql?header=${encoding.b64encode(
  JSON.stringify(authorization)
)}&payload=e30=`;
const HTTP_ENDPOINT = `https://${HTTP_API_HOST}/graphql`;

export const ResponseSuccessRate = new Rate("ResponseSuccessRate");
let ws_resp_delay = new Trend("ws_resp_delay_ms");

export const options = {
  scenarios: {
    "appsync-listener": {
      executor: "ramping-vus",
      exec: "listener",
      startVUs: 0,
      stages: [
        { duration: "5s", target: 1 },
        { duration: "5s", target: 1 },
        { duration: "1s", target: 0 },
      ],
      gracefulRampDown: "3s",
      gracefulStop: "3s",
    },
    "appsync-broadcast": {
      executor: "per-vu-iterations",
      exec: "broadcast",
      vus: 1,
      iterations: 1,
      startTime: "10s",
      maxDuration: "30s",
    },
  },
  thresholds: {
    ResponseSuccessRate: [
      "rate>0.90", // should be great than 90%
      { threshold: "rate>0.85", abortOnFail: true }, // stop early if less than 85%
    ],
  },
};

export function listener() {
  const url = REALTIME_ENDPOINT;
  const params = {
    headers: { "Sec-WebSocket-Protocol": "graphql-ws" },
  };

  const response = ws.connect(url, params, (socket) => {
    socket.on("open", () => {
      // console.log("connected");
      socket.send(JSON.stringify({ type: "connection_init" }));
    });

    socket.on("message", (msg) => {
      const e = JSON.parse(msg);
      if (e.type === "connection_ack") {
        socket.current.send(
          JSON.stringify({
            type: "start",
            id: `${Date.now()}`,
            payload: {
              data: JSON.stringify({
                query:
                  "subscription SubscribeToData($name: String!) { subscribe(name: $name) { name data } }",
                variables: {
                  name: "TODO", // TODO: channel name
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
        // TODO: calculate duration
        console.log(e.payload.data);
        ResponseSuccessRate.add(1);
        // ws_resp_delay.add(duration);
      }
    });

    socket.on("close", () => console.log("disconnected"));
    socket.on("error", on_error);
  });

  check(response, { "status is 101": (r) => r && r.status === 101 });
}

export function broadcast() {
  let res = http.post(
    HTTP_ENDPOINT,
    JSON.stringify({
      query:
        "mutation PublishData($name: String!, $data: AWSJSON!) { publish(name: $name, data: $data) { name data } }",
      variables: {
        name: "TODO", // TODO: channel name
        data: `${Date.now()}`,
      },
    }),
    {
      headers: {
        "x-api-key": authorization["x-api-key"],
      },
    }
  );
  //  console.log('broadcast resp: ' + res.body);
}
