# ESF-551 Pico W Collector

This folder contains a minimal MicroPython client for the Etekcity ESF-551 scale.

What it does:

- scans for the scale over BLE
- connects as a BLE central
- subscribes to `fff1` notifications
- parses stable ESF-551 measurement packets
- prints weight and impedance over serial
- optionally POSTs the measurement to a webhook over Wi-Fi

## Files

- `main.py`: runtime entry point for the Pico W
- `esf551_protocol.py`: packet parsing and unit-update command builder
- `config.example.py`: copy to `config.py` and fill in your settings

## Setup

1. Flash a recent MicroPython build to the Pico W.
2. Copy `config.example.py` to `config.py`.
3. Update Wi-Fi settings in `config.py`.
4. Set `SCALE_ADDRESS` once you know the scale's BLE address.
5. Copy `main.py`, `esf551_protocol.py`, and `config.py` to the Pico W.
6. Reset the board and open the serial console.

## Address Discovery

If you leave `SCALE_ADDRESS = None`, the script falls back to name-prefix matching with `SCALE_NAME_PREFIX`.

For reliable operation, pin the exact BLE address after the first successful scan.

## Output

Successful measurements are printed as JSON, for example:

```json
{"device":"esf-551","scale_name":"Etekcity","scale_address":"AA:BB:CC:DD:EE:FF","timestamp_unix":1710000000,"timestamp_iso":"2024-03-09T16:00:00Z","weight_kg":82.65,"weight_lb":182.21,"display_unit":"lb","impedance":517}
```

## Webhook Mode

If you set `WEBHOOK_URL`, the Pico W will POST the same JSON payload after a stable reading.

This repo includes a matching Express endpoint at `POST /api/esf551` (`server/src/routes/esf551.js`).

Required server environment variables:

- `ESF551_WEBHOOK_TOKEN`
- `ESF551_USER_ID`

Optional server environment variable:

- `ESF551_WEIGHT_ACTIVITY_ID`
  default: the current weight activity id used by the frontend

The Pico should send:

```python
WEBHOOK_URL = "http://<server-lan-ip>:3002/api/esf551"
WEBHOOK_HEADERS = {
    "Authorization": "Bearer your-shared-webhook-token",
}
```

Use the server's LAN IP and the app's published port (3002 by default in
`docker-compose.yml`), not the `fitness.home` alias. That hostname is only
defined in per-machine `/etc/hosts` files (resolving to a Tailscale address),
which the Pico's plain-WiFi network stack can't resolve. Hitting the LAN IP on
port 80 instead of 3002 doesn't work either: nginx there routes by Host header
across several vhosts, and a raw IP request falls through to a different app's
`default_server` block. Hitting the app container's published port directly
sidesteps both problems.

Since the server's LAN IP is typically DHCP-assigned (not static), set a DHCP
reservation for it at your router — otherwise a lease renewal can silently
change the address and break the webhook.

The endpoint inserts the same log shape the frontend weight page currently writes:

```json
{
  "user_id": "...",
  "activity_id": "3bacbc7e-4e70-435a-8927-ccc7ff1568b7",
  "datetime": "...",
  "data": {
    "weight": 182.2
  }
}
```

## Current Scope

This implementation is intentionally narrow:

- it only handles ESF-551 stable measurement packets
- it does not yet do retries around characteristic discovery failures
- it only uses the unit write command if `PREFERRED_UNIT` is set

## Known Risk

The protocol logic is derived from the `etekcity-esf551-ble` Python library, but the BLE transport layer here is a fresh MicroPython implementation and still needs on-device validation.
