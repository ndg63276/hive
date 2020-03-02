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
				to_return = true;
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

function getSchedule(headers, hub_name) {
	to_return = {}
	devices = getProducts(headers);
	for (device in devices) {
		if (devices[device]['type'] == hub_name) {
			to_return = devices[device]['state']['schedule'];
		}
	}
	return to_return
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

function get_device_info(headers, hub_name) {
	to_return = {}
	var devices = getProducts(headers);
	for (device in devices) {
		if (devices[device]['type'] == hub_name) {
			to_return = devices[device]
		}
	}
	return to_return;
}

function sendData(headers, hub_name, id_, data) {
	to_return = false;
	$.ajax({
		url: baseurl+'/nodes/'+hub_name+'/'+id_,
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
			if (hub_name == 'heating') {
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

function loadJsonIntoForm(jsonToLoad) {
	clearForm();
	for (day in jsonToLoad) {
		for (num in jsonToLoad[day]) {
			if (hub_name == 'heating') {
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


function parseDateParam(param) {
	var to_return = new Date();
	if (param.startsWith('20')) {
		year = param.substring(0, 4);
		month = param.substring(4, 6);
		day = param.substring(6, 8);
		hour = 0;
		min = 0;
		sec = 0;
		if (param.length > 8) { hour = param.substring(8, 10); }
		if (param.length > 10) { min = param.substring(10, 12); }
		if (param.length > 12) { sec = param.substring(12, 14); }
		to_return = new Date(year, month-1, day, hour, min, sec);
	} else {
		var pattern = /-([0-9]+)(year|month|week|day|hour|min|sec).*/i;
		var match = param.match(pattern);
		if (match != null) {
			if (match[2].includes('year')) {
				to_return.setFullYear(to_return.getFullYear() - match[1]);
			}
			if (match[2].includes('month')) {
				to_return.setMonth(to_return.getMonth() - match[1]);
			}
			if (match[2].includes('week')) {
				to_return.setDate(to_return.getDate() - match[1] * 7);
			}
			if (match[2].includes('day')) {
				to_return.setDate(to_return.getDate() - match[1]);
			}
			if (match[2].includes('hour')) {
				to_return.setHours(to_return.getHours() - match[1]);
			}
			if (match[2].includes('min')) {
				to_return.setMinutes(to_return.getMinutes() - match[1]);
			}
			if (match[2].includes('sec')) {
				to_return.setSeconds(to_return.getSeconds() - match[1]);
			}
		}
	}
	return to_return;
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
