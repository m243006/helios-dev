from flask import Flask, request, make_response,url_for
from datetime import date
from dateutil.relativedelta import relativedelta
from flask_cors import CORS
from helios_exceptions import HeliosException
from datetime import datetime
from database import rest as database_endpoints
from api.LinePlotter import get_nearest_field_lines
from get_heeq import convert_skycoords_to_heeq
import json
import logging
import sunpy 
import os

logging.basicConfig(filename="helios_server.log", level=logging.DEBUG)

app = Flask("Helios")
CORS(app)

@app.errorhandler(HeliosException)
def handle_user_exception(e):
    return _send_response({"error": str(e)})

def _send_response(data):
    if data is None:
        data = {"error": "Nothing to return"}
    response = make_response(json.dumps(data))
    if "error" in data:
        response.status_code = 400
    response.mimetype = 'application/json'
    response.access_control_allow_origin = "*"
    return response

def _parse_date(date_str: str):
    try:
        return datetime.fromisoformat(date_str)
    except ValueError as e:
        raise HeliosException(str(e))

def _validate_input(parameter_list):
    """
    Validates that the HTTP request contains all the expected parameters
    :param parameter_list: List of strings of names of the parameters needed
    :type parameter_list: List[str]
    :raises HeliosException: Error returned to user on failure
    """
    # Create a list of any parameters missing from the list
    missing_list = []
    for param in parameter_list:
        if param not in request.args:
            missing_list.append(param)
    # If any are missing, create an error message
    if (len(missing_list) > 0):
        raise HeliosException("Missing parameters {}".format(",".join(missing_list)))

def _exec(fn):
    try:
        return _send_response(fn())
    # The design here is any known error we should report to the user should be
    # raised as a HeliosException. The error message is passed on to the user.
    # Any other unexpected exception will be handled and the user will get a generic
    # error message. Internally we will have logs that show what's going on.
    except HeliosException as e:
        logging.warning(e)
        return _send_response({"error": str(e)})
    except Exception as e:
        logging.error(e)
        return _send_response({"error": "An internal error occurred, please file an issue with the timestamp at https://github.com/Helioviewer-Project/helios",
            "timestamp": str(datetime.now())})



# This takes the path to a local jp2 file and returns x, y, z (i.e. HEEQ) coordinates
# relative to a know reference point. See get_heeq.py for details
@app.route("/observer/position")
def position_from_jp2():
    _validate_input(["id"])
    from api.observer_position import get_observer_position
    return _exec(lambda : get_observer_position(request.args["id"]))

@app.route("/event")
def get_events():
    start = request.args["start"]
    end = request.args["end"]

    from api.events import lookup_hek_events
    return _exec(lambda : lookup_hek_events(start, end))

@app.route("/psp")
def psp_position():
    _validate_input(["start", "end"])
    start = _parse_date(request.args["start"])
    end = _parse_date(request.args["end"])

    from api.psp_position import get_psp_position
    return _exec(lambda : get_psp_position(start, end))

# This endpoint is used to convert between coordinate data from the HEK
@app.route("/event/position")
def event_position():
    _validate_input([
        "system",
        "coord1",
        "coord2",
        "date",
        "observatory",
        "units"
    ])
    coord_system = request.args["system"]
    coord1 = request.args["coord1"]
    coord2 = request.args["coord2"]
    coord3 = None
    if ("coord3" in request.args):
        coord3 = request.args["coord3"]
    date = _parse_date(request.args["date"])
    observatory = request.args["observatory"]
    units = request.args["units"]
    from api.event_position import get_event_position
    return _exec(lambda : get_event_position(coord_system, units, coord1, coord2, coord3, date, observatory))




@app.route("/lines/gong/<date>")
def get_field_lines_gong(date):
    # date_object1 =  _parse_date(date) 
    date_object = _parse_date(date)
    date_object1 = date_object - relativedelta(months=1)
    m = date_object.month 
    y = date_object.year
    d = date_object.day
    minutes = int(date_object.strftime("%M"))
    directory = "../resources/gong/" + str(y) + "/" + date_object1.strftime("%m") + '/'
    substring = date_object1.strftime("%Y_%m_%d__%H")
    # 2023-07-28 20001400.json
    # Iterate over all files in the directory
    results = []
    results1 = []
    for filename in os.listdir(directory):
        results.append(filename)
        if substring in filename:
            results1.append(filename)

    server_name = request.host
    if (len(results1)>1):
        min = int(results1[0][15:17])
        min1 = int(results1[1][15:17])
        delta = abs(minutes - min)
        delta1 = abs(minutes - min1)
        if(delta> delta1):
            filename = results1[1]
        else:
            filename = results1[0]
    else:
        filename = results1[0]

    rightdate = datetime.strptime(filename[0:-5], "%Y_%m_%d__%H_%M_%S")
    formated_time = rightdate.strftime("%Y-%m-%dT%H:%M:%S")
    
    result = 'http://' + server_name + ':8000/resources/gong/' + str(y) + "/" + date_object1.strftime("%m") + '/' + filename
    return _send_response({'path': result , 'date': formated_time}) 
    

@app.route("/lines/<date>")
def get_field_lines(date):
    server_name = request.host
    file_name = get_nearest_field_lines(date)
    result = 'http://' + server_name + ':8000/resources/lines/' + file_name
    return _send_response({'path': result})
    
@app.route("/earth/<date>")
def get_earth(date):
    return convert_skycoords_to_heeq(sunpy.coordinates.get_earth(date))
    
  






database_endpoints.init(app, _send_response, _parse_date)