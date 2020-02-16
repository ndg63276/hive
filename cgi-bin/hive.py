#!/usr/bin/python

import cgi
import os, sys
import json
import time
from datetime import datetime, timedelta
import re
import requests
import json
import pytz
from haversine import haversine
url = 'https://beekeeper.hivehome.com/1.0'


def get_json():
	cred_path = 'cgi-bin/credentials.json'
	if not os.path.isfile(cred_path):
		cred_path = 'credentials.json'
		if not os.path.isfile(cred_path):
			return None
	with open(cred_path) as f:
		j = json.load(f)
	return j


def get_credentials():
	j = get_json()
	if j is None:
		return None, None
	username = j['username']
	password = j['password']
	return username, password


met_office_key = '4b45fddc-f56f-47bb-a16a-743aed52bdaa'
epoch = datetime.utcfromtimestamp(0)


def unix_time_millis(dt):
	td = (dt - epoch)
	return 1000 * (td.microseconds + (td.seconds + td.days * 24 * 3600) * 10**6) / 10**6


def get_location_id():
	j = get_json()
	if j is None:
		return None
	if 'location_id' in j:
		return j['location_id']
	if 'latitude' not in j or 'longitude' not in j:
		return None
	latitude = j['latitude']
	longitude = j['longitude']
	if latitude == 0 and longitude == 0:
		return None
	weather_url = 'http://datapoint.metoffice.gov.uk/public/data/val/wxobs/all/json/sitelist?key='+met_office_key
	r = requests.get(weather_url)
	min_dist, min_dist_id = 9999999, 0
	for location in r.json()['Locations']['Location']:
		this_lat = float(location['latitude'])
		this_long = float(location['longitude'])
		this_dist = haversine((latitude, longitude), (this_lat, this_long))
		if this_dist < min_dist:
			min_dist = this_dist
			min_dist_id = location['id']
	j['location_id'] = min_dist_id
	with open('cgi-bin/credentials.json','w') as f:
		json.dump(j,f, sort_keys=True, indent=4)
	return min_dist_id


def get_weather(startdate, enddate):
	to_return = {}
	location_id = get_location_id()
	if location_id is None:
		return {}
	weather_url = 'http://datapoint.metoffice.gov.uk/public/data/val/wxobs/all/json/'+location_id+'?res=hourly&key='+met_office_key
	r = requests.get(weather_url)
	days = r.json()['SiteRep']['DV']['Location']['Period']
	for day in days:
		the_date = day['value']
		if type(day['Rep']) == list:
			hours = day['Rep']
		else:
			hours = [day['Rep']]
		for hour in hours:
			the_time = str(int((int(hour['$'])/60)))
			dt_time = datetime.strptime(the_date+the_time,'%Y-%m-%dZ%H')
			the_temp = hour['T']
			if dt_time > startdate and dt_time < enddate:
				to_return[unix_time_millis(dt_time)] = the_temp
	return to_return


def login(username=None, password=None):
	if username is None:
		username, password = get_credentials()
	headers = {"Content-Type": "application/json", "Accept": "application/json"}
	payload = {'username': username, 'password': password}
	data = json.dumps(payload)
	r = requests.post(url+'/global/login', headers=headers, data=data)
	headers['authorization'] = r.json()['token']
	return headers


def get_id(headers, hub_name='heating'):
	r = requests.get(url+'/products', headers=headers)
	nodes = r.json()
	id = None
	for node in nodes:
		if node['type'] == hub_name:
			id = node['id']
	return id


def get_node_names(headers):
	r = requests.get(url+'/products', headers=headers)
	nodes = r.json()
	node_names = []
	for node in nodes:
		node_names.append(str(node['type']))
	return node_names


def get_hub_name(headers):
	return 'heating'


def get_temps(headers, id, startdate, enddate=None):
	start = str(int(unix_time_millis(startdate)))
	if enddate is None:
		end = str(int(time.time()*1000))
	else:
		end = str(int(unix_time_millis(enddate)))
	params = {'start':start, 'end':end, 'timeUnit':'MINUTES', 'rate':'5', 'operation':'MAX'}
	r = requests.get(url+'/history/heating/'+id, headers=headers, params=params)
	temps = sorted(r.json()['data'], key=lambda k: k['date'])
	return temps


def get_current_temps(headers, hub_name='heating'):
	r = requests.get(url+'/products', headers=headers)
	heating_device = None
	for device in r.json():
		if device['type'] == hub_name:
			heating_device = device
	if heating_device is None:
		return 0, 0
	currentTemp = heating_device['props']['temperature']
	currentTarget = heating_device['state']['target']
	return currentTemp, currentTarget


def get_schedule(headers, hub_name='heating'):
	r = requests.get(url+'/products', headers=headers)
	for device in r.json():
		if device['type'] == hub_name:
			break
	schedule = device['state']['schedule']
	return schedule


def set_schedule(headers, schedule, hub_name='heating'):
	id = get_id(headers, hub_name)
	payload={'schedule': schedule}
	r = requests.post(url+'/nodes/heating/'+id, headers=headers, json=payload)


if __name__ == "__main__":

	print("Content-type:text/html")
	print()

	username, password = get_credentials()
	if username is None:
		print("No credentials.json file found.<br />")
		print("Copy cgi-bin/credentials.example.json to cgi-bin/credentials.json<br />")
		print("Then edit it to include your hive username and password.")
		sys.exit()


	headers = login(username, password)
	hub_name = get_hub_name(headers)
	id = get_id(headers, hub_name)

	if id is None:
		print("Could not find a device called "+hub_name+".<br />")
		print("Here are the devices I could find:<br />")
		print(str(get_node_names(headers)))
		print("<br />Edit cgi-bin/credentials.json and put one of them in the value for 'hub_name'.")
		sys.exit()

	fs = cgi.FieldStorage()


	startdate = datetime.now()-timedelta(days=1)
	if 'start' in fs:
		start = fs.getvalue('start')
		if start.startswith('20'):
			startyear=int(start[0:4])
			startmonth=int(start[4:6])
			startday=int(start[6:8])
			starthour = startmin = startsec = 0
			if len(start)>8:
				starthour = int(start[8:10])
				if len(start)>10:
					startmin = int(start[10:12])
					if len(start)>12:
						startsec = int(start[12:14])
			startdate = datetime(startyear, startmonth, startday, starthour, startmin, startsec)
		match = re.match(r'-([0-9]+)(year|month|week|day|hour|min|sec)', start, re.I)
		if match:
			if 'year' in match.group(2):
				startdate = datetime.now() - timedelta(days=int(match.group(1))*365)
			if 'month' in match.group(2):
				startdate = datetime.now() - timedelta(days=int(match.group(1))*31)
			if 'week' in match.group(2):
				startdate = datetime.now() - timedelta(weeks=int(match.group(1)))
			if 'day' in match.group(2):
				startdate = datetime.now() - timedelta(days=int(match.group(1)))
			if 'hour' in match.group(2):
				startdate = datetime.now() - timedelta(hours=int(match.group(1)))
			if 'min' in match.group(2):
				startdate = datetime.now() - timedelta(minutes=int(match.group(1)))
			if 'sec' in match.group(2):
				startdate = datetime.now() - timedelta(seconds=int(match.group(1)))


	enddate = datetime.now()
	if 'end' in fs:
		end = fs.getvalue('end')
		if end.startswith('20'):
			endyear=int(end[0:4])
			endmonth=int(end[4:6])
			endday=int(end[6:8])
			endhour = endmin = endsec = 0
			if len(end)>8:
				endhour = int(end[8:10])
				if len(end)>10:
					endmin = int(end[10:12])
					if len(end)>12:
						endsec = int(end[12:14])
			enddate = datetime(endyear, endmonth, endday, endhour, endmin, endsec)
		match = re.match(r'-([0-9]+)(year|month|week|day|hour|min|sec)', end, re.I)
		if match:
			if 'year' in match.group(2):
				enddate = datetime.now() - timedelta(days=int(match.group(1))*365)
			if 'month' in match.group(2):
				enddate = datetime.now() - timedelta(days=int(match.group(1))*31)
			if 'week' in match.group(2):
				enddate = datetime.now() - timedelta(weeks=int(match.group(1)))
			if 'day' in match.group(2):
				enddate = datetime.now() - timedelta(days=int(match.group(1)))
			if 'hour' in match.group(2):
				enddate = datetime.now() - timedelta(hours=int(match.group(1)))
			if 'min' in match.group(2):
				enddate = datetime.now() - timedelta(minutes=int(match.group(1)))
			if 'sec' in match.group(2):
				enddate = datetime.now() - timedelta(seconds=int(match.group(1)))

	#tz = pytz.timezone('Europe/London')
	#startdate=tz.localize(startdate).astimezone(pytz.utc)
	#enddate=tz.localize(enddate).astimezone(pytz.utc)

	temps = get_temps(headers, id, startdate, enddate)
	currentTemp, currentTarget = get_current_temps(headers)
	weather = get_weather(startdate, enddate)
	if startdate.day == enddate.day:
		xformat="HH:mm:ss"
	else:
		xformat="DD-MM-YY HH:mm:ss"


	print("""
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
<meta http-equiv="Pragma" content="no-cache" />
<meta http-equiv="Expires" content="0" />
<title>My Hive Temperatures</title>
<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/moment@2.24.0/moment.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@2.8.0/dist/Chart.min.js"></script>
<script>
var pagelink=location.origin+location.pathname;
""")
	print("var currentTemp="+str(currentTemp)+";")
	print("var currentTargetRaw="+str(currentTarget)+";")
	print("""
var currentTarget=currentTargetRaw.toFixed(1)

var dataSets = [];
var dataPoints = [];
var dataPoints2 = [];
var dataPoints3 = [];
""")
	print("var tooltipFormat = '"+xformat +"';")

	for i in temps:
		print("dataPoints.push({x: "+str(i['date'])+", y: "+str(i['temperature'])+" });")

	for i in sorted(weather.keys()):
		print("dataPoints3.push({x: "+str(i)+", y: "+str(weather[i])+" });")


	print("dataSets.push({pointStyle:'line', borderColor:'#0000ff', label:'Actual', fill:false, data:dataPoints})")
	print("dataSets.push({pointStyle:'line', borderColor:'#00ff00', label:'Weather', fill:false, data:dataPoints3})")
	print("var headers="+str(headers).replace("u'","'")+";")
	print("var nodesurl='"+url+"/nodes/heating/"+id+"';")

	print("""

var config = {
	type: 'line',
	data: { datasets: dataSets },
	options: {
		title: { display: false },
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
			yAxes: [{
				id: 'left-y-axis',
				display: true,
				position: 'left',
				type: 'linear',
				scaleLabel: {
					display: false
				}
			}]
		}
	}
};

window.onload = function() {
	var ctx = document.getElementById('myChart').getContext('2d');
	var myChart = new Chart(ctx, config);
	document.getElementById('currentTempId').innerHTML=currentTemp+'&deg;C'
	document.getElementById('currentTargetId').innerHTML=currentTarget+'&deg;C'
	document.getElementById('tempToSet').value=currentTarget
	document.getElementById('boostTempToSet').value=currentTarget
};


function setTemp() {
	temp = document.getElementById("tempToSet").value;
	console.log('set '+temp);
	var data={'target': temp};
	$.ajax({
		url: nodesurl,
		type: 'POST',
		headers: headers,
		data: JSON.stringify(data),
		success: function () {
			console.log('success')
		}
	});
	location.reload();
}

function boostTemp() {
	temp = document.getElementById("boostTempToSet").value;
	time = document.getElementById("boostTime").value;
	console.log('boost '+temp+' '+time);
	var data={'mode': 'BOOST', 'boost': time, 'target': temp}; 
	$.ajax({
		url: nodesurl,
		type: 'POST',
		headers: headers,
		data: JSON.stringify(data),
		success: function () {
			console.log('success')
		}
	});
	location.reload();
}

</script>
<link rel="stylesheet" href="https://www.w3schools.com/w3css/4/w3.css">
</head>
<body>

<table border=0 align=center width=70%><tr align=center><th width=25%>Current Temperature</th><th width=25%>Current Setpoint</th><th width=25%>New setpoint</th><th>Boost</th></tr>
<tr align=center><td id='currentTempId' style='padding-top: 0px'>&deg;C</td>
<td id='currentTargetId' style='padding-top: 0px'>&deg;C</td>
<td style='padding-top: 16px'><form onsubmit='setTemp(); return false'><input id='tempToSet' type=text size=3 style='text-align:center;'></input>&deg;C<input type='submit' hidden /></form></td>
<td style='padding-top: 16px'><form onsubmit='boostTemp(); return false'><input id='boostTempToSet' type=text size=3 style='text-align:center;'></input>&deg;C for <input id='boostTime' type=text size=1 value=5 style='text-align:center;'>mins</input><input type='submit' hidden /></form></td>
</tr></table>

<canvas id="myChart" width="800" height="400"></canvas>

<br /><br /><center><form>
<input type='button' onClick='window.location.href=pagelink+"?start=-1hour&end=now";' value='Last 1 hour' style='font-size:20px;height:100px;width:200px'>
<input type='button' onClick='window.location.href=pagelink+"?start=-12hours&end=now";' value='Last 12 hours' style='font-size:20px;height:100px;width:200px'>
<input type='button' onClick='window.location.reload(true);' value='Refresh' style='font-size:20px;height:100px;width:200px'>
<input type='button' onClick='window.location.href=pagelink+"?start=-24hours&end=now";' value='Last 24 hours' style='font-size:20px;height:100px;width:200px'>
<input type='button' onClick='window.location.href=pagelink+"?start=-7days&end=now";' value='Last 7 days' style='font-size:20px;height:100px;width:200px'>

</form></center><br />
<a href='schedule.html'>Schedule View</a>
</body>
</html>
""")
