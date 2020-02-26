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
	var latitude = 0;
	var longitude = 0;
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
					headers = {"Content-Type": "application/json", "Accept": "application/json", "authorization": token};
					latitude = json['user']['latitude'];
					longitude = json['user']['longitude'];
				} else {
					console.log('not authed');
					headers = null;
				}
			},
			error: function(json) {
				console.log('Token expired');
				headers = null;
			}
		})
	} else {
		console.log('No cookie');
		headers = null;
	};
	return [headers, latitude, longitude];
}
