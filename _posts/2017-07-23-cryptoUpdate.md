Short python script to record data from Nanopool cryptocurrency mining account into Google sheets. 
The code is pretty well commented, and I listed some gotchas below. 
Otherwise a pretty simple script. <br>
[On Github](https://github.com/binayakd/cryptoUpdate) 

```python
#!/usr/bin/env python
import time
import requests
import json
import gspread
from oauth2client.client import SignedJwtAssertionCredentials

# local time and date
Time = time.strftime("%H:%M:%S")
date = time.strftime("%d/%m/%Y")

# nanopool API reference: https://eth.nanopool.org/api
url ="<url>" # appropriate nanopool API url goes here
data = requests.get(url).json()

# get relevent data, balance and 12 hour average hash rate
balance = data['data']['balance']
h12 = data['data']['avgHashrate']['h12']

# google sheets authorisation and integration with gspread (http://gspread.readthedocs.io/en/latest/oauth2.html)
json_key = json.load(open('creds.json')) # json credentials from google developer console
scope = ['https://spreadsheets.google.com/feeds']
credentials = SignedJwtAssertionCredentials(json_key['client_email'], json_key['private_key'].encode(), scope) # get email and key from creds
gclient = gspread.authorize(credentials) # authenticate with Google

#gspread API references: http://gspread.readthedocs.io/en/latest/#main-interface
book = gclient.open_by_url('<google sheet file url>') 
sheet = book.get_worksheet(<index>) #select sheet by index, zero-indexed
value_list = [date, Time, h12, balance] #collect data into a list
sheet.append_row(value_list) #append to the sheet, make sure no empty rows in the sheet before appending 
```

## Libraries Used
- [Requests](http://docs.python-requests.org/en/master/) (get JSON data from Nanopool API)
- [Google Spreadsheets Python API](https://github.com/burnash/gspread) (connect and write to Google spreadsheets)
- [oauth2client](https://github.com/google/oauth2client) (Authorization to connect to Google Sheets)
- [JSON](https://docs.python.org/2/library/json.html) (parsing JSON data from Nanopool and credential file from Google)
- [time](https://docs.python.org/2/library/time.html) (getting local time and date)

## Getting JSON data from Nanopool API
Nanopool provides API endpoints to extract various kinds of data for your mining pool:
- [https://eth.nanopool.org/api](https://eth.nanopool.org/api)

Choose one to get the relevent data you need.

## Authorization to connect to Google Sheets
Proper credentials have to be generated and applied for your script to be able to connect and write to the google sheets:
- [http://gspread.readthedocs.io/en/latest/oauth2.html](http://gspread.readthedocs.io/en/latest/oauth2.html)

## Connecting and wrting to Google Sheets
The main list of gspread API references are given here:
- [http://gspread.readthedocs.io/en/latest/](http://gspread.readthedocs.io/en/latest/)

In this script the sheet file to be written to is selected using the url: `gclient.open_by_url(url)` <br>
The sheet is selected using the index, which is zero-indexed: `worksheet.get_worksheet(index)` <br>
The list of values are appened to the worksheet: `sheet.append_row(value_list)` <br>
Be sure to delete any existing empty rows, as the values will only be appended after those empty rows.
