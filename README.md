# Hive Web Interface

For now, just a graph of temperatures and setpoints in your home.

## Instructions
1. Clone this repository.
2. Edit cgi-bin/credentials.py to your login at my.hivehome.com
3. Run python serve.py to start the server.
4. In a browser, go to http://localhost:8000/cgi-bin/hive.py . You should see a graph of the last 24 hours of temperatures, and the setpoints, in your house.

You should also see some buttons at the bottom, to see the last 1 hour, 12 hours, 24 hours and 7 days. These redirect to eg http://localhost:8000/cgi-bin/hive.py?start=-1hour. You can edit the start parameter, eg http://localhost:8000/cgi-bin/hive.py?start=-3hours, and even add an end parameter, eg http://localhost:8000/cgi-bin/hive.py?start=-2hours&end=-1hour.

You can also use YYYYMMDD or YYYYMMDDHHmm formatting if you want, eg http://localhost:8000/cgi-bin/hive.py?start=201801011200&end=20180131.
