var access_token;
var refresh_token;
var expires_at;
var vehicleID;
var chargeData;
var climateData;
var passiveRequest = true;

var COMPANION_URL = 'https://e1d8c72d-759e-4f00-a641-7ea6ad0ad98e-00-2bnv37rv12ota.kirk.replit.dev';
var TESLA_FLEET_API = 'https://fleet-api.prd.na.vn.cloud.tesla.com';

var settings = {
  distance_unit: "km",
  distance_factor: 1.60934,
  temperature_unit: "C"
};

Pebble.addEventListener("ready", function(e) {
  console.log("==== SonicFTW 3.0 =====");
  
  chargeData = null;
  climateData = null;
  
  loadSettings();
  loadTokens();
  
  console.log("Settings: " + JSON.stringify(settings));
  console.log("Has token: " + !!access_token);
  console.log("Vehicle ID: " + vehicleID);
  
  setTimeout(function() {
    if (!access_token) {
      Pebble.showSimpleNotificationOnPebble("SonicFTW", "Please open Settings in the Pebble app to connect your Tesla account.");
      return;
    }
    
    checkAndRefreshToken(function() {
      if (vehicleID === null) {
        console.log("Need to get vehicle ID...");
        getVehicles(['getClimateState', 'getChargedState']);
      } else {
        getClimateState([]);
        getChargedState([]);
      }
    });
  }, 1000);
});

function loadSettings() {
  var saved = localStorage.getItem('settings');
  if (saved) {
    try {
      var parsed = JSON.parse(saved);
      settings.distance_unit = parsed.unitOfDistance || 'km';
      settings.distance_factor = (settings.distance_unit === 'km' ? 1.60934 : 1);
      settings.temperature_unit = parsed.unitOfTemperature || 'C';
    } catch (e) {
      console.log("Failed to parse settings: " + e);
    }
  }
}

function loadTokens() {
  access_token = localStorage.getItem('access_token');
  refresh_token = localStorage.getItem('refresh_token');
  expires_at = parseInt(localStorage.getItem('expires_at')) || 0;
  vehicleID = localStorage.getItem('vehicleID');
}

function saveTokens(accessToken, refreshToken, expiresAt) {
  access_token = accessToken;
  refresh_token = refreshToken;
  expires_at = expiresAt;
  
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);
  localStorage.setItem('expires_at', String(expiresAt));
}

function clearTokens() {
  access_token = null;
  refresh_token = null;
  expires_at = 0;
  vehicleID = null;
  
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('expires_at');
  localStorage.removeItem('vehicleID');
}

function checkAndRefreshToken(callback) {
  var now = Date.now();
  var bufferTime = 5 * 60 * 1000;
  
  if (expires_at && now >= (expires_at - bufferTime)) {
    console.log("Token expired or expiring soon, refreshing...");
    refreshAccessToken(callback);
  } else {
    callback();
  }
}

function refreshAccessToken(callback) {
  if (!refresh_token) {
    console.log("No refresh token available");
    Pebble.showSimpleNotificationOnPebble("Auth Error", "Please re-authenticate in Settings.");
    return;
  }
  
  var req = new XMLHttpRequest();
  req.open('POST', COMPANION_URL + '/api/tesla/auth/refresh', true);
  req.setRequestHeader('Content-Type', 'application/json');
  
  req.onload = function() {
    if (req.status === 200) {
      try {
        var data = JSON.parse(req.responseText);
        saveTokens(data.access_token, data.refresh_token, data.expires_at);
        console.log("Token refreshed successfully");
        if (callback) callback();
      } catch (e) {
        console.log("Failed to parse refresh response: " + e);
        Pebble.showSimpleNotificationOnPebble("Auth Error", "Failed to refresh token.");
      }
    } else {
      console.log("Token refresh failed: " + req.status);
      clearTokens();
      Pebble.showSimpleNotificationOnPebble("Auth Error", "Session expired. Please re-authenticate in Settings.");
    }
  };
  
  req.onerror = function() {
    console.log("Token refresh network error");
    Pebble.showSimpleNotificationOnPebble("Network Error", "Could not refresh token. Check your connection.");
  };
  
  req.send(JSON.stringify({ refresh_token: refresh_token }));
}

Pebble.addEventListener("appmessage", function(e) {
  console.log("Received msg from watch");
  
  if (typeof e.payload.menuIndexClicked === 'number') {
    passiveRequest = false;
    var menuIndex = e.payload.menuIndexClicked;
    console.log("Menu clicked: " + menuIndex);
    
    checkAndRefreshToken(function() {
      handleMenuClick(menuIndex);
    });
  }
});

function handleMenuClick(menuIndex) {
  switch (menuIndex) {
    case 0:
      console.log("Turn on AC");
      performCommand("auto_conditioning_start", "Enable A/C");
      break;
    case 1:
      console.log("Climate status");
      climateData = null;
      getClimateState([]);
      break;
    case 10:
      console.log("Start charge");
      performCommand("charge_port_door_open", "Open charge door", function() {
        performCommand("charge_start", "Start charging");
      });
      break;
    case 11:
      console.log("Get range");
      chargeData = null;
      getChargedState([]);
      break;
    case 12:
      console.log("Stop charge");
      performCommand("charge_stop", "Stop charging");
      break;
    case 20:
      console.log("Lock doors");
      performCommand("door_lock", "Lock doors");
      break;
    case 21:
      console.log("Honk");
      performCommand("honk_horn", "Honk horn");
      break;
    case 22:
      console.log("Flash lights");
      performCommand("flash_lights", "Flash lights");
      break;
    case 23:
      console.log("Reconnect");
      Pebble.showSimpleNotificationOnPebble("Reconnect", "Reconnecting to your vehicle...");
      vehicleID = null;
      localStorage.removeItem('vehicleID');
      chargeData = null;
      climateData = null;
      getVehicles(['getClimateState', 'getChargedState']);
      break;
    case 24:
      console.log("Car info");
      getVehicleState();
      break;
    case 25:
      console.log("Turn off AC");
      performCommand("auto_conditioning_stop", "Turn off A/C");
      break;
    case 26:
      console.log("About");
      Pebble.showSimpleNotificationOnPebble("About SonicFTW", "SonicFTW 3.0\nRevived for Rebble\n\nOriginal TeslaFTW by Erik de Bruijn\nNot affiliated with Tesla, Inc.");
      break;
    case 99:
      console.log("App loaded");
      break;
    default:
      console.log("Unknown menu option: " + menuIndex);
      break;
  }
}

function getVehicles(nextActions) {
  console.log("Getting vehicles...");
  
  var req = new XMLHttpRequest();
  req.open('GET', TESLA_FLEET_API + '/api/1/vehicles', true);
  req.setRequestHeader('Authorization', 'Bearer ' + access_token);
  
  req.onload = function() {
    console.log("Vehicles response: " + req.status);
    
    if (req.status === 200) {
      try {
        var data = JSON.parse(req.responseText);
        var vehicles = data.response || [];
        
        if (vehicles.length > 0) {
          var vehicle = vehicles[0];
          vehicleID = vehicle.id_s || String(vehicle.id);
          localStorage.setItem('vehicleID', vehicleID);
          
          console.log("Using vehicle: " + vehicleID + " (" + vehicle.display_name + ")");
          
          if (vehicles.length > 1) {
            Pebble.showSimpleNotificationOnPebble("Vehicles", "Found " + vehicles.length + " vehicles. Using: " + vehicle.display_name);
          } else {
            Pebble.showSimpleNotificationOnPebble("Vehicle Found", vehicle.display_name);
          }
          
          performNextActions(nextActions);
        } else {
          Pebble.showSimpleNotificationOnPebble("No Vehicles", "No vehicles found on your Tesla account.");
        }
      } catch (e) {
        console.log("Parse error: " + e);
        Pebble.showSimpleNotificationOnPebble("Error", "Failed to parse vehicle data.");
      }
    } else if (req.status === 401) {
      clearTokens();
      Pebble.showSimpleNotificationOnPebble("Auth Error", "Session expired. Please re-authenticate.");
    } else {
      Pebble.showSimpleNotificationOnPebble("Error", "Failed to get vehicles: " + req.status);
    }
  };
  
  req.onerror = function() {
    Pebble.showSimpleNotificationOnPebble("Network Error", "Could not connect to Tesla.");
  };
  
  req.send(null);
}

function performNextActions(actions) {
  if (!actions || actions.length === 0) return;
  
  var action = actions.shift();
  
  switch (action) {
    case 'getClimateState':
      getClimateState(actions);
      break;
    case 'getChargedState':
      getChargedState(actions);
      break;
    default:
      console.log("Unknown action: " + action);
      performNextActions(actions);
      break;
  }
}

function getClimateState(nextActions) {
  console.log("Getting climate state...");
  
  if (!vehicleID) {
    getVehicles(['getClimateState'].concat(nextActions));
    return;
  }
  
  var req = new XMLHttpRequest();
  req.open('GET', TESLA_FLEET_API + '/api/1/vehicles/' + vehicleID + '/data_request/climate_state', true);
  req.setRequestHeader('Authorization', 'Bearer ' + access_token);
  
  req.onload = function() {
    if (req.status === 200) {
      try {
        var data = JSON.parse(req.responseText);
        climateData = data.response;
        
        if (!passiveRequest) {
          var tempUnit = settings.temperature_unit;
          var insideTemp = climateData.inside_temp;
          var outsideTemp = climateData.outside_temp;
          
          if (tempUnit === 'F') {
            insideTemp = (insideTemp * 9/5) + 32;
            outsideTemp = (outsideTemp * 9/5) + 32;
          }
          
          Pebble.showSimpleNotificationOnPebble("Climate",
            "AC: " + (climateData.is_auto_conditioning_on ? "ON" : "OFF") + "\n" +
            "Inside: " + Math.round(insideTemp) + "\u00B0" + tempUnit + "\n" +
            "Outside: " + Math.round(outsideTemp) + "\u00B0" + tempUnit
          );
        }
        
        Pebble.sendAppMessage({
          interiorTemp: Math.round(climateData.inside_temp) + "/" + Math.round(climateData.outside_temp)
        });
        
        performNextActions(nextActions);
      } catch (e) {
        console.log("Parse error: " + e);
      }
    } else {
      console.log("Climate request failed: " + req.status);
    }
  };
  
  req.send(null);
}

function getChargedState(nextActions) {
  console.log("Getting charge state...");
  
  if (!vehicleID) {
    getVehicles(['getChargedState'].concat(nextActions));
    return;
  }
  
  var req = new XMLHttpRequest();
  req.open('GET', TESLA_FLEET_API + '/api/1/vehicles/' + vehicleID + '/data_request/charge_state', true);
  req.setRequestHeader('Authorization', 'Bearer ' + access_token);
  
  req.onload = function() {
    if (req.status === 200) {
      try {
        var data = JSON.parse(req.responseText);
        chargeData = data.response;
        
        if (!passiveRequest) {
          var range = Math.round(chargeData.ideal_battery_range * settings.distance_factor);
          var unit = settings.distance_unit;
          
          var msg = "Battery: " + chargeData.battery_level + "%\n" +
                    "Range: " + range + " " + unit + "\n" +
                    "State: " + chargeData.charging_state;
          
          if (chargeData.charging_state === 'Charging') {
            var chargeRate = Math.round(chargeData.charge_rate * settings.distance_factor);
            msg += "\nRate: " + chargeRate + " " + unit + "/hr";
            
            if (chargeData.time_to_full_charge > 0) {
              var hours = Math.floor(chargeData.time_to_full_charge);
              var mins = Math.round((chargeData.time_to_full_charge - hours) * 60);
              msg += "\nTime left: " + hours + "h " + mins + "m";
            }
          }
          
          Pebble.showSimpleNotificationOnPebble("Battery", msg);
        }
        
        var miniStatus = chargeData.battery_level + "% " + 
                        Math.round(chargeData.ideal_battery_range * settings.distance_factor) + 
                        settings.distance_unit + " " + chargeData.charging_state;
        
        Pebble.sendAppMessage({ batteryPerc: miniStatus });
        
        performNextActions(nextActions);
      } catch (e) {
        console.log("Parse error: " + e);
      }
    } else {
      console.log("Charge request failed: " + req.status);
    }
  };
  
  req.send(null);
}

function getVehicleState() {
  console.log("Getting vehicle state...");
  
  if (!vehicleID) {
    Pebble.showSimpleNotificationOnPebble("Error", "No vehicle selected.");
    return;
  }
  
  var req = new XMLHttpRequest();
  req.open('GET', TESLA_FLEET_API + '/api/1/vehicles/' + vehicleID + '/data_request/vehicle_state', true);
  req.setRequestHeader('Authorization', 'Bearer ' + access_token);
  
  req.onload = function() {
    if (req.status === 200) {
      try {
        var data = JSON.parse(req.responseText);
        var state = data.response;
        
        var locked = state.locked ? "Locked" : "Unlocked";
        var odometer = Math.round(state.odometer * settings.distance_factor);
        
        Pebble.showSimpleNotificationOnPebble("Vehicle Info",
          state.vehicle_name + "\n" +
          "Doors: " + locked + "\n" +
          "Odometer: " + odometer + " " + settings.distance_unit + "\n" +
          "Software: " + state.car_version
        );
      } catch (e) {
        console.log("Parse error: " + e);
      }
    } else {
      Pebble.showSimpleNotificationOnPebble("Error", "Failed to get vehicle info.");
    }
  };
  
  req.send(null);
}

function performCommand(command, displayName, callback) {
  console.log("Performing command: " + command);
  
  if (!vehicleID) {
    Pebble.showSimpleNotificationOnPebble("Error", "No vehicle selected.");
    return;
  }
  
  chargeData = null;
  climateData = null;
  
  var req = new XMLHttpRequest();
  req.open('POST', TESLA_FLEET_API + '/api/1/vehicles/' + vehicleID + '/command/' + command, true);
  req.setRequestHeader('Authorization', 'Bearer ' + access_token);
  req.setRequestHeader('Content-Type', 'application/json');
  
  req.onload = function() {
    if (req.status === 200) {
      try {
        var data = JSON.parse(req.responseText);
        
        if (data.response && data.response.result) {
          Pebble.showSimpleNotificationOnPebble(displayName, "Success!");
          if (callback) callback();
        } else {
          var reason = (data.response && data.response.reason) || "Unknown error";
          Pebble.showSimpleNotificationOnPebble(displayName, "Failed: " + reason);
        }
      } catch (e) {
        console.log("Parse error: " + e);
        Pebble.showSimpleNotificationOnPebble(displayName, "Command sent");
        if (callback) callback();
      }
    } else if (req.status === 408) {
      Pebble.showSimpleNotificationOnPebble(displayName, "Vehicle is asleep. Try waking it first.");
    } else {
      Pebble.showSimpleNotificationOnPebble(displayName, "Failed: " + req.status);
    }
  };
  
  req.onerror = function() {
    Pebble.showSimpleNotificationOnPebble("Network Error", "Could not send command.");
  };
  
  req.send(null);
}

Pebble.addEventListener("showConfiguration", function() {
  console.log("Opening configuration page...");
  
  var configUrl = COMPANION_URL + '/sonic-settings.html';
  console.log("Config URL: " + configUrl);
  
  Pebble.openURL(configUrl);
});

Pebble.addEventListener("webviewclosed", function(e) {
  console.log("Configuration closed");
  
  if (e && e.response) {
    try {
      var data = JSON.parse(decodeURIComponent(e.response));
      console.log("Received config: " + JSON.stringify(data));
      
      localStorage.setItem('settings', JSON.stringify(data));
      
      if (data.access_token) {
        saveTokens(data.access_token, data.refresh_token, parseInt(data.expires_at));
        vehicleID = null;
        localStorage.removeItem('vehicleID');
        
        console.log("New tokens saved, getting vehicles...");
        getVehicles(['getClimateState', 'getChargedState']);
      }
      
      loadSettings();
      
      Pebble.showSimpleNotificationOnPebble("Settings Saved", "Your preferences have been updated.");
    } catch (err) {
      console.log("Failed to parse config response: " + err);
    }
  }
});
