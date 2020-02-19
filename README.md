# Hive Web Interface

A graphical view of the temperature and weather at your house. You can also change the setpoint, and set the boost time and temperature. And a new schedule editor!

![Screenshot](/Screenshot.png?raw=true)
![Screenshot](/Schedule.png?raw=true)


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
4. Run this command to start the server:
```bash
python serve.py
```
5. In a web browser, go to [http://localhost:8000/cgi-bin/login.html](http://localhost:8000/cgi-bin/login.html) . You should see a login page. Put in your hive email address and password, and press Submit. It should log you in, and it will automatically store those details for you in a file called 'cgi-bin/credentials.json'.
6. Click one of the links to either the "History View" or "Schedule View".

## Windows 7 Instructions
1. Go to [https://www.python.org/downloads](https://www.python.org/downloads) and download the latest version for Windows. When you install it, on the first page, make sure to tick the box that says "Add Python 3.7 to PATH" (this is important). Then click "Install Now".
2. On this page, click the green "Clone or download" button, then click Download ZIP.
3. Extract all the files from the ZIP to somewhere memorable, eg C:\Users\bob\Desktop. It will create a folder called "hive-web-master" within that folder.
4. Click the Windows Start menu, type "cmd" and press Enter. A DOS box should appear.
5. Type this command:
```
python "C:\Users\bob\Desktop\hive-web-master\serve.py"
```
6. In a web browser, go to [http://localhost:8000/cgi-bin/login.html](http://localhost:8000/cgi-bin/login.html) . You should see a login page. Put in your hive email address and password, and press Submit. It should log you in, and it will automatically store those details for you in a file called 'cgi-bin/credentials.json'.
7. Click one of the links to either the "History View" or "Schedule View".


### Common problems with Windows installation
* If you get a message saying "python is not recognized as an internal or external command", then you forgot to tick the box marked "Add Python 3.7 to PATH" when you installed it. Uninstall python3.7, reinstall it, and make sure to tick the box.
* If you get a message saying "python: can't open file C:\Users\bob\Desktop\hive-web-master\serve.py Errno 21 No such file or directory", you have looked in the wrong folder for that file. Try "python C:\Users\bob\Desktop\hive-web-master\hive-web-master\serve.py", or locate the file in an explorer window, then copy the path to the DOS box.
* The web page will only keep working as long as you keep the DOS box open. If you close it down, the web page will stop working.

## Advanced
On the 'History View', you should also see some buttons at the bottom, to see the last 1 hour, 12 hours, 24 hours and 7 days. These redirect to eg http://localhost:8000/cgi-bin/history.html?start=-1hour. You can edit the start parameter, eg http://localhost:8000/cgi-bin/history.html?start=-3hours, and even add an end parameter, eg http://localhost:8000/cgi-bin/history.html?start=-2hours&end=-1hour.

You can also use YYYYMMDD or YYYYMMDDHHmm formatting if you want, eg http://localhost:8000/cgi-bin/history.html?start=201801011200&end=20180131.

