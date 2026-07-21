WIFI_SSID = "your-wifi-name"
WIFI_PASSWORD = "your-wifi-password"
NTP_SYNC = True

# Recommended: pin to the scale's BLE address once you know it.
# Leave as None to match by name prefix instead.
SCALE_ADDRESS = None

# Used when SCALE_ADDRESS is None.
SCALE_NAME_PREFIX = "Etekcity"

# Optional: force the scale display unit on connect.
# Valid values: None, "kg", "lb", "st"
PREFERRED_UNIT = None

# Optional webhook for forwarding measurements.
# Leave WEBHOOK_URL = None to only print measurements over serial.
# Use the server's LAN IP and published app port (see README's Webhook Mode
# section for why fitness.home / port 80 don't work from the Pico).
WEBHOOK_URL = "http://192.168.1.100:3002/api/esf551"
WEBHOOK_HEADERS = {
    "Authorization": "Bearer your-shared-webhook-token",
}

# Debounce window to avoid logging the same weigh-in multiple times.
MEASUREMENT_COOLDOWN_MS = 60000

# How long to scan before restarting the scan cycle.
SCAN_DURATION_MS = 15000
