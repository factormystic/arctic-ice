var size = {
	width: 650,
	height: 400,

	padding: 60,
};

size.outer_width = size.width + size.padding * 2;
size.outer_height = size.height + size.padding * 2;

var scale = {
	x: d3.scale.linear()
		.domain([0, 364])
		.range([size.padding, size.outer_width-size.padding]),

	y: d3.scale.linear()
		.domain([0, 18])
		.range([size.outer_height-size.padding, size.padding]),
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

d3.csv("data/NH_seaice_extent_final.csv", function(d, i) {
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
}, function(error, rows) {
	if (error) {
		throw error;
	}

	// sanity check
	if (rows.length != 11586) {
		throw new Error("um, some data is missing?");
	}

	var dataPointsByYear = _.groupBy(rows, function(d) {
		return d.date.getFullYear();
	});

	// since this chart isn't dynamic, we don't need to piece out the update/entering/exiting selections
	chart.selectAll(".year-line")
		.data(_.keys(dataPointsByYear))
		.enter()
			.append("path")
				.attr("class", "year-line")
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


});
