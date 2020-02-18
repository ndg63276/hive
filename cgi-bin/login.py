#!/usr/bin/env python3

print("Content-type:application/json")
print()

from hive import login, get_json
import cgi
import json
import os


cred_path = 'cgi-bin/credentials.json'
if not os.path.isfile(cred_path):
	j = {}
else:
	with open(cred_path, 'r') as f:
		j = json.load(f)

fs = cgi.FieldStorage()

status = {"status": "failed"}

if 'username' in fs and 'password' in fs:
	username = fs.getvalue('username')
	password = fs.getvalue('password')
	headers = login(username, password)

if 'authorization' in headers:
	j['username'] = username
	j['password'] = password
	with open(cred_path, 'w') as f:
		json.dump(j, f, indent=4)
	print(json.dumps(headers))
else:
	print(json.dumps(status))
