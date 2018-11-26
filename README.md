# Hive Web Interface

A graphical view of the temperature and setpoint in your house. You can also now change the setpoint.

## Instructions
1. Clone this repository.
2. Copy cgi-bin/credentials.example.py to cgi-bin/credentials.py, and edit to your login at my.hivehome.com
3. Run python serve.py to start the server.
4. In a browser, go to http://localhost:8000/cgi-bin/hive.py . You should see a graph of the last 24 hours of temperatures, and the setpoints, in your house.

You should also see some buttons at the bottom, to see the last 1 hour, 12 hours, 24 hours and 7 days. These redirect to eg http://localhost:8000/cgi-bin/hive.py?start=-1hour. You can edit the start parameter, eg http://localhost:8000/cgi-bin/hive.py?start=-3hours, and even add an end parameter, eg http://localhost:8000/cgi-bin/hive.py?start=-2hours&end=-1hour.

You can also use YYYYMMDD or YYYYMMDDHHmm formatting if you want, eg http://localhost:8000/cgi-bin/hive.py?start=201801011200&end=20180131.

## Not working?

This code looks for a node called "Receiver 2" in your Hive account. If you get no data, or can't set the temperature, you could try changing that to "Receiver 1" in cgi-bin/hive.py.

