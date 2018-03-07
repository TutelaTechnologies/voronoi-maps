from collections import OrderedDict
import json
import urllib2

def get_regions_from(url):
    json_response = urllib2.urlopen(url)
    response = json.load(json_response)

    for item in response:
        values = OrderedDict([
            ("latitude", float(item["latitude"])),
            ("longitude", float(item["longitude"])),
            ("name", item["displayName"]),
            ("provider", "Azure"),
            ("status", "current"),
            ("color", "#008CDB"),
        ])
        print json.dumps(values, indent=4), ","

get_regions_from("http://map.buildazure.com/data/azure_regions.json")
get_regions_from("http://map.buildazure.com/data/other_azure_regions.json")
