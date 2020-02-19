#!/usr/bin/env python3

import cgi
import os, sys
import json
from datetime import datetime, timedelta
import re
import requests
from haversine import haversine
url = 'https://beekeeper.hivehome.com/1.0'
met_office_key = '4b45fddc-f56f-47bb-a16a-743aed52bdaa'


def get_json():
	cred_path = 'cgi-bin/credentials.json'
	if not os.path.isfile(cred_path):
		cred_path = 'credentials.json'
		if not os.path.isfile(cred_path):
			return None
	with open(cred_path) as f:
		j = json.load(f)
	return j


def login(username=None, password=None):
	headers = {"Content-Type": "application/json", "Accept": "application/json"}
	if username is None:
		j = get_json()
		if j is None:
			return headers
		if 'token' in j:
			headers['authorization'] = j['token']
			info = get_user_info(headers)
			if info != {}:
				return headers
		if 'username' in j and 'password' in j:
			username = j['username']
			password = j['password']
	if username is None:
		return headers
	payload = {'username': username, 'password': password}
	data = json.dumps(payload)
	r = requests.post(url+'/global/login', headers=headers, data=data)
	if 'token' in r.json():
		headers['authorization'] = r.json()['token']
	return headers


def unix_time_millis(dt):
	epoch = datetime.utcfromtimestamp(0)
	td = (dt - epoch)
	return 1000 * (td.microseconds + (td.seconds + td.days * 24 * 3600) * 10**6) / 10**6


def get_location_id(headers):
	j = get_json()
	if j is None:
		return None
	if 'location_id' in j:
		return j['location_id']
	if 'latitude' not in j or 'longitude' not in j:
		info = get_user_info(headers)
		j['latitude'] = info['latitude']
		j['longitude'] = info['longitude']
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


def get_weather(startdate, enddate, headers):
	to_return = {}
	location_id = get_location_id(headers)
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


def get_user_info(headers):
	data = {'homes': False, 'products': False, 'devices': False, 'actions': False}
	data['token'] = headers['authorization']
	r = requests.post(url+'/auth/admin-login', json=data)
	if 'user' in r.json():
		return r.json()['user']
	return {}


def get_id(headers, hub_name='heating'):
	r = requests.get(url+'/products', headers=headers)
	nodes = r.json()
	id_ = None
	for node in nodes:
		if node['type'] == hub_name:
			id_ = node['id']
	return id_


def get_node_names(headers):
	r = requests.get(url+'/products', headers=headers)
	nodes = r.json()
	node_names = []
	for node in nodes:
		node_names.append(str(node['type']))
	return node_names


def get_hub_name(headers):
	return 'heating'


def get_temps(headers, id_, startdate, enddate=None):
	start = int(unix_time_millis(startdate))
	if enddate is None:
		end = int(datetime.now().strftime("%s")) * 1000 
	else:
		end = int(unix_time_millis(enddate))
	j = {}
	while 'data' not in j:
		params = {'start':start, 'end':end, 'timeUnit':'MINUTES', 'rate':'5', 'operation':'MAX'}
		r = requests.get(url+'/history/heating/'+id_, headers=headers, params=params)
		j = r.json()
		start += 1000
	temps = sorted(j['data'], key=lambda k: k['date'])
	return temps


def get_device(headers, hub_name='heating'):
	r = requests.get(url+'/products', headers=headers)
	heating_device = None
	for device in r.json():
		if device['type'] == hub_name:
			heating_device = device
	return heating_device


def get_schedule(headers, hub_name='heating'):
	r = requests.get(url+'/products', headers=headers)
	for device in r.json():
		if device['type'] == hub_name:
			break
	schedule = device['state']['schedule']
	return schedule


def set_schedule(headers, schedule, hub_name='heating'):
	id_ = get_id(headers, hub_name)
	payload={'schedule': schedule}
	r = requests.post(url+'/nodes/heating/'+id_, headers=headers, json=payload)

