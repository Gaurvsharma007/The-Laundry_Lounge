@echo off
echo Starting FreshThreads Local Server...
echo.
echo This will serve the website on http://localhost:8080
echo.
echo IMPORTANT: You need Python installed for this to work.
echo If you don't have Python, you can install it from https://www.python.org/downloads/
echo.
echo Press Ctrl+C to stop the server when done.
echo.
py -m http.server 8080
pause 