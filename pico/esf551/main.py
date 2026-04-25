import bluetooth
import json
import machine
import network
import time
from micropython import const

import config
from esf551_protocol import (
    CONTROL_UUID,
    DISPLAY_UNIT_NAMES,
    WEIGHT_NOTIFY_UUID,
    build_unit_update_command,
    normalize_unit,
    parse_measurement,
)

try:
    import urequests
except ImportError:
    urequests = None

try:
    import ntptime
except ImportError:
    ntptime = None


_IRQ_SCAN_RESULT = const(5)
_IRQ_SCAN_DONE = const(6)
_IRQ_PERIPHERAL_CONNECT = const(7)
_IRQ_PERIPHERAL_DISCONNECT = const(8)
_IRQ_GATTC_SERVICE_RESULT = const(9)
_IRQ_GATTC_SERVICE_DONE = const(10)
_IRQ_GATTC_CHARACTERISTIC_RESULT = const(11)
_IRQ_GATTC_CHARACTERISTIC_DONE = const(12)
_IRQ_GATTC_WRITE_DONE = const(17)
_IRQ_GATTC_NOTIFY = const(18)

_ADV_TYPE_NAME = const(0x09)
_ADV_TYPE_SHORT_NAME = const(0x08)
_TARGET_SERVICE_BLE_UUID = bluetooth.UUID(0xFFF0)
_WEIGHT_NOTIFY_BLE_UUID = bluetooth.UUID(0xFFF1)
_CONTROL_BLE_UUID = bluetooth.UUID(0xFFF2)
_LED_OFF = const(0)
_LED_WIFI = const(1)
_LED_ACTIVE = const(2)
_BLE_SESSION_TIMEOUT_MS = const(12000)
_POST_MEASUREMENT_COOLDOWN_MS = const(15000)
_BUTTON_PIN = const(15)
_ARM_WINDOW_MS = const(30000)


def format_addr(addr):
    return ":".join("{:02X}".format(b) for b in addr)


def format_addr_reversed(addr):
    raw = bytes(addr)
    return ":".join("{:02X}".format(raw[i]) for i in range(len(raw) - 1, -1, -1))


def decode_name(adv_data):
    index = 0
    length = len(adv_data)
    while index + 1 < length:
        field_len = adv_data[index]
        if field_len == 0:
            break

        field_type_index = index + 1
        field_value_index = index + 2
        field_end = index + field_len + 1

        if field_end > length:
            break

        field_type = adv_data[field_type_index]
        if field_type in (_ADV_TYPE_NAME, _ADV_TYPE_SHORT_NAME):
            try:
                return adv_data[field_value_index:field_end].decode()
            except Exception:
                return None

        index = field_end

    return None


class ESF551Collector:
    def __init__(self):
        self.ble = bluetooth.BLE()
        self.ble.active(True)
        self.ble.irq(self._irq)
        self.led = machine.Pin("LED", machine.Pin.OUT)
        self.button = machine.Pin(_BUTTON_PIN, machine.Pin.IN, machine.Pin.PULL_UP)
        self.wlan = network.WLAN(network.STA_IF)
        self.wlan.active(True)

        self.target_address = (
            config.SCALE_ADDRESS.upper() if config.SCALE_ADDRESS else None
        )
        self.target_name_prefix = config.SCALE_NAME_PREFIX
        self.preferred_unit = normalize_unit(config.PREFERRED_UNIT)

        self.scanning = False
        self.connecting = False
        self.connected = False
        self.conn_handle = None
        self.notify_value_handle = None
        self.control_value_handle = None
        self.target_service_range = None
        self.pending_measurement = None
        self.last_measurement_signature = None
        self.last_measurement_ms = 0
        self.scale_address = None
        self.scale_name = None
        self.wifi_connected = False
        self.last_wifi_attempt_ms = -60000
        self.led_mode = _LED_OFF
        self.led_value = 0
        self.last_led_toggle_ms = 0
        self.ble_session_started_ms = None
        self.cooldown_until_ms = None
        self.arm_until_ms = None
        self.button_last_value = 1
        self.posting = False

    def start(self):
        self._ensure_wifi(force=True)
        self._update_led()

    def loop_forever(self):
        while True:
            self._ensure_wifi()
            self._clear_cooldown_if_needed()
            self._handle_button()
            self._clear_arm_if_needed()

            if (
                self.wifi_connected
                and self._is_armed()
                and not self._in_cooldown()
                and not self.scanning
                and not self.connected
                and not self.connecting
            ):
                self._start_scan()

            self._enforce_ble_timeout()

            if self.pending_measurement:
                self._handle_measurement(self.pending_measurement)
                self.pending_measurement = None

            self._update_led()
            time.sleep_ms(100)

    def _ensure_wifi(self, force=False):
        if not config.WIFI_SSID:
            return

        if self.wlan.isconnected():
            if not self.wifi_connected:
                print("Wi-Fi connected")
            self.wifi_connected = True
            return

        now = time.ticks_ms()
        if not force and time.ticks_diff(now, self.last_wifi_attempt_ms) < 10000:
            return

        self.last_wifi_attempt_ms = now
        self.wifi_connected = False
        self.wlan.disconnect()
        self.wlan.connect(config.WIFI_SSID, config.WIFI_PASSWORD)
        self._set_led_mode(_LED_WIFI)

        for _ in range(30):
            if self.wlan.isconnected():
                print("Wi-Fi connected")
                self.wifi_connected = True
                self._sync_time()
                return
            self._update_led()
            time.sleep_ms(500)

        print("Wi-Fi connection timed out; retrying")

    def _sync_time(self):
        if not getattr(config, "NTP_SYNC", True):
            return

        if ntptime is None:
            print("ntptime not available; skipping clock sync")
            return

        try:
            ntptime.settime()
        except Exception as exc:
            print("NTP sync failed:", exc)

    def _start_scan(self):
        print("Armed for weigh-in")
        self.scanning = True
        self.ble.gap_scan(config.SCAN_DURATION_MS, 30000, 30000)

    def _stop_scan(self):
        if self.scanning:
            self.ble.gap_scan(None)
            self.scanning = False

    def _matches_target(self, addr, name):
        candidates = {format_addr(addr), format_addr_reversed(addr)}

        if self.target_address:
            return self.target_address in candidates

        if not name:
            return False

        if self.target_name_prefix:
            return self.target_name_prefix.lower() in name.lower()

        return True

    def _irq(self, event, data):
        if event == _IRQ_SCAN_RESULT:
            addr_type, addr, adv_type, rssi, adv_data = data
            name = decode_name(adv_data)
            addr_normal = format_addr_reversed(addr)
            if not self._matches_target(addr, name):
                return

            self.scale_address = addr_normal
            self.scale_name = name or "Unknown"
            self._set_led_mode(_LED_ACTIVE)
            self.ble_session_started_ms = time.ticks_ms()
            self._stop_scan()
            self.connecting = True
            self.ble.gap_connect(addr_type, addr)

        elif event == _IRQ_SCAN_DONE:
            self.scanning = False

        elif event == _IRQ_PERIPHERAL_CONNECT:
            conn_handle, addr_type, addr = data
            self.conn_handle = conn_handle
            self.connecting = False
            self.connected = True
            self.ble_session_started_ms = time.ticks_ms()
            self.notify_value_handle = None
            self.control_value_handle = None
            self.target_service_range = None
            self.ble.gattc_discover_services(conn_handle)

        elif event == _IRQ_GATTC_SERVICE_RESULT:
            conn_handle, start_handle, end_handle, uuid = data
            if uuid == _TARGET_SERVICE_BLE_UUID:
                self.target_service_range = (start_handle, end_handle)

        elif event == _IRQ_GATTC_SERVICE_DONE:
            if self.target_service_range is None:
                print("Target service not found; disconnecting")
                self._disconnect()
                return

            start_handle, end_handle = self.target_service_range
            self.ble.gattc_discover_characteristics(
                self.conn_handle, start_handle, end_handle
            )

        elif event == _IRQ_GATTC_CHARACTERISTIC_RESULT:
            conn_handle, def_handle, value_handle, properties, uuid = data
            if uuid == _WEIGHT_NOTIFY_BLE_UUID:
                self.notify_value_handle = value_handle
            elif uuid == _CONTROL_BLE_UUID:
                self.control_value_handle = value_handle

        elif event == _IRQ_GATTC_CHARACTERISTIC_DONE:
            if self.notify_value_handle is None:
                print("Measurement characteristic not found; disconnecting")
                self._disconnect()
                return

            if self.preferred_unit is not None and self.control_value_handle is not None:
                payload = build_unit_update_command(self.preferred_unit)
                self.ble.gattc_write(
                    self.conn_handle,
                    self.control_value_handle,
                    payload,
                    1,
                )

            cccd_handle = self.notify_value_handle + 1
            self.ble.gattc_write(self.conn_handle, cccd_handle, b"\x01\x00", 1)

        elif event == _IRQ_GATTC_WRITE_DONE:
            conn_handle, value_handle, status = data
            if status != 0:
                print("Write failed on handle", value_handle, "status", status)

        elif event == _IRQ_GATTC_NOTIFY:
            conn_handle, value_handle, notify_data = data
            self._set_led_mode(_LED_ACTIVE)
            if value_handle != self.notify_value_handle:
                return

            parsed = parse_measurement(notify_data)
            if not parsed:
                return

            now = time.ticks_ms()
            signature = (
                parsed["weight_kg"],
                parsed.get("impedance"),
                parsed["display_unit"],
            )
            if (
                self.last_measurement_signature == signature
                and time.ticks_diff(now, self.last_measurement_ms)
                < config.MEASUREMENT_COOLDOWN_MS
            ):
                return

            self.last_measurement_signature = signature
            self.last_measurement_ms = now
            self.pending_measurement = parsed

        elif event == _IRQ_PERIPHERAL_DISCONNECT:
            conn_handle, addr_type, addr = data
            self.connected = False
            self.connecting = False
            self.conn_handle = None
            self.notify_value_handle = None
            self.control_value_handle = None
            self.target_service_range = None
            self.ble_session_started_ms = None
            self._set_led_mode(_LED_OFF)

    def _disconnect(self):
        if self.conn_handle is not None:
            try:
                self.ble.gap_disconnect(self.conn_handle)
            except OSError:
                pass
        else:
            self.connected = False
            self.connecting = False
            self.ble_session_started_ms = None

    def _handle_measurement(self, measurement):
        weight_kg = measurement["weight_kg"]
        weight_lb = round(weight_kg * 2.20462, 2)
        timestamp_unix = int(time.time())
        payload = {
            "device": "esf-551",
            "scale_name": self.scale_name,
            "scale_address": self.scale_address,
            "timestamp_unix": timestamp_unix,
            "weight_kg": weight_kg,
            "weight_lb": weight_lb,
            "display_unit": DISPLAY_UNIT_NAMES.get(
                measurement["display_unit"], str(measurement["display_unit"])
            ),
        }

        if timestamp_unix > 1700000000:
            ts = time.gmtime(timestamp_unix)
            payload["timestamp_iso"] = "%04d-%02d-%02dT%02d:%02d:%02dZ" % (
                ts[0],
                ts[1],
                ts[2],
                ts[3],
                ts[4],
                ts[5],
            )

        if "impedance" in measurement:
            payload["impedance"] = measurement["impedance"]

        print("Measurement:", json.dumps(payload))
        self._post_webhook(payload)
        self.cooldown_until_ms = time.ticks_add(
            time.ticks_ms(), _POST_MEASUREMENT_COOLDOWN_MS
        )
        self.arm_until_ms = None
        self._disconnect()

    def _post_webhook(self, payload):
        if not config.WEBHOOK_URL:
            return

        if urequests is None:
            print("urequests not available; skipping webhook upload")
            return

        if not self.wlan.isconnected():
            self.wifi_connected = False
            print("Wi-Fi not connected; skipping webhook upload")
            return

        response = None
        self.posting = True
        try:
            headers = {"Content-Type": "application/json"}
            headers.update(config.WEBHOOK_HEADERS)
            self._blink_blocking(2, 100)
            response = urequests.post(
                config.WEBHOOK_URL,
                data=json.dumps(payload),
                headers=headers,
            )
            if response.status_code != 200:
                print("Webhook response:", response.status_code)
        except Exception as exc:
            print("Webhook upload failed:", exc)
        finally:
            self.posting = False
            if response is not None:
                response.close()

    def _enforce_ble_timeout(self):
        if self.ble_session_started_ms is None:
            return

        if not self.connecting and not self.connected:
            self.ble_session_started_ms = None
            return

        if (
            time.ticks_diff(time.ticks_ms(), self.ble_session_started_ms)
            >= _BLE_SESSION_TIMEOUT_MS
        ):
            print("BLE session timed out; resetting")
            self._disconnect()

    def _in_cooldown(self):
        if self.cooldown_until_ms is None:
            return False
        return time.ticks_diff(self.cooldown_until_ms, time.ticks_ms()) > 0

    def _clear_cooldown_if_needed(self):
        if self.cooldown_until_ms is None:
            return
        if not self._in_cooldown():
            self.cooldown_until_ms = None

    def _is_armed(self):
        if self.arm_until_ms is None:
            return False
        return time.ticks_diff(self.arm_until_ms, time.ticks_ms()) > 0

    def _clear_arm_if_needed(self):
        if self.arm_until_ms is None:
            return
        if not self._is_armed():
            self.arm_until_ms = None
            if self.scanning:
                self._stop_scan()

    def _handle_button(self):
        value = self.button.value()
        if self.button_last_value == 1 and value == 0:
            if self.wifi_connected and not self._in_cooldown():
                self.arm_until_ms = time.ticks_add(time.ticks_ms(), _ARM_WINDOW_MS)
                print("Button pressed; scan window opened")
                self._blink_blocking(1, 75)
        self.button_last_value = value

    def _set_led_mode(self, mode):
        if self.led_mode != mode:
            self.led_mode = mode
            self.last_led_toggle_ms = time.ticks_ms()
            self.led_value = 0
            self.led.off()

    def _update_led(self):
        now = time.ticks_ms()

        desired_mode = _LED_OFF
        if config.WIFI_SSID and not self.wifi_connected:
            desired_mode = _LED_WIFI
        elif self.connected or self.connecting or self.posting:
            desired_mode = _LED_ACTIVE

        self._set_led_mode(desired_mode)

        if self.led_mode == _LED_OFF:
            if self.led_value:
                self.led.off()
                self.led_value = 0
            return

        interval_ms = 400 if self.led_mode == _LED_WIFI else 100
        if time.ticks_diff(now, self.last_led_toggle_ms) >= interval_ms:
            self.last_led_toggle_ms = now
            if self.led_value:
                self.led.off()
                self.led_value = 0
            else:
                self.led.on()
                self.led_value = 1

    def _blink_blocking(self, cycles, interval_ms):
        for _ in range(cycles):
            self.led.on()
            time.sleep_ms(interval_ms)
            self.led.off()
            time.sleep_ms(interval_ms)


def main():
    print("Booting ESF-551 collector")
    print("CPU frequency:", machine.freq())
    collector = ESF551Collector()
    collector.start()
    collector.loop_forever()


main()
