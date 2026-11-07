/* SPDX-License-Identifier: MIT
 * Controlled DT accessors; production encoders and Zephyr macro utilities are real.
 * Root and grouped nodes exercise every owned device family, three links and two encoders. */
#pragma once
#include <zephyr/sys/util_macro.h>
#define DT_ROOT root
#ifdef FIXTURE_NESTED_LAYOUT
#define DT_FOREACH_CHILD(root, fn)
#else
#define DT_FOREACH_CHILD(root, fn) fn(ball) fn(pad) fn(module) fn(encoders)
#endif
#define DT_FOREACH_NODE(fn) fn(ball) fn(pad) fn(module) fn(encoders) fn(encoder0) fn(encoder1)
#define DT_NODE_HASH(n) n
#define DT_NODE_HAS_COMPAT(n, compat) UTIL_CAT(UTIL_CAT(n, _), compat)
#define ball_cormoran_physical_layout_trackball 1
#define ball_cormoran_physical_layout_touch_pad 0
#define ball_cormoran_physical_layout_custom_module 0
#define ball_cormoran_physical_layout_rotary_encoders 0
#define pad_cormoran_physical_layout_trackball 0
#define pad_cormoran_physical_layout_touch_pad 1
#define pad_cormoran_physical_layout_custom_module 0
#define pad_cormoran_physical_layout_rotary_encoders 0
#define module_cormoran_physical_layout_trackball 0
#define module_cormoran_physical_layout_touch_pad 0
#define module_cormoran_physical_layout_custom_module 1
#define module_cormoran_physical_layout_rotary_encoders 0
#define encoders_cormoran_physical_layout_trackball 0
#define encoders_cormoran_physical_layout_touch_pad 0
#define encoders_cormoran_physical_layout_custom_module 0
#define encoders_cormoran_physical_layout_rotary_encoders 1
#define encoder0_cormoran_physical_layout_rotary_encoder 1
#define encoder1_cormoran_physical_layout_rotary_encoder 1
#define DT_PROP_LEN_OR(n, p, fallback) UTIL_CAT(UTIL_CAT(n, _), UTIL_CAT(p, _len))
#define DT_PROP_LEN(n, p) DT_PROP_LEN_OR(n, p, 0)
#define ball_linked_device_identifiers_len 2
#define ball_linked_subsystems_len 2
#define pad_linked_device_identifiers_len 0
#define pad_linked_subsystems_len 0
#define module_linked_device_identifiers_len 1
#define module_linked_subsystems_len 1
#define encoders_encoders_len 2
#define DT_PROP_BY_IDX(n, p, i) UTIL_CAT(UTIL_CAT(n, _), UTIL_CAT(p, UTIL_CAT(_, i)))
#define ball_linked_device_identifiers_0 "left"
#define ball_linked_subsystems_0 "input-a"
#define ball_linked_device_identifiers_1 "right"
#define ball_linked_subsystems_1 "input-b"
#define module_linked_device_identifiers_0 "aux"
#define module_linked_subsystems_0 "custom"
#define DT_NODE_FULL_NAME(n) #n
#define DT_NODE_HAS_STATUS(n, status) UTIL_CAT(n, _enabled)
#define ball_enabled 1
#define pad_enabled 0
#define module_enabled 1
#define encoders_enabled 1
#define encoder0_enabled 1
#define encoder1_enabled 0
#define DT_PHANDLE_BY_IDX(n, p, i) UTIL_CAT(encoder, i)
#define DT_PROP(n, p) UTIL_CAT(UTIL_CAT(n, _), p)
#ifdef FIXTURE_LONG_DISPLAY_NAME /* 70 bytes: more than the 64-byte message field */
#define ball_display_name "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT"
#else
#define ball_display_name "Trackball"
#endif
#define ball_x -100
#define ball_y 200
#define ball_size 3400
#define pad_display_name "Touchpad"
#define pad_width 4000
#define pad_height 3000
#define pad_x -10
#define pad_y 20
#define pad_r -45
#define pad_rx 100
#define pad_ry 200
#define module_display_name "Aux"
#define module_type "custom-type"
#define module_width 100
#define module_height 200
#define module_x 300
#define module_y 400
#define module_r 90
#define module_rx -5
#define module_ry 6
#define encoder0_x -123
#define encoder0_y 456
#define encoder0_size 1200
#define encoder1_x 789
#define encoder1_y -987
#define encoder1_size 1400

#ifdef FIXTURE_BOUNDARY_LAYOUT
#undef ball_x
#define ball_x (-2147483647 - 1)
#undef ball_y
#define ball_y 2147483647
#undef ball_size
#define ball_size 1
#undef pad_width
#define pad_width 2147483647
#undef pad_height
#define pad_height 1
#undef module_width
#define module_width 1
#undef module_height
#define module_height 2147483647
#undef encoder0_size
#define encoder0_size 2147483647
#undef encoder1_size
#define encoder1_size 1
#endif

/* Compile-refusal controls change only the selected dimension. */
#if FIXTURE_DIMENSION == 1
#undef ball_size
#define ball_size FIXTURE_DIMENSION_VALUE
#elif FIXTURE_DIMENSION == 2
#undef encoder0_size
#define encoder0_size FIXTURE_DIMENSION_VALUE
#elif FIXTURE_DIMENSION == 3
#undef pad_width
#define pad_width FIXTURE_DIMENSION_VALUE
#elif FIXTURE_DIMENSION == 4
#undef pad_height
#define pad_height FIXTURE_DIMENSION_VALUE
#elif FIXTURE_DIMENSION == 5
#undef module_width
#define module_width FIXTURE_DIMENSION_VALUE
#elif FIXTURE_DIMENSION == 6
#undef module_height
#define module_height FIXTURE_DIMENSION_VALUE
#endif
