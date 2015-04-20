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

	x_axis: d3.time.scale()
		.domain([new Date(1900, 0, 1), new Date(1900, 11, 31)])
		.range([size.padding.left+5, size.outer_width-size.padding.right]),
};

var axis = {
	x: d3.svg.axis()
		.scale(scale.x_axis)
		.orient("bottom")
		.ticks(d3.time.months)
		.tickSize(16, 0)
		.tickFormat(d3.time.format("%b")),

	y: d3.svg.axis()
		.scale(scale.y)
		.orient("left")
		.tickValues([0.424, 1.723, 4, 6, 8, 9.976140, 12, 14, 16, 18])
		.tickFormat(function(d) {
			switch (d) {
				case 18:
					return "18 million\nsq. km";

				case 9.976140:
					return "Size of\nCanada";

				case 1.723:
					return "Size of\nAlaska";

				case 0.424:
					return "Size of\nCalifornia";

				default:
					return d;
			}
		}),
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

	// axes go in g element containers so they can be positioned easier
	chart.append("g")
		.classed("x-axis", true)
		.attr("transform", "translate(0,"+ (size.height) +")")
		.call(axis.x)
		.selectAll("text")
			.attr("dx", "12px");

	chart.append("g")
		.classed("y-axis", true)
		.attr("transform", "translate("+ (size.padding.left) +","+ 0 +")")
		.call(axis.y)
		.selectAll("text")
			.each(function (d) {
				var el = d3.select(this);
				var words = d3.select(this).text().split("\n");
				el.text("");

				for (var i = 0; i < words.length; i++) {
					var tspan = el.append("tspan")
						.text(words[i]);

					if (i > 0) {
						tspan.attr("x", 0)
							.attr("dx", "-9") // right align the text visually
							.attr("dy", "15");
					}
				}
			});

	// chart title
	chart.append("g")
		.attr("transform", "translate(750,20)")
		.append("text")
			.attr("class", "right bold")
			.text("Yearly fluctuations in area\nof Arctic covered by ice")
			.each(function() {
				var el = d3.select(this);
				var words = d3.select(this).text().split("\n");
				el.text("");

				for (var i = 0; i < words.length; i++) {
					var tspan = el.append("tspan")
						.text(words[i]);

					if (i > 0) {
						tspan.attr("x", 0)
							.attr("dy", "15");
					}
				}
			});

	// subtitle
	chart.append("g")
		.attr("transform", "translate(750,50)")
		.append("text")
			.attr("class", "right smaller")
			.text("Millions of sq. km");

	// line explanation
	chart.append("g")
		.attr("transform", "translate(330,50)")
		.append("text")
			.attr("class", "smaller gray")
			.text("Each line represents one yearly\ncycle of sea ice fluctuations. The\ndotted line represents the average\nice extent from 1981 through 2009")
			.each(function() {
				var el = d3.select(this);
				var words = d3.select(this).text().split("\n");
				el.text("");

				for (var i = 0; i < words.length; i++) {
					var tspan = el.append("tspan")
						.text(words[i]);

					if (i > 0) {
						tspan.attr("x", 0)
							.attr("dy", "15");
					}
				}
			});

	// 1979 max
	chart.append("g")
		.attr("transform", "translate(230,50)")
		.append("text")
			.attr("class", "grayer")
			.text("1979");

	// 1980 min
	chart.append("g")
		.attr("transform", "translate(530,265)")
		.append("text")
			.attr("class", "grayer")
			.text("1980");

	// annual max
	chart.append("g")
		.attr("transform", "translate(180,150)")
		.append("text")
			.attr("class", "smaller gray")
			.text("Arctic ice cover\nusually reaches\nan annual\nmaximum\naround March")
			.each(function() {
				var el = d3.select(this);
				var words = d3.select(this).text().split("\n");
				el.text("");

				for (var i = 0; i < words.length; i++) {
					var tspan = el.append("tspan")
						.text(words[i]);

					if (i > 0) {
						tspan.attr("x", 0)
							.attr("dy", "15");
					}
				}
			});

	// annual min
	chart.append("g")
		.attr("transform", "translate(520,180)")
		.append("text")
			.attr("class", "smaller gray")
			.text("Ice cover usually\nshrinks to its\nminimum in\nSeptember")
			.each(function() {
				var el = d3.select(this);
				var words = d3.select(this).text().split("\n");
				el.text("");

				for (var i = 0; i < words.length; i++) {
					var tspan = el.append("tspan")
						.text(words[i]);

					if (i > 0) {
						tspan.attr("x", 0)
							.attr("dy", "15");
					}
				}
			});

	// 2010-2014 explanation
	chart.append("g")
		.attr("transform", "translate(310,260)")
		.append("text")
			.attr("class", "smaller green bold")
			.text("Ice extent for\n2010 through 2014\nis shown with\ngreen lines")
			.each(function() {
				var el = d3.select(this);
				var words = d3.select(this).text().split("\n");
				el.text("");

				for (var i = 0; i < words.length; i++) {
					var tspan = el.append("tspan")
						.text(words[i]);

					if (i > 0) {
						tspan.attr("x", 0)
							.attr("dy", "15");
					}
				}
			});

	// all time minimum
	chart.append("g")
		.attr("transform", "translate(620,370)")
		.append("text")
			.attr("class", "bold")
			.text("2012");

	chart.append("g")
		.attr("transform", "translate(620,385)")
		.append("text")
			.attr("class", "smaller gray")
			.text("Arctic ice extent\nreached the lowest\npoint on record")
			.each(function() {
				var el = d3.select(this);
				var words = d3.select(this).text().split("\n");
				el.text("");

				for (var i = 0; i < words.length; i++) {
					var tspan = el.append("tspan")
						.text(words[i]);

					if (i > 0) {
						tspan.attr("x", 0)
							.attr("dy", "15");
					}
				}
			});

	// 2015
	chart.append("g")
		.attr("transform", "translate(120,155)")
		.append("text")
			.attr("class", "bold")
			.text("2015");

	// 2015 maximum
	chart.append("g")
		.attr("transform", "translate(195,25)")
		.append("text")
			.attr("class", "right bold")
			.text("Feb. 25");

	chart.append("g")
		.attr("transform", "translate(195,40)")
		.append("text")
			.attr("class", "right smaller gray")
			.text("2015 maximum");
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
