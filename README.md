# Hive Web Interface

A graphical view of the temperature and setpoint in your house. You can also now change the setpoint, and set the boost time and temperature.

![Screenshot](/Screenshot.png?raw=true)


## Mac / Linux Instructions
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
        "longitude": 0,
        "hub_name": "Receiver 2"
    }
```
6. Change the username and password to your login at my.hivehome.com. If you add your latitude and longitude, the graph will show the outside temperature. You can find them by putting your postcode into [latlong.net](https://www.latlong.net/).
7. Press Ctrl-O to save the file, then Ctrl-X to exit nano.
8. Run this command to start the server:
```bash
python serve.py
```
9. In a web browser, go to [http://localhost:8000/cgi-bin/hive.py](http://localhost:8000/cgi-bin/hive.py) . You should see a graph of the last 24 hours of temperatures, and the setpoints, in your house.

## Windows 7 Instructions
1. Go to [https://www.python.org/downloads](https://www.python.org/downloads) and download the latest version for Windows. When you install it, on the first page, make sure to tick the box that says "Add Python 3.7 to PATH" (this is important). Then click "Install Now".
2. On this page, click the green "Clone or download" button, then click Download ZIP.
3. Extract all the files from the ZIP to somewhere memorable, eg C:\Users\bob\Desktop. It will create a folder called "hive-web-master" within that folder.
4. Go to that folder, then into cgi-bin, and copy the file credentials.example.json to credentials.json.
5. Open credentials.json in NotePad, and edit it to have your login at my.hivehome.com. If you add your latitude and longitude, the graph will show the outside temperature. You can find them by putting your postcode into [latlong.net](https://www.latlong.net/). Save the file and exit.
6. Click the Windows Start menu, type "cmd" and press Enter. A DOS box should appear.
7. Type this command:
```
python "C:\Users\bob\Desktop\hive-web-master\serve.py"
```
8. In a web browser, go to [http://localhost:8000/cgi-bin/hive.py](http://localhost:8000/cgi-bin/hive.py) . You should see a graph of the last 24 hours of temperatures, and the setpoints, in your house.

### Common problems with Windows installation
* If you get a message saying "python is not recognized as an internal or external command", then you forgot to tick the box marked "Add Python 3.7 to PATH" when you installed it. Uninstall python3.7, reinstall it, and make sure to tick the box.
* If you get a message saying "python: can't open file C:\Users\bob\Desktop\hive-web-master\serve.py Errno 21 No such file or directory", you have looked in the wrong folder for that file. Try "python C:\Users\bob\Desktop\hive-web-master\hive-web-master\serve.py", or locate the file in an explorer window, then copy the path to the DOS box.
* The web page will only keep working as long as you keep the DOS box open. If you close it down, the web page will stop working.

## Advanced
You should also see some buttons at the bottom, to see the last 1 hour, 12 hours, 24 hours and 7 days. These redirect to eg http://localhost:8000/cgi-bin/hive.py?start=-1hour. You can edit the start parameter, eg http://localhost:8000/cgi-bin/hive.py?start=-3hours, and even add an end parameter, eg http://localhost:8000/cgi-bin/hive.py?start=-2hours&end=-1hour.

You can also use YYYYMMDD or YYYYMMDDHHmm formatting if you want, eg http://localhost:8000/cgi-bin/hive.py?start=201801011200&end=20180131.

## Not working?

This code looks for a node called "Receiver 2" in your Hive account. If you get an error, try changing that in cgi-bin/credentials.py.

