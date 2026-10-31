/* SPDX-License-Identifier: MIT */
#pragma once
#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
#include <string.h>
#define ARG_UNUSED(x) ((void)(x))
#define BUILD_ASSERT(x, msg) _Static_assert(x, msg)
#define LOG_MODULE_REGISTER(...)
#define LOG_WRN(...)                                                                               \
    do {                                                                                           \
        if (0)                                                                                     \
            fprintf(stderr, __VA_ARGS__);                                                          \
    } while (0)
typedef struct {
    struct {
        size_t size;
        uint8_t bytes[128];
    } payload;
} zmk_custom_CallRequest;
struct zmk_rpc_custom_subsystem_meta {
    const char *ui_urls;
    int security;
};
#define ZMK_RPC_CUSTOM_SUBSYSTEM_UI_URLS(x) .ui_urls = x
#define ZMK_STUDIO_RPC_HANDLER_UNSECURED 0
#define ZMK_RPC_CUSTOM_SUBSYSTEM(n, m, h)
#define ZMK_RPC_CUSTOM_SUBSYSTEM_RESPONSE_BUFFER(n, t) static t response_##n
#define ZMK_RPC_CUSTOM_SUBSYSTEM_RESPONSE_BUFFER_ALLOCATE(n, cb)                                   \
    ((void)(cb), memset(&response_##n, 0, sizeof(response_##n)), &response_##n)
