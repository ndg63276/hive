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
url = 'https://api-prod.bgchprod.info:443/omnia'

with open('cgi-bin/credentials.json') as f:
	j = json.load(f)
	username = j['username']
	password = j['password']

met_office_key = '4b45fddc-f56f-47bb-a16a-743aed52bdaa'
epoch = datetime.utcfromtimestamp(0)

def unix_time_millis(dt):
	td = (dt - epoch)
	return 1000 * (td.microseconds + (td.seconds + td.days * 24 * 3600) * 10**6) / 10**6

def get_location_id():
	try:
		return j['location_id']
	except:
		pass
	try:
		latitude = j['latitude']
		longitude = j['longitude']
	except:
		return None
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
			the_time = str(int(hour['$'])/60)
			dt_time = datetime.strptime(the_date+the_time,'%Y-%m-%dZ%H')
			the_temp = hour['T']
			if dt_time > startdate and dt_time < enddate:
				to_return[unix_time_millis(dt_time)] = the_temp
	return to_return

def login():
	headers = {'Content-Type': 'application/vnd.alertme.zoo-6.1+json', 'Accept': 'application/vnd.alertme.zoo-6.1+json', 'X-Omnia-Client': 'Hive Web Dashboard'}
	payload = {'sessions':[{'username':username,'password':password,'caller':'WEB'}]}
	data = json.dumps(payload)
	r = requests.post(url+'/auth/sessions', headers=headers, data=data)
	headers['X-Omnia-Access-Token'] = r.json()['sessions'][0]['sessionId']
	return headers

def get_id(headers):
	r=requests.get(url+'/nodes',headers=headers)
	nodes=r.json()['nodes']
	for i in range(len(nodes)):
		if nodes[i]['name'] == 'Receiver 2':
			id=nodes[i]['id']
	return id

def get_temps(headers, id, startdate, enddate=None):
	start = str(int(unix_time_millis(startdate)))
	if enddate is None:
		end = str(int(time.time()*1000))
	else:
		end = str(int(unix_time_millis(enddate)))
	params={'start':start, 'end':end, 'timeUnit':'MINUTES', 'rate':'5', 'operation':'MAX'}
	r=requests.get(url+'/channels/temperature@'+id+',targetTemperature@'+id, headers=headers, params=params)
	temps=r.json()['channels'][0]['values']
	targetTemps = r.json()['channels'][1]['values']
	return temps, targetTemps

def get_current_temps(headers, id):
	startdate = datetime.now()-timedelta(minutes=60)
	start = str(int(unix_time_millis(startdate)))
	end = str(int(time.time()*1000))
	params={'start':start, 'end':end, 'timeUnit':'SECONDS', 'rate':'10', 'operation':'MAX'}
	r=requests.get(url+'/channels/temperature@'+id+',targetTemperature@'+id, headers=headers, params=params)
	temps=r.json()['channels'][0]['values']
	targetTemps = r.json()['channels'][1]['values']
	currentTemp = round(temps[sorted(temps.keys())[-1]],2)
	currentTarget = round(targetTemps[sorted(targetTemps.keys())[-1]],1)
	return currentTemp, currentTarget

headers = login()
id = get_id(headers)

print "Content-type:text/html"
print

fs = cgi.FieldStorage()

startdate = datetime.now()-timedelta(days=1)
if fs.has_key('start'):
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
if fs.has_key('end'):
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

temps, targetTemps = get_temps(headers, id, startdate, enddate)
currentTemp, currentTarget = get_current_temps(headers, id)
weather = get_weather(startdate, enddate)
if startdate.day == enddate.day:
	xformat="HH:mm:ss"
else:
	xformat="DD-MM-YY HH:mm:ss"

print """
<html>
<head>  
<meta charset="UTF-8">
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
<meta http-equiv="Pragma" content="no-cache" />
<meta http-equiv="Expires" content="0" />
<title>My Hive Temperatures</title>
<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js"></script>
<script>
var pagelink=location.origin+location.pathname;
window.onload = function () {

var chart = new CanvasJS.Chart("chartContainer", {
	animationEnabled: true,
	zoomEnabled: true,
	zoomType: "xy",
	legend: {
		cursor: "pointer",
	},
	axisY :{
		includeZero:false,
		titleFontSize: 20,
		titleMaxWidth: 450
	},
	data: data
});

chart.render();
"""
print "var currentTemp="+str(currentTemp)+";"
print "var currentTargetRaw="+str(currentTarget)+";"
print """
var currentTarget=currentTargetRaw.toFixed(1)
document.getElementById('currentTempId').innerHTML=currentTemp+'&deg;C'
document.getElementById('currentTargetId').innerHTML=currentTarget+'&deg;C'
document.getElementById('tempToSet').value=currentTarget
document.getElementById('boostTempToSet').value=currentTarget

}

var data = [];
var dataPoints = [];
var dataPoints2 = [];
var dataPoints3 = [];
"""

print "var dataSeries = { type: 'line', xValueType: 'dateTime', showInLegend: true, legendText: 'Actual', xValueFormatString: '"+xformat+"' };"
print "var dataSeries2 = { type: 'line', xValueType: 'dateTime', showInLegend: true, legendText: 'Setpoint', xValueFormatString: '"+xformat+"' };"
print "var dataSeries3 = { type: 'line', xValueType: 'dateTime', showInLegend: true, legendText: 'Weather', xValueFormatString: '"+xformat+"' };"

for i in sorted(temps.keys()):
	print "dataPoints.push({x: "+str(i)+", y: "+str(temps[i])+" });"

for i in sorted(targetTemps.keys()):
	print "dataPoints2.push({x: "+str(i)+", y: "+str(targetTemps[i])+" });"

for i in sorted(weather.keys()):
	print "dataPoints3.push({x: "+str(i)+", y: "+str(weather[i])+" });"

print """
dataSeries.dataPoints = dataPoints;
dataSeries2.dataPoints = dataPoints2;
dataSeries3.dataPoints = dataPoints3;
data.push(dataSeries);
data.push(dataSeries2);
data.push(dataSeries3);
"""
print "var headers="+str(headers).replace("u'","'")+";"
print "var nodesurl='"+url+"/nodes/"+id+"';"

print """
function setTemp() {
	temp = document.getElementById("tempToSet").value;
	console.log('set '+temp);
	var data={'nodes': [{'attributes': {'targetHeatTemperature': {'targetValue': temp}}}]};
	$.ajax({
		url: nodesurl,
		type: 'PUT',
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
	var data={'nodes': [{'attributes': {'targetHeatTemperature': {'targetValue': temp}, 'activeHeatCoolMode': {'targetValue': 'BOOST'}, 'scheduleLockDuration': {'targetValue': time}}}]}; 
	$.ajax({
		url: nodesurl,
		type: 'PUT',
		headers: headers,
		data: JSON.stringify(data),
		success: function () {
			console.log('success')
		}
	});
	location.reload();
}
</script>
<script src="../canvasjs.min.js"></script>
<link rel="stylesheet" href="https://www.w3schools.com/w3css/4/w3.css">
</head>
<body>

<table border=0 align=center width=70%><tr align=center><th width=25%>Current Temperature</th><th width=25%>Current Setpoint</th><th width=25%>New setpoint</th><th>Boost</th></tr>
<tr align=center><td id='currentTempId' style='padding-top: 0px'>&deg;C</td>
<td id='currentTargetId' style='padding-top: 0px'>&deg;C</td>
<td style='padding-top: 16px'><form onsubmit='setTemp(); return false'><input id='tempToSet' type=text size=3 style='text-align:center;'></input>&deg;C<input type='submit' hidden /></form></td>
<td style='padding-top: 16px'><form onsubmit='boostTemp(); return false'><input id='boostTempToSet' type=text size=3 style='text-align:center;'></input>&deg;C for <input id='boostTime' type=text size=1 value=5 style='text-align:center;'>mins</input><input type='submit' hidden /></form></td>
</tr></table>

<div id="chartContainer" style="height: 800px; max-width: 1500px; margin: 0px auto;"></div>
<br /><br /><center><form>
<input type='button' onClick='window.location.href=pagelink+"?start=-1hour&end=now";' value='Last 1 hour' style='font-size:20px;height:100px;width:200px'>
<input type='button' onClick='window.location.href=pagelink+"?start=-12hours&end=now";' value='Last 12 hours' style='font-size:20px;height:100px;width:200px'>
<input type='button' onClick='window.location.reload(true);' value='Refresh' style='font-size:20px;height:100px;width:200px'>
<input type='button' onClick='window.location.href=pagelink+"?start=-24hours&end=now";' value='Last 24 hours' style='font-size:20px;height:100px;width:200px'>
<input type='button' onClick='window.location.href=pagelink+"?start=-7days&end=now";' value='Last 7 days' style='font-size:20px;height:100px;width:200px'>

</form></center><br />

</body>
</html>
"""
