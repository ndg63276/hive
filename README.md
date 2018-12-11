# Hive Web Interface

A graphical view of the temperature and setpoint in your house. You can also now change the setpoint, and set the boost time and temperature.

![Screenshot](/Screenshot.png?raw=true)


## Instructions
1. If you're on Linux, open a Terminal, or on a Mac, open the Terminal application, from the Utilities folder.
2. Clone this repository.
```bash
git clone https://github.com/ndg63276/hive-web.git
```
3. Change directory into the newly created hive-web folder.
```bash
cd hive-web
```
4. Copy cgi-bin/credentials.example.json to cgi-bin/credentials.json.
```bash
cp cgi-bin/credentials.example.json cgi-bin/credentials.json
```
5. Edit that file.
```bash
nano cgi-bin/credentials.json
```
You should get a window like this:
```json
    {
        "username": "someone@example.com",
        "password": "abc123",
        "latitude": 0,
        "longitude": 0
    }
```
6. Change the username and password to your login at my.hivehome.com. If you add your latitude and longitude, the graph will show the outside temperature. You can find them by putting your postcode into [latlong.net](https://www.latlong.net/).
7. Press Ctrl-O to save the file, then Ctrl-X to exit nano.
8. Run this command to start the server:
```bash
python serve.py
```
9. In a web browser, go to [http://localhost:8000/cgi-bin/hive.py](http://localhost:8000/cgi-bin/hive.py) . You should see a graph of the last 24 hours of temperatures, and the setpoints, in your house.

## Advanced
You should also see some buttons at the bottom, to see the last 1 hour, 12 hours, 24 hours and 7 days. These redirect to eg http://localhost:8000/cgi-bin/hive.py?start=-1hour. You can edit the start parameter, eg http://localhost:8000/cgi-bin/hive.py?start=-3hours, and even add an end parameter, eg http://localhost:8000/cgi-bin/hive.py?start=-2hours&end=-1hour.

You can also use YYYYMMDD or YYYYMMDDHHmm formatting if you want, eg http://localhost:8000/cgi-bin/hive.py?start=201801011200&end=20180131.

## Not working?

This code looks for a node called "Receiver 2" in your Hive account. If you get no data, or can't set the temperature, you could try changing that to "Receiver 1" in cgi-bin/hive.py.

