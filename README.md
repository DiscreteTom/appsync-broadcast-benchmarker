# AppSync Broadcast Benchmarker

## Prerequisites

- NodeJS
- [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/)
- Create an AppSync API using the [realtime API demo](https://docs.aws.amazon.com/appsync/latest/devguide/aws-appsync-real-time-create-generic-api-serverless-websocket.html).

## Configuration

Via environment variables, see [`script.js`](./script.js) for more details.

## Run

```bash
k6 run script.js
```

## Tips

- Ensure the client (the machine running the script) is in the same region as the AppSync API, and has enough network bandwidth & CPU power to handle the load.
- [Tips about running large k6 tests in a single machine](https://grafana.com/docs/k6/latest/testing-guides/running-large-tests/).
  - If the single machine is not enough, try [distributed tests](https://grafana.com/docs/k6/latest/testing-guides/running-distributed-tests/).
- Checkout the default [AppSync quotas](https://docs.aws.amazon.com/general/latest/gr/appsync.html). Especially:
  - Rate of connections per API (default: 200 per second, resource level adjustable).
  - Rate of inbound messages per API (default: 10,000 per second, resource level adjustable).
  - Rate of outbound messages per API (default: 1,000,000 per second, resource level adjustable).
  - Subscription payload size (default: 240 kilobytes, not adjustable).

## Example

Setup the environment variables:

```bash
export HTTP_API_HOST=xxxxxxxxxxxxxxx.appsync-api.us-east-1.amazonaws.com
export REALTIME_API_HOST=xxxxxxxxxxxxxxx.appsync-realtime-api.us-east-1.amazonaws.com
export API_KEY=da2-xxxxxxxxxxxxxx

export PUBLISHER_COUNT=1000
export PUBLISHER_RPS=100
export SUBSCRIBER_COUNT=10000
```

Run the script on `m7i.8xlarge` EC2 instance (32 vCPUs, 128 GB RAM):

```txt
[ec2-user@ip-172-31-25-174 ~]$ k6 run script.js

          /\      |‾‾| /‾‾/   /‾‾/
     /\  /  \     |  |/  /   /  /
    /  \/    \    |     (   /   ‾‾\
   /          \   |  |\  \ |  (‾)  |
  / __________ \  |__| \__\ \_____/ .io

     execution: local
        script: script.js
        output: -

     scenarios: (100.00%) 2 scenarios, 11000 max VUs, 1m0s max duration (incl. graceful stop):
              * appsync-listener: Up to 10000 looping VUs for 35s over 2 stages (gracefulRampDown: 3s, exec: listener, gracefulStop: 3s)
              * appsync-broadcast: 100.00 iterations/s for 25s (maxVUs: 1000, exec: broadcast, startTime: 5s, gracefulStop: 30s)


     ✓ status is 101

     █ teardown

       ✓ channel responses match

     appsync_broadcast_rtt_ms..........: avg=61.62ms  min=37ms     med=60ms    max=283ms    p(90)=74ms     p(95)=83ms
     appsync_channel_0_response_rate...: 100.00% ✓ 228718       ✗ 0
     appsync_channel_1_response_rate...: 100.00% ✓ 246928       ✗ 0
     appsync_channel_2_response_rate...: 100.00% ✓ 262885       ✗ 0
     appsync_channel_3_response_rate...: 100.00% ✓ 231835       ✗ 0
     appsync_channel_4_response_rate...: 100.00% ✓ 265131       ✗ 0
     appsync_channel_5_response_rate...: 100.00% ✓ 244032       ✗ 0
     appsync_channel_6_response_rate...: 100.00% ✓ 248145       ✗ 0
     appsync_channel_7_response_rate...: 100.00% ✓ 267104       ✗ 0
     appsync_channel_8_response_rate...: 100.00% ✓ 263939       ✗ 0
     appsync_channel_9_response_rate...: 100.00% ✓ 240480       ✗ 0
     checks............................: 100.00% ✓ 10           ✗ 0
     data_received.....................: 411 MB  11 MB/s
     data_sent.........................: 19 MB   495 kB/s
     http_req_blocked..................: avg=2.14ms   min=232ns    med=381ns   max=139.74ms p(90)=4.83ms   p(95)=5.1ms
     http_req_connecting...............: avg=304.71µs min=0s       med=0s      max=36.06ms  p(90)=658.23µs p(95)=737.67µs
     http_req_duration.................: avg=19.69ms  min=9.83ms   med=21.09ms max=136.58ms p(90)=25.15ms  p(95)=27.85ms
       { expected_response:true }......: avg=19.69ms  min=9.83ms   med=21.09ms max=136.58ms p(90)=25.15ms  p(95)=27.85ms
     http_req_failed...................: 0.00%   ✓ 0            ✗ 2500
     http_req_receiving................: avg=225.98µs min=15.16µs  med=76.86µs max=27.56ms  p(90)=202.64µs p(95)=290.48µs
     http_req_sending..................: avg=53.03µs  min=21.69µs  med=43.19µs max=1.83ms   p(90)=68.84µs  p(95)=85.05µs
     http_req_tls_handshaking..........: avg=1.8ms    min=0s       med=0s      max=138.8ms  p(90)=4.09ms   p(95)=4.34ms
     http_req_waiting..................: avg=19.41ms  min=9.71ms   med=20.9ms  max=136.31ms p(90)=24.83ms  p(95)=27.16ms
     http_reqs.........................: 2500    65.73334/s
     iteration_duration................: avg=22.11ms  min=385.61µs med=21.85ms max=216.41ms p(90)=29.04ms  p(95)=32.58ms
     iterations........................: 2500    65.73334/s
     vus...............................: 10000   min=1049       max=10003
     vus_max...........................: 11000   min=11000      max=11000
     ws_connecting.....................: avg=11.12ms  min=5.97ms   med=8.56ms  max=150.27ms p(90)=12.29ms  p(95)=17.52ms
     ws_msgs_received..................: 2529197 66501.026185/s
     ws_msgs_sent......................: 20000   525.866717/s
     ws_sessions.......................: 10000   262.933359/s


running (0m38.0s), 00000/11000 VUs, 2500 complete and 10000 interrupted iterations
appsync-listener  ✓ [======================================] 10000/10000 VUs  35s
appsync-broadcast ✓ [======================================] 0000/1000 VUs    25s  100.00 iters/s
```
