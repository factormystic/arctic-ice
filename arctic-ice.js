var size = {
	width: 660,
	height: 460,

	padding: {
		left: 90,
		right: 20,
		top: 40,
		bottom: 20,
	},
};

size.padding.horizontal = size.padding.left + size.padding.right;
size.padding.vertical = size.padding.top + size.padding.bottom;

size.outer_width = size.width + size.padding.horizontal;
size.outer_height = size.height + size.padding.vertical;

var scale = {
	x: d3.scale.linear()
		.domain([0, 364])
		.range([size.padding.left+5, size.outer_width-size.padding.right]),

	y: d3.scale.linear()
		.domain([0, 18])
		.range([size.outer_height-size.padding.vertical, size.padding.bottom]),
};

var chart = d3.select("#chart .svg").append("svg")
	.attr("width", size.outer_width)
	.attr("height", size.outer_height);

var line = d3.svg.line()
	.interpolate("linear")
	.x(function(d) {
		return scale.x(d3.time.dayOfYear(d.date));
	})
	.y(function(d) {
		return scale.y(d.extent);
	});

var createDataPoint = function(d, i) {
	// don't process the header row, which isn't data
	if (i == 0)
		return;

	// d3 processes csv files according to RFC4180, which says:
	// "Spaces are considered part of a field and should not be ignored."
	// there's weird spacing in the original dataset, hence the weird spaces here
	return {
		// javascript's date constructor's month property is 0-based. why. whyyyyyyyyyyyyyyyyyyyyy
		date: new Date(+d["Year"], +d[" Month"]-1, +d[" Day"]),
		extent: +d["     Extent"],
	};
};

var drawChart = function(rows) {
	var dataPointsByYear = _.groupBy(rows, function(d) {
		return d.date.getFullYear();
	});

	// since this chart isn't dynamic, we don't need to piece out the update/entering/exiting selections
	chart.selectAll(".year-line")
		.data(_.keys(dataPointsByYear))
		.enter()
			.append("path")
				.classed("year-line", true)
				.classed("highlight", function(year) {
					return _.include(["2010", "2011", "2012", "2013", "2014"], year);
				})
				.classed("current-year", function(year) {
					return year == "2015";
				})
				.attr("d", function(year) {
					return line(dataPointsByYear[year]);
				});

	var _1978_2009_byDayOfYear = _.groupBy(_.filter(rows, function(d) {
		return d.date.getFullYear() <= 2009 && d3.time.dayOfYear(d.date) % 3 == 0;
	}), function(d) {
		return d3.time.dayOfYear(d.date);
	});

	var _1978_2009_avg = _.map(_1978_2009_byDayOfYear, function(days, doy) {
		return {
			day_of_year: +doy,
			avg_extent: _.sum(days, 'extent') / days.length,
		};
	});

	chart.selectAll(".average-doy")
		.data(_1978_2009_avg)
		.enter()
			.append("circle")
				.attr("class", "average-doy")
				.attr("cx", function(d) {
					return scale.x(d.day_of_year);
				})
				.attr("cy", function(d) {
					return scale.y(d.avg_extent);
				})
				.attr("r", 1.4);
};

var final_rows = [];
var nrt_rows = [];

d3.csv("data/NH_seaice_extent_final.csv", createDataPoint, function(error, rows) {
	if (error) {
		throw error;
	}

	// sanity check
	if (rows.length != 11586) {
		throw new Error("um, some data is missing?");
	}

	final_rows = rows;
	if (final_rows.length && nrt_rows.length) {
		drawChart([].concat(final_rows, nrt_rows));
	}
});

d3.csv("data/NH_seaice_extent_nrt.csv", createDataPoint, function(error, rows) {
	if (error) {
		throw error;
	}

	// sanity check
	if (rows.length != 107) {
		throw new Error("um, some data is missing?");
	}

	nrt_rows = rows;
	if (final_rows.length && nrt_rows.length) {
		drawChart([].concat(final_rows, nrt_rows));
	}
});
