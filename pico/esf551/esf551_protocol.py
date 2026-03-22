import struct


WEIGHT_NOTIFY_UUID = "0000fff1-0000-1000-8000-00805f9b34fb"
CONTROL_UUID = "0000fff2-0000-1000-8000-00805f9b34fb"

DISPLAY_UNIT_KG = 0
DISPLAY_UNIT_LB = 1
DISPLAY_UNIT_ST = 2

DISPLAY_UNIT_NAMES = {
    DISPLAY_UNIT_KG: "kg",
    DISPLAY_UNIT_LB: "lb",
    DISPLAY_UNIT_ST: "st",
}

_UNIT_UPDATE_COMMAND = bytearray.fromhex("a522030500000163a10000")


def parse_measurement(payload):
    if payload is None or len(payload) != 22:
        return None

    if payload[0:2] != b"\xa5\x02":
        return None

    if payload[3:5] != b"\x10\x00":
        return None

    if payload[6:10] != b"\x01\x61\xa1\x00":
        return None

    if payload[19] != 1:
        return None

    weight_raw = struct.unpack("<I", bytes(payload[10:13]) + b"\x00")[0]
    weight_kg = round(weight_raw / 1000, 2)

    result = {
        "weight_kg": weight_kg,
        "display_unit": payload[21],
    }

    if payload[20] == 1:
        impedance = struct.unpack("<H", bytes(payload[13:15]))[0]
        if impedance:
            result["impedance"] = impedance

    return result


def build_unit_update_command(unit_code):
    payload = bytearray(_UNIT_UPDATE_COMMAND)
    payload[5] = 43 - unit_code
    payload[10] = unit_code
    return payload


def normalize_unit(unit_name):
    if unit_name is None:
        return None

    name = unit_name.lower()
    if name == "kg":
        return DISPLAY_UNIT_KG
    if name == "lb":
        return DISPLAY_UNIT_LB
    if name == "st":
        return DISPLAY_UNIT_ST
    raise ValueError("Unsupported unit: %s" % unit_name)
