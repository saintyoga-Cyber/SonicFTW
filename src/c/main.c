#include <pebble.h>

#define NUM_MENU_SECTIONS 3
#define NUM_CLIMATE_ITEMS 2
#define NUM_CHARGING_ITEMS 3
#define NUM_MISC_ITEMS 7

static Window *s_main_window;
static SimpleMenuLayer *s_menu_layer;
static SimpleMenuSection s_menu_sections[NUM_MENU_SECTIONS];
static SimpleMenuItem s_climate_items[NUM_CLIMATE_ITEMS];
static SimpleMenuItem s_charging_items[NUM_CHARGING_ITEMS];
static SimpleMenuItem s_misc_items[NUM_MISC_ITEMS];

static GBitmap *s_icon_tesla;
static GBitmap *s_icon_plug;
static GBitmap *s_icon_battery;
static GBitmap *s_icon_temp;

static void out_sent_handler(DictionaryIterator *sent, void *context) {
  s_climate_items[0].subtitle = "Command sent!";
  layer_mark_dirty(simple_menu_layer_get_layer(s_menu_layer));
}

static void out_failed_handler(DictionaryIterator *failed, AppMessageResult reason, void *context) {
  s_climate_items[0].subtitle = "Send failed";
  layer_mark_dirty(simple_menu_layer_get_layer(s_menu_layer));
}

static void in_received_handler(DictionaryIterator *iter, void *context) {
  Tuple *temp_tuple = dict_find(iter, 1);
  if (temp_tuple) {
    s_climate_items[0].subtitle = temp_tuple->value->cstring;
  }
  
  Tuple *charge_tuple = dict_find(iter, 2);
  if (charge_tuple) {
    s_charging_items[1].subtitle = charge_tuple->value->cstring;
  }
  
  layer_mark_dirty(simple_menu_layer_get_layer(s_menu_layer));
}

static void send_command(int section, int index) {
  DictionaryIterator *iter;
  if (app_message_outbox_begin(&iter) != APP_MSG_OK) {
    return;
  }
  
  int command = (section * 10) + index;
  Tuplet value = TupletInteger(0, command);
  dict_write_tuplet(iter, &value);
  app_message_outbox_send();
  
  APP_LOG(APP_LOG_LEVEL_DEBUG, "Sent command: %d", command);
}

static void climate_select_callback(int index, void *context) {
  send_command(0, index);
  s_climate_items[index].subtitle = "Sending...";
  layer_mark_dirty(simple_menu_layer_get_layer(s_menu_layer));
}

static void charging_select_callback(int index, void *context) {
  send_command(1, index);
  s_charging_items[index].subtitle = "Sending...";
  layer_mark_dirty(simple_menu_layer_get_layer(s_menu_layer));
}

static void misc_select_callback(int index, void *context) {
  send_command(2, index);
  s_misc_items[index].subtitle = "Sending...";
  layer_mark_dirty(simple_menu_layer_get_layer(s_menu_layer));
}

static void window_load(Window *window) {
  s_icon_tesla = gbitmap_create_with_resource(RESOURCE_ID_IMAGE_MENU_ICON);
  s_icon_plug = gbitmap_create_with_resource(RESOURCE_ID_IMAGE_MENU_ICON_2);
  s_icon_battery = gbitmap_create_with_resource(RESOURCE_ID_IMAGE_MENU_ICON_3);
  s_icon_temp = gbitmap_create_with_resource(RESOURCE_ID_IMAGE_MENU_ICON_4);
  
  int climate_idx = 0;
  s_climate_items[climate_idx++] = (SimpleMenuItem) {
    .title = "Enable A/C",
    .subtitle = "",
    .callback = climate_select_callback,
    .icon = s_icon_temp,
  };
  s_climate_items[climate_idx++] = (SimpleMenuItem) {
    .title = "Climate Status",
    .subtitle = "",
    .callback = climate_select_callback,
    .icon = s_icon_temp,
  };
  
  int charging_idx = 0;
  s_charging_items[charging_idx++] = (SimpleMenuItem) {
    .title = "Start Charging",
    .subtitle = "Open port + start",
    .callback = charging_select_callback,
    .icon = s_icon_plug,
  };
  s_charging_items[charging_idx++] = (SimpleMenuItem) {
    .title = "Charge Status",
    .subtitle = "Range, battery %",
    .callback = charging_select_callback,
    .icon = s_icon_battery,
  };
  s_charging_items[charging_idx++] = (SimpleMenuItem) {
    .title = "Stop Charging",
    .subtitle = "",
    .callback = charging_select_callback,
    .icon = s_icon_battery,
  };
  
  int misc_idx = 0;
  s_misc_items[misc_idx++] = (SimpleMenuItem) {
    .title = "Lock Doors",
    .callback = misc_select_callback,
    .icon = s_icon_tesla,
  };
  s_misc_items[misc_idx++] = (SimpleMenuItem) {
    .title = "Honk",
    .callback = misc_select_callback,
    .icon = s_icon_tesla,
  };
  s_misc_items[misc_idx++] = (SimpleMenuItem) {
    .title = "Flash Lights",
    .callback = misc_select_callback,
    .icon = s_icon_tesla,
  };
  s_misc_items[misc_idx++] = (SimpleMenuItem) {
    .title = "Reconnect",
    .callback = misc_select_callback,
    .icon = s_icon_tesla,
  };
  s_misc_items[misc_idx++] = (SimpleMenuItem) {
    .title = "Car Info",
    .callback = misc_select_callback,
    .icon = s_icon_tesla,
  };
  s_misc_items[misc_idx++] = (SimpleMenuItem) {
    .title = "Turn Off A/C",
    .callback = misc_select_callback,
    .icon = s_icon_tesla,
  };
  s_misc_items[misc_idx++] = (SimpleMenuItem) {
    .title = "About",
    .subtitle = "SonicFTW v3.0",
    .callback = misc_select_callback,
    .icon = s_icon_tesla,
  };
  
  s_menu_sections[0] = (SimpleMenuSection) {
    .title = "Climate",
    .num_items = NUM_CLIMATE_ITEMS,
    .items = s_climate_items,
  };
  s_menu_sections[1] = (SimpleMenuSection) {
    .title = "Charging",
    .num_items = NUM_CHARGING_ITEMS,
    .items = s_charging_items,
  };
  s_menu_sections[2] = (SimpleMenuSection) {
    .title = "Misc",
    .num_items = NUM_MISC_ITEMS,
    .items = s_misc_items,
  };
  
  Layer *window_layer = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(window_layer);
  
  s_menu_layer = simple_menu_layer_create(bounds, window, s_menu_sections, NUM_MENU_SECTIONS, NULL);
  layer_add_child(window_layer, simple_menu_layer_get_layer(s_menu_layer));
  
  DictionaryIterator *iter;
  if (app_message_outbox_begin(&iter) == APP_MSG_OK) {
    Tuplet value = TupletInteger(0, 99);
    dict_write_tuplet(iter, &value);
    app_message_outbox_send();
    APP_LOG(APP_LOG_LEVEL_INFO, "App activated, sent init message");
  }
}

static void window_unload(Window *window) {
  simple_menu_layer_destroy(s_menu_layer);
  gbitmap_destroy(s_icon_tesla);
  gbitmap_destroy(s_icon_plug);
  gbitmap_destroy(s_icon_battery);
  gbitmap_destroy(s_icon_temp);
}

int main(void) {
  app_message_register_outbox_sent(out_sent_handler);
  app_message_register_outbox_failed(out_failed_handler);
  app_message_register_inbox_received(in_received_handler);
  app_message_open(128, 128);
  
  s_main_window = window_create();
  window_set_window_handlers(s_main_window, (WindowHandlers) {
    .load = window_load,
    .unload = window_unload,
  });
  
  window_stack_push(s_main_window, true);
  app_event_loop();
  window_destroy(s_main_window);
}
