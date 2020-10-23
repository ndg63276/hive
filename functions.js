var baseurl = 'https://beekeeper.hivehome.com/1.0';

function logged_in(email) {
	document.getElementById("loginstate").innerHTML = "You are logged in as "+email+".";
	document.getElementById("mainbody").classList.remove("hidden");
	document.getElementById("loginform").classList.add("hidden");
}

function login() {
	var username = document.getElementById("username").value;
	var password = document.getElementById("password").value;
	var email = do_login(username, password);
	if (email) {
		logged_in(email);
	} else {
		document.getElementById("loginstate").innerHTML = 'Login failed';
	}
}

function do_login(username, password) {
	headers = {"Content-Type": "application/json", "Accept": "application/json"};
	payload = {"username": username, "password": password};
	to_return = false;
	$.ajax({
		url: baseurl + '/cognito/login',
		type: 'POST',
		headers: headers,
		data: JSON.stringify(payload),
		dataType: 'json',
		async: false,
		success: function(json) {
			if ('token' in json) {
				setCookie('token', json['token'], 1)
				to_return = json['user']['username'];
			}
		},
	})
	return to_return;
}

function checklogin() {
	var token = getCookie('token');
	var to_return = {}
	if (token != "") {
		data = JSON.stringify({"homes": false, "products": false, "devices": false, "actions": false, "token": token});
		$.ajax({
			url: baseurl + '/auth/admin-login',
			type: 'POST',
			contentType: 'application/json',
			data: data,
			dataType: 'json',
			async: false,
			success: function(json) {
				console.log('success');
				if ('user' in json){
					console.log('authorized');
					to_return['headers'] = {"Content-Type": "application/json", "Accept": "application/json", "authorization": token};
					to_return['user'] = json['user'];
				} else {
					console.log('not authed');
				}
			},
			error: function(json) {
				console.log('Token expired');
			}
		})
	} else {
		console.log('No cookie');
	};
	return to_return;
}

function get_temps(headers, id_, startdate, enddate) {
	start = startdate.getTime();
	end = enddate.getTime();
	var j = {}
	while (!('data' in j)) {
		params = {'start':start, 'end':end, 'timeUnit':'MINUTES', 'rate':'5', 'operation':'MAX'};
		$.ajax({
			url: baseurl + '/history/'+hub_type+'/' + id_,
			headers: headers,
			type: 'GET',
			data: params,
			dataType: 'json',
			async: false,
			success: function(json) {
				console.log('success in get_temps')
				j = json;
			},
			error: function(json) {
				console.log('error in get_temps')
			}
		});
		start += 1000;
	}
	temps = j['data'];
	return temps;
}

function get_schedule_for_plotting(startdate, enddate, device_info) {
	var to_return = {};
	var i = 1;
	var midnight = new Date(startdate.getTime());
	midnight.setHours(0, 0, 0, 0);
	const schedule = device_info['state']['schedule'];
	while (midnight < enddate) {
		var eventdate = new Date(midnight.getTime());
		var day = dayOfWeekAsString(eventdate.getDay());
		day_schedule = schedule[day];
		for (event in day_schedule) {
			var starttime = day_schedule[event]['start'];
			var hours = Math.floor(starttime/60);
			var mins = starttime%60;
			eventdate.setHours(hours);
			eventdate.setMinutes(mins);
			eventdate.setSeconds(0);
			if (eventdate > startdate) {
				if (eventdate < enddate) {
					to_return[i] = {};
					to_return[i]['date'] = eventdate.getTime();
					if (device_info['type'] == 'heating') {
						to_return[i]['temperature'] = day_schedule[event]['value']['target'];
					} else {
						if (day_schedule[event]['value']['status'] == 'ON') {
							to_return[i]['setting'] = 1;
						} else {
							to_return[i]['setting'] = 0;
						}
					}
					i += 1;
				}
			} else {
				// set the target at the start of the graph
				to_return[0] = {};
				to_return[0]['date'] = startdate.getTime();
				if (device_info['type'] == 'heating') {
					to_return[0]['temperature'] = day_schedule[event]['value']['target'];
				} else {
					if (day_schedule[event]['value']['status'] == 'ON') {
						to_return[0]['setting'] = 1;
					} else {
						to_return[0]['setting'] = 0;
					}
				}
			}
		}
		midnight.setDate(midnight.getDate() + 1);
	}
	// set the target at the end of the graph
	to_return[i] = {};
	to_return[i]['date'] = enddate.getTime();
	if (device_info['type'] == 'heating') {
		to_return[i]['temperature'] = to_return[i-1]['temperature'];
	} else {
		to_return[i]['setting'] = to_return[i-1]['setting'];
	}
	return to_return;
}

function getSchedule(headers, hub_type, hub_name) {
	var device = get_device_info(headers, hub_type, hub_name)
	return device['state']['schedule'];
}

function getProducts(headers) {
	to_return = {};
	$.ajax({
		url: baseurl+'/products',
		type: 'GET',
		async: false,
		headers: headers,
		success: function (json) {
			to_return = json
		}
	})
	return to_return;
}

function get_device_info(headers, hub_type, hub_name) {
	to_return = {}
	var devices = getProducts(headers);
	for (device in devices) {
		if (devices[device]['type'] == hub_type && (hub_name == null || devices[device]['state']['name'] == hub_name)) {
			to_return = devices[device]
		}
	}
	return to_return;
}

function getCurrentAndNextEvent(device_info, day, hours, mins) {
	to_return = {}
	var dayAsString = dayOfWeekAsString(day);
	var time = hours * 60 + mins;
	var schedule = device_info['state']['schedule'];
	var daySchedule = schedule[dayAsString];
	for (event in daySchedule) {
		start = daySchedule[event]['start']
		if (start < time) {
			to_return['currentEvent'] = daySchedule[event];
			to_return['currentEvent']['clock'] = ('00'+Math.floor(start/60)).slice(-2)+':'+('00'+start%60).slice(-2);
		} else {
			to_return['nextEvent'] = daySchedule[event];
			to_return['nextEvent']['clock'] = ('00'+Math.floor(start/60)).slice(-2)+':'+('00'+start%60).slice(-2);
			break;
		}
	}
	return to_return
}

function sendData(headers, hub_type, id_, data) {
	to_return = false;
	$.ajax({
		url: baseurl+'/nodes/'+hub_type+'/'+id_,
		type: 'POST',
		headers: headers,
		data: JSON.stringify(data),
		dataType: 'json',
		async: false,
		success: function (json) {
			console.log('success');
			console.log(json);
			to_return = true;
		},
		error: function () {
			console.log('error');
		}
	});
	return to_return;
} 

function createJsonFromForm() {
	var json = {};
	for (day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) {
		json[day] = [];
		for (num of Array(6).keys()) {
			start = document.getElementById(day+num+'time').value;
			hours = parseInt(start.split(':')[0]);
			mins = parseInt(start.split(':')[1]);
			time = 60*hours + mins
			val = document.getElementById(day+num).value;
			if (hub_type == 'heating') {
				rawVal = val.replace('°C','')
				if (rawVal != '') {
					target = parseFloat(rawVal);
				} else {
					target = ''
				}
				targetDict = {"target": target};
			} else if (hub_type.includes('light')) {
				if (val.includes('ON')) {
					rawVal = val.replace('ON','').replace('%','').replace('@','');
					target = parseFloat(rawVal);
					targetDict = {'status': 'ON', 'brightness': target};
				} else {
					target = val;
					targetDict = {'status': target};
				}
			} else {
				if (val == 'ON' || val == 'OFF') {
					target = val
				} else {
					target = ''
				}
				targetDict = {"status": target};
			}
			if (target != '') {
				to_push = {"value":targetDict,"start":time}
				json[day].push(to_push);
			}
		}
	}
	console.log(json);
	return json;
}

function loadJsonIntoForm(jsonToLoad, hub_type) {
	clearForm();
	for (day in jsonToLoad) {
		for (num in jsonToLoad[day]) {
			if (hub_type == 'heating') {
				target = JSON.stringify(jsonToLoad[day][num]['value']['target'])+'°C';
			} else if (hub_type.includes('light')) {
				target = jsonToLoad[day][num]['value']['status'];
				if (target == 'ON') {
					target += ' @ '+jsonToLoad[day][num]['value']['brightness']+'%';
				}
			} else {
				target = jsonToLoad[day][num]['value']['status'];
			}
			start = JSON.stringify(jsonToLoad[day][num]['start']);
			hours = ('00'+Math.floor(start/60)).slice(-2);
			mins = ('00'+start%60).slice(-2);
			document.getElementById(day+num).value = target;
			document.getElementById(day+num+'time').value=hours+':'+mins;
		}
	}
}

function dayOfWeekAsString(dayIndex) {
	if (dayIndex < 0) { dayIndex += 7 };
	if (dayIndex > 6) { dayIndex -= 7 };
	return ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][dayIndex];
}

function get_config(tooltipFormat, showRightAxis) {
	return {
		type: 'line',
		data: { datasets: dataSets },
		options: {
			title: { display: false },
			tooltips: {
				mode: 'x',
				position: 'nearest',
			},
			legend: {
				display: true,
				position: 'bottom',
				labels: { fontSize: 18, usePointStyle: true }
			},
			scales: {
				xAxes: [{
					type: 'time',
					time: { tooltipFormat: tooltipFormat },
					display: true,
					scaleLabel: { display: false }
				}],
				yAxes: [
				{
					id: 'left',
					display: true,
					position: 'left',
					type: 'linear',
					scaleLabel: { display: false }
				},
				{
					id: 'right',
					display: showRightAxis,
					position: 'right',
					type: 'linear',
					scaleLabel: { display: false },
					ticks: {
						callback: function(value, index, values) {
							if (value == 1) { return 'ON' };
							if (value == 0) { return 'OFF' };
							return '';
						}
					}
				}
				]
			}
		}
	};
}

var meteo_key = 'OYS2TA9T'
function get_weather(startdate, enddate, location_id) {
	to_return = {};
	var weather_url = 'https://api.meteostat.net/v1/history/hourly';
	var data = {
		station: location_id,
		start: startdate.toISOString().substring(0,10),
		end: enddate.toISOString().substring(0,10),
		key: meteo_key,
		time_zone: 'Europe/London',
		time_format: 'Y-m-d H:i:s'
	}
	$.ajax({
		url: weather_url,
		type: 'GET',
		dataType: 'json',
		data: data,
		async: false,
		success: function(json) {
			for (d in json["data"]) {
				the_time = json["data"][d]["time_local"]
				the_temp = json["data"][d]["temperature"]
				dt_time = Date.parse(the_time);
				if (dt_time > startdate.getTime() && dt_time < enddate.getTime()) {
					to_return[dt_time] = the_temp;
				}
			}
		}
	});
	return to_return;
}

function get_location_id(latitude, longitude) {
	var weather_url = 'https://api.meteostat.net/v1/stations/nearby';
	var data = { lat: latitude, lon: longitude, limit: 1, key: meteo_key };
	var id = '';
	$.ajax({
		url: weather_url,
		type: 'GET',
		dataType: 'json',
		data: data,
		async: false,
		success: function(json) {
			id = json['data'][0]['id']
		}
	});
	return id;
}

function schedule() {
	var data={'mode': 'SCHEDULE'};
	sendData(headers, hub_type, id_, data);
	location.reload();
}

function off() {
	var data={'mode': 'OFF'};
	sendData(headers, hub_type, id_, data);
	location.reload();
}

function on() {
	if (hub_type == 'heating') {
		temp = document.getElementById("tempToSet").value;
		var data={'mode': 'MANUAL', 'target': temp};
	} else {
		var data={'mode': 'MANUAL'};

	}
	sendData(headers, hub_type, id_, data);
	location.reload();
}

function enableReadyBy() {
	if (document.getElementById('enableReadyBy').innerHTML == 'Enable') {
		document.getElementById('enableReadyBy').innerHTML = 'Enabling...'
		var data = {'optimumStart': true}
	} else {
		document.getElementById('enableReadyBy').innerHTML = 'Disabling...'
		var data = {'optimumStart': false}
	}
	sendData(headers, hub_type, id_, data);
	location.reload();
}


function checkHolidayMode(headers) {
	$.ajax({
		url: baseurl + '/holiday-mode',
		headers: headers,
		type: 'GET',
		success: function(json) {
			console.log(json);
			if (json['enabled'] == true) {
				document.getElementById('holidayModeId').innerHTML = 'On';
				document.getElementById('enableHolidayMode').innerHTML = 'Disable';
				document.getElementById('dateInputId').classList.add('hidden');
			} else {
				document.getElementById('holidayModeId').innerHTML = 'Off';
				document.getElementById('enableHolidayMode').innerHTML = 'Enable';
			}
		}
	});
}

function enableHolidayMode() {
	if (document.getElementById('enableHolidayMode').innerHTML == 'Enable') {
		document.getElementById('enableHolidayMode').innerHTML = 'Enabling...';
		var holiday_temp = document.getElementById('tempToSet').value;
		var holiday_start = $('input[name="datetimes"]').data('daterangepicker').startDate.valueOf();
		var holiday_end = $('input[name="datetimes"]').data('daterangepicker').endDate.valueOf();
		var data = {'start': holiday_start, 'end': holiday_end, 'temperature': holiday_temp}
		var type = 'POST';
	} else {
		document.getElementById('enableHolidayMode').innerHTML = 'Disabling...';
		var type = 'DELETE';
		var data = {};
	}
	console.log(data)
	$.ajax({
		url: baseurl + '/holiday-mode',
		headers: headers,
		type: type,
		data: JSON.stringify(data),
		dataType: 'json',
		success: function(json) {
			console.log('success');
			console.log(json);
		},
		error: function() {
			console.log('error');
		}
	});
	location.reload();
}

function redraw_devices(lights) {
	var switches = document.getElementById("switches");
	switches.innerHTML = "";
	var tbl = document.createElement("table");
	var tbdy = document.createElement("tbody");
	for (light in lights) {
		light_on = lights[light]["state"]["status"] == "ON";
		reachable = lights[light]["props"]["online"];
		var tr = document.createElement("tr");
		var td = document.createElement("td");
		var light_name = lights[light]["state"]["name"];
		var text = document.createTextNode(light_name);
		td.appendChild(text);
		tr.appendChild(td);
		var td1 = document.createElement("td");
		var but = document.createElement("button");
		but.innerHTML = "Off";
		but.onclick = function () { switch_off(this) };
		but.id = "off_"+lights[light]["type"]+"_"+lights[light]["id"];
		if ( (!reachable) || (!light_on) ) { but.classList.add("ui-disabled") };
		td1.appendChild(but);
		tr.appendChild(td1);
		var td2 = document.createElement("td");
		var but2 = document.createElement("button");
		but2.innerHTML = "On";
		but2.onclick = function () { switch_on(this) };
		but2.id = "on_"+lights[light]["type"]+"_"+lights[light]["id"];
		if ( (!reachable) || light_on ) { but2.classList.add("ui-disabled") };
		td2.appendChild(but2);
		tr.appendChild(td2);
		if ( "brightness" in lights[light]["state"] ) {
			var td3 = document.createElement("td");
			var inp = document.createElement("input");
			inp.type = "range";
			inp.min = 1;
			inp.max = 100;
			inp.value = lights[light]["state"]["brightness"];
			inp.onchange = function () { slider(this) };
			inp.id = "slider_"+lights[light]["type"]+"_"+lights[light]["id"];
			if ( !reachable ) { inp.classList.add("ui-disabled") };
			td3.appendChild(inp);
			tr.appendChild(td3);
		}
		if ( "hue" in lights[light]["state"] ) {
			var td4 = document.createElement("td");
			var inp2 = document.createElement("input");
			h = lights[light]["state"]["hue"];
			s = lights[light]["state"]["saturation"];
			v = lights[light]["state"]["value"];
			inp2.value = "hsv("+h+", "+s+", "+v+")";
			inp2.id = "color_"+lights[light]["type"]+"_"+lights[light]["id"];
			if ( (!reachable) || (!light_on) ) { inp2.classList.add("color_disabled") };
			td4.appendChild(inp2);
			tr.appendChild(td4);
		}
		tbdy.appendChild(tr);
	}
	tbl.appendChild(tbdy);
	switches.appendChild(tbl);
	setUpColors();
}

function switch_off(element) {
	var hub_type = element["id"].split("_")[1];
	var id_ = element["id"].split("_")[2];
	var data={"status": "OFF"};
	sendData(headers, hub_type, id_, data);
	lights = get_lights(headers);
	redraw_devices(lights);
}

function switch_on(element) {
	var hub_type = element["id"].split("_")[1];
	var id_ = element["id"].split("_")[2];
	var data={"status": "ON"};
	sendData(headers, hub_type, id_, data);
	lights = get_lights(headers);
	redraw_devices(lights);
}

function slider(element) {
	var hub_type = element["id"].split("_")[1];
	var id_ = element["id"].split("_")[2];
	var val = element.value;
	var data={"status": "ON", "brightness": val};
	sendData(headers, hub_type, id_, data);
	lights = get_lights(headers);
	redraw_devices(lights);
}

function get_lights(headers) {
	var products = getProducts(headers);
	var lights = [];
	for (product in products) {
		if (products[product]['type'].includes('light')) {
			lights.push(products[product]);
		}
	}
	return lights;
}

function changeColor(element) {
	var hub_type = element["id"].split("_")[1];
	var id_ = element["id"].split("_")[2];
	var val = element.value;
	var t = $("#"+element.id).spectrum("get");
	hsv = t.toHsv();
	h = parseInt(hsv["h"]);
	s = parseInt(100*hsv["s"]);
	v = parseInt(100*hsv["v"]);
	var data = {"hue": h, "saturation": s, "value": v};
	console.log(data);
	sendData(headers, hub_type, id_, data);
	lights = get_lights(headers);
	redraw_devices(lights);
}


function setUpColors() {
	$("[id^=color_]").spectrum({
		type: "color",
		hideAfterPaletteSelect: true,
		showInitial: true,
		showAlpha: false,
		allowEmpty: false,
		change: function() {
			changeColor(this)
		}
	});
	$(".color_disabled").spectrum("disable");
}
