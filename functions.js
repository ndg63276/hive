var baseurl = 'https://beekeeper.hivehome.com/1.0';

function getCookie(cname) {
	var name = cname + "=";
	var ca = document.cookie.split(';');
	for(var i = 0; i < ca.length; i++) {
		var c = ca[i];
		while (c.charAt(0) == ' ') {
			c = c.substring(1);
		}
		if (c.indexOf(name) == 0) {
			return c.substring(name.length, c.length);
		}
	}
	return "";
}

function setCookie(cname, cvalue, exdays) {
	var d = new Date();
	d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
	var expires = "expires="+d.toUTCString();
	document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function do_login(username, password) {
	headers = {"Content-Type": "application/json", "Accept": "application/json"};
	payload = {"username": username, "password": password};
	to_return = false;
	$.ajax({
		url: baseurl + '/global/login',
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

function capitalise(str) {
	return str.charAt(0).toUpperCase() + str.slice(1)
}

function hardCapitalise(str) {
	return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

function dayOfWeekAsString(dayIndex) {
	if (dayIndex < 0) { dayIndex += 7 };
	if (dayIndex > 6) { dayIndex -= 7 };
	return ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][dayIndex];
}

function parseDateParam(param) {
	var to_return = new Date();
	if (param == 'now') {
		// do nothing
	} else if (param == 'future_prices') {
		if (to_return.getHours() >= 16) {
			to_return.setDate(end.getDate()+1);
			to_return.setUTCHours(23, 0, 0, 0);
		} else {
			to_return.setUTCHours(23, 0, 0, 0);
		}
	} else if (param.startsWith("20")) {
		var pattern = /([0-9]{4})-?([0-9]{2})-?([0-9]{2})T?([0-9]{2})?:?([0-9]{2})?:?([0-9]{2})?.*/;
		var match = param.match(pattern);
		year = match[1];
		month = match[2];
		day = match[3];
		if (match[4] == null) { hour = 0; } else { hour = match[4]; }
		if (match[5] == null) { min = 0; } else { min = match[5]; }
		if (match[6] == null) { sec = 0; } else { sec = match[6]; }
		to_return = new Date(year, month-1, day, hour, min, sec);
	} else {
		var pattern = /([+ -])([0-9]+)(year|month|week|day|hour|min|sec).*/i;
		var match = param.match(pattern);
		if (match != null) {
			if (match[1] == "-") {
				plusminus = -1
			} else {
				plusminus = 1
			}
			if (match[3].includes("year")) {
				to_return.setFullYear(to_return.getFullYear() + plusminus * match[2]);
			}
			if (match[3].includes("month")) {
				to_return.setMonth(to_return.getMonth() + plusminus * match[2]);
			}
			if (match[3].includes("week")) {
				to_return.setDate(to_return.getDate() + plusminus * match[2] * 7);
			}
			if (match[3].includes("day")) {
				to_return.setDate(to_return.getDate() + plusminus * match[2]);
			}
			if (match[3].includes("hour")) {
				to_return.setHours(to_return.getHours() + plusminus * match[2]);
			}
			if (match[3].includes("min")) {
				to_return.setMinutes(to_return.getMinutes() + plusminus * match[2]);
			}
			if (match[3].includes("sec")) {
				to_return.setSeconds(to_return.getSeconds() + plusminus * match[2]);
			}
		}
	}
	return to_return;
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

var met_office_key = '4b45fddc-f56f-47bb-a16a-743aed52bdaa';
function get_weather(startdate, enddate, location_id) {
	to_return = {};
	weather_url = 'http://datapoint.metoffice.gov.uk/public/data/val/wxobs/all/json/'+location_id+'?res=hourly&key='+met_office_key;
	$.ajax({
		url: weather_url,
		type: 'GET',
		dataType: 'json',
		async: false,
		success: function(json) {
			days = json['SiteRep']['DV']['Location']['Period'];
			for (day in days) {
				the_date = days[day]['value'].replace('Z','T');
				hours = days[day]['Rep'];
				for (hour in hours) {
					the_time = (hours[hour]['$']/60).toString().padStart(2, '0');
					the_temp = hours[hour]['T'];
					dt_time = Date.parse(the_date+the_time+':00:00');
					if (dt_time > startdate.getTime() && dt_time < enddate.getTime()) {
						to_return[dt_time] = the_temp;
					}
				}
			}
		}
	});
	return to_return;
}

function get_location_id(latitude, longitude) {
	var weather_url = 'http://datapoint.metoffice.gov.uk/public/data/val/wxobs/all/json/sitelist?key='+met_office_key;
	$.ajax({
		url: weather_url,
		type: 'GET',
		dataType: 'json',
		async: false,
		success: function(json) {
			var min_dist = 99999;
			var locations_list = json['Locations']['Location'];
			for (location_number in locations_list) {
				this_lat = locations_list[location_number]['latitude'];
				this_long = locations_list[location_number]['longitude'];
				this_dist = Math.sqrt(Math.pow(latitude-this_lat,2) + Math.pow(longitude-this_long,2));
				if (this_dist < min_dist) {
					min_dist = this_dist
					min_dist_id = locations_list[location_number]['id']
				}
			}
		}
	});
	return min_dist_id;
}
