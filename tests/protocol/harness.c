/* SPDX-License-Identifier: MIT */
#include <assert.h>
#include <pb_decode.h>
#include <pb_encode.h>
#include "framework.h"
#ifndef OWNER_HANDLER_SOURCE
#define OWNER_HANDLER_SOURCE "../../src/studio/physical_layouts_handler.c"
#endif
#include OWNER_HANDLER_SOURCE
static unsigned device_count, link_count, encoder_count;
static bool decode_link(pb_istream_t *stream, const pb_field_t *field, void **arg) {
    (void)field;
    (void)arg;
    cormoran_zmk_physical_layouts_LinkedDevice v =
        cormoran_zmk_physical_layouts_LinkedDevice_init_zero;
    assert(pb_decode(stream, cormoran_zmk_physical_layouts_LinkedDevice_fields, &v));
    const char *ids[] = {"left", "right", "aux"}, *subsystems[] = {"input-a", "input-b", "custom"};
    assert(link_count < 3 && !strcmp(v.device_identifier, ids[link_count]) &&
           !strcmp(v.subsystem_identifier, subsystems[link_count]));
    link_count++;
    return true;
}
static bool decode_device(pb_istream_t *stream, const pb_field_t *field, void **arg) {
    (void)field;
    (void)arg;
    cormoran_zmk_physical_layouts_PhysicalDevice v =
        cormoran_zmk_physical_layouts_PhysicalDevice_init_zero;
    v.links.funcs.decode = decode_link;
    assert(pb_decode(stream, cormoran_zmk_physical_layouts_PhysicalDevice_fields, &v));
    const char *ids[] = {"ball", "pad", "module"}, *names[] = {"Trackball", "Touchpad", "Aux"};
    assert(device_count < 3 && !strcmp(v.identifier, ids[device_count]) &&
           !strcmp(v.display_name, names[device_count]));
    assert(v.enabled == (device_count != 1));
    if (device_count == 0) {
        assert(v.which_device_type == 4 && v.device_type.trackball.has_attrs);
        assert(v.device_type.trackball.attrs.x == -100 && v.device_type.trackball.attrs.y == 200 &&
               v.device_type.trackball.attrs.size == 3400);
    } else if (device_count == 1) {
        assert(v.which_device_type == 6 && v.device_type.touch_pad.has_attrs);
        cormoran_zmk_physical_layouts_RectPhysicalAttrs a = v.device_type.touch_pad.attrs;
        assert(a.width == 4000 && a.height == 3000 && a.x == -10 && a.y == 20 && a.r == -45 &&
               a.rx == 100 && a.ry == 200);
    } else {
        assert(v.which_device_type == 7 && v.device_type.custom_module.has_attrs &&
               !strcmp(v.device_type.custom_module.type, "custom-type"));
        cormoran_zmk_physical_layouts_RectPhysicalAttrs a = v.device_type.custom_module.attrs;
        assert(a.width == 100 && a.height == 200 && a.x == 300 && a.y == 400 && a.r == 90 &&
               a.rx == -5 && a.ry == 6);
    }
    device_count++;
    return true;
}
static bool decode_encoder(pb_istream_t *stream, const pb_field_t *field, void **arg) {
    (void)field;
    (void)arg;
    cormoran_zmk_physical_layouts_RotaryEncoder v =
        cormoran_zmk_physical_layouts_RotaryEncoder_init_zero;
    assert(pb_decode(stream, cormoran_zmk_physical_layouts_RotaryEncoder_fields, &v));
    assert(encoder_count < 2 && v.has_attrs && v.enabled == (encoder_count == 0));
    assert(v.attrs.x == (encoder_count ? 789 : -123) && v.attrs.y == (encoder_count ? -987 : 456) &&
           v.attrs.size == (encoder_count ? 1400 : 1200));
    encoder_count++;
    return true;
}
static void dispatch(const uint8_t *bytes, size_t length) {
    zmk_custom_CallRequest req = {0};
    if (length)
        memcpy(req.payload.bytes, bytes, length);
    req.payload.size = length;
    pb_callback_t cb = {0};
    assert(physical_layouts_rpc_handle_request(&req, &cb));
}
int main(void) {
    const uint8_t malformed[] = {0x0a, 0xff}, valid[] = {0x0a, 0x00}, unknown[] = {0x12, 0x00};
    dispatch(malformed, sizeof(malformed));
    assert(response_cormoran__physical_layouts.which_response_type == 1 &&
           !strcmp(response_cormoran__physical_layouts.response_type.error.message,
                   "Failed to decode request"));
    dispatch(NULL, 0);
    assert(response_cormoran__physical_layouts.which_response_type == 1);
    dispatch(unknown, sizeof(unknown));
    assert(!strcmp(response_cormoran__physical_layouts.response_type.error.message,
                   "Failed to process request"));
    dispatch(valid, sizeof(valid));
    assert(response_cormoran__physical_layouts.which_response_type == 2 &&
           physical_layouts_feature_meta.security == 0);
    pb_ostream_t sizing = PB_OSTREAM_SIZING;
    assert(pb_encode(&sizing, cormoran_zmk_physical_layouts_Response_fields,
                     &response_cormoran__physical_layouts));
    uint8_t bytes[2048];
    pb_ostream_t stream = pb_ostream_from_buffer(bytes, sizeof(bytes));
    assert(pb_encode(&stream, cormoran_zmk_physical_layouts_Response_fields,
                     &response_cormoran__physical_layouts) &&
           stream.bytes_written == sizing.bytes_written);
    pb_istream_t input = pb_istream_from_buffer(bytes, stream.bytes_written), sub;
    pb_wire_type_t wire;
    uint32_t tag;
    bool eof;
    assert(pb_decode_tag(&input, &wire, &tag, &eof) && wire == PB_WT_STRING && tag == 2);
    assert(pb_make_string_substream(&input, &sub));
    cormoran_zmk_physical_layouts_GetPhysicalLayoutResponse result =
        cormoran_zmk_physical_layouts_GetPhysicalLayoutResponse_init_zero;
    result.devices.funcs.decode = decode_device;
    result.rotary_encoders.funcs.decode = decode_encoder;
    assert(
        pb_decode(&sub, cormoran_zmk_physical_layouts_GetPhysicalLayoutResponse_fields, &result));
    assert(pb_close_string_substream(&input, &sub) && !input.bytes_left);
    assert(device_count == 3 && link_count == 3 && encoder_count == 2);
    for (size_t capacity = 0; capacity < sizing.bytes_written; capacity++) {
        stream = pb_ostream_from_buffer(bytes, capacity);
        assert(!pb_encode(&stream, cormoran_zmk_physical_layouts_Response_fields,
                          &response_cormoran__physical_layouts));
    }
    dispatch(malformed, sizeof(malformed));
    dispatch(valid, sizeof(valid));
    stream = pb_ostream_from_buffer(bytes, sizeof(bytes));
    assert(pb_encode(&stream, cormoran_zmk_physical_layouts_Response_fields,
                     &response_cormoran__physical_layouts) &&
           stream.bytes_written == sizing.bytes_written);
    puts("physical-layout protocol: PASS dispatch, all families, links, order, flags, signed "
         "coordinates, wire bounds, recovery");
    return 0;
}
