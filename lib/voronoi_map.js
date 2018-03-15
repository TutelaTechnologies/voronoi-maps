showHide = function(selector) {
  d3.select(selector).select('.hide').on('click', function(){
    d3.select(selector)
      .classed('visible', false)
      .classed('hidden', true);
  });

  d3.select(selector).select('.show').on('click', function(){
    d3.select(selector)
      .classed('visible', true)
      .classed('hidden', false);
  });
}

voronoiMap = function(map, givenPoints, initialSelections) {
  var providers = d3.map();
  var points = [];
  var lastSelectedPoint;

  var voronoi = d3.geom.voronoi()
      .x(function(d) { return d.x; })
      .y(function(d) { return d.y; });

  var formatProvider = function(data) {
    return data.provider + " (" + data.status + ")";
  }

  var selectPoint = function() {
    d3.selectAll('.selected').classed('selected', false);

    var cell = d3.select(this),
        point = cell.datum();

    lastSelectedPoint = point;
    cell.classed('selected', true);

    d3.select('#selected h1')
      .html('')
      .append('a')
        .text(point.name)
        .attr('href', point.url)
        .attr('target', '_blank')
  }

  var matchesSelection = function(data, selection) {
    return selection.provider === data.provider && selection.status == data.status;
  }

  var matchesASelection = function(data, selections) {
    for (var i = 0; i < selections.length; i++) {
      let selection = selections[i];
      if (matchesSelection(data, selection)) { return true; }
    }
    return false;
  }

  var drawProviderSelection = function() {
    showHide('#selections')
    labels = d3.select('#toggles').selectAll('input')
      .data(providers.values())
      .enter().append("label");

    labels.append("input")
      .attr('type', 'checkbox')
      .property('checked', function(d) {
        return initialSelections === undefined || matchesASelection(d, initialSelections);
      })
      .attr("value", function(d) { return formatProvider(d); })
      .attr("provider", function(d) { return d.provider; })
      .attr("status", function(d) { return d.status; })
      .on("change", drawWithLoading);

    labels.append("span")
      .attr('class', 'key')
      .style('background-color', function(d) { return (d.status === "Launched") ? d.color : 'white'; })
      .style('border-color', function(d) { return d.color; });

    labels.append("span")
      .text(function(d) { return formatProvider(d); });
  }

  var selectedProviders = function() {
    return d3.selectAll('#toggles input[type=checkbox]')[0]
      .filter(function(elem) {
        return elem.checked;
      })
      .map(function(elem) {
        return {provider: getAttribute("provider", elem), status: getAttribute("status", elem)};
      })
  }

  var pointsFilteredToSelectedProviders = function() {
    var currentSelectedProviders = selectedProviders();
    return points.filter(function(item){
      return matchesASelection(item, currentSelectedProviders);
    });
  }

  var getAttribute = function(name, elem) {
    return elem.attributes[name].value;
  }

  var drawWithLoading = function(e){
    d3.select('#loading').classed('visible', true);
    if (e && e.provider == 'viewreset') {
      d3.select('#overlay').remove();
    }
    setTimeout(function(){
      draw();
      d3.select('#loading').classed('visible', false);
    }, 0);
  }

  var draw = function() {
    d3.select('#overlay').remove();

    var bounds = map.getBounds(),
        topLeft = map.latLngToLayerPoint(bounds.getNorthWest()),
        bottomRight = map.latLngToLayerPoint(bounds.getSouthEast()),
        existing = d3.set(),
        drawLimit = bounds.pad(0.4);

    filteredPoints = pointsFilteredToSelectedProviders().filter(function(d) {
      var latlng = new L.LatLng(d.latitude, d.longitude);

      if (!drawLimit.contains(latlng)) { return false };

      var point = map.latLngToLayerPoint(latlng);

      key = point.toString();
      if (existing.has(key)) { return false };
      existing.add(key);

      d.x = point.x;
      d.y = point.y;
      return true;
    });

    voronoi(filteredPoints).forEach(function(d) { d.point.cell = d; });

    var svg = d3.select(map.getPanes().overlayPane).append("svg")
      .attr('id', 'overlay')
      .attr("class", "leaflet-zoom-hide")
      .style("width", map.getSize().x + 'px')
      .style("height", map.getSize().y + 'px')
      .style("margin-left", topLeft.x + "px")
      .style("margin-top", topLeft.y + "px");

    var g = svg.append("g")
      .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

    var svgPoints = g.attr("class", "points")
      .selectAll("g")
        .data(filteredPoints)
      .enter().append("g")
        .attr("class", "point");

    var buildPathFromPoint = function(point) {
      return "M" + point.cell.join("L") + "Z";
    }

    svgPoints.append("path")
      .attr("class", "point-cell")
      .attr("d", buildPathFromPoint)
      .on('click', selectPoint)
      .classed("selected", function(d) { return lastSelectedPoint == d} );

    svgPoints.append("circle")
      .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
      .style('stroke', function(d) { return d.color } )
      .style('fill', function(d) {
        let color = d.color;
        if (d.status !== "Launched"){
          color = 'white';
        }
        return color;
      })
      .style('stroke-width', 4)
      .attr("r", 10);
  }

  var mapLayer = {
    onAdd: function(map) {
      map.on('viewreset moveend', drawWithLoading);
      drawWithLoading();
    }
  };

  showHide('#about');

  map.on('ready', function() {
    points = givenPoints
    givenPoints.forEach(point => {
      let { provider, color, status } = point
      let label = formatProvider(point)
      providers.set(label, { label, provider, color, status })
    })
    drawProviderSelection()
    map.addLayer(mapLayer)
  })
}