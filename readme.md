# Arctic Sea Ice

>> See the final product in action here: http://factormystic.net/utils/data-vis/arctic-ice/

This chart is a re-creation of an image posted in the New York Times article "[Arctic Ice Reaches a Low Winter Maximum](http://www.nytimes.com/interactive/2015/03/24/science/earth/arctic-ice-low-winter-maximum.html)".
(Here is a screenshot of the chart, in case the article becomes unavailable at some point: [link](http://i.imgur.com/TT5RMQz.png))

I think the original does a decent job of communicating the original data, and I thought it would be fun to recreate programmatically from the original dataset in SVG with D3.
It took a little over a weekend to make, and while writing the code I kept a build journal.
It's a running commentary of my thoughts in the moment (mildy edited for formatting), as if I were giving a presentation as I was going along.

Feel free to fork this repository if you want to mess around with the chart.
If you make something cool(er), let me know on twitter [@factormystic](https://twitter.com/factormystic).

Enjoy!

## Build Journal

To build this chart, we need the original dataset
- NYT uses Sea Ice Index Data and Image Archive
	- http://nsidc.org/data/seaice_index/archives.html
		- 1979-2014: ftp://sidads.colorado.edu/DATASETS/NOAA/G02135/north/daily/data/NH_seaice_extent_final.csv
		- near-real-time: ftp://sidads.colorado.edu/DATASETS/NOAA/G02135/north/daily/data/NH_seaice_extent_nrt.csv

Inspecting the axes, we can see that `Y` is "millions of square kilometers" and `X` is time, with a relatively high granularity in the squiggles that indicates it's probably daily data.
Besides X/Y coordinates of ice area/time, there are a few other facets of the data represented in the chart that we'll have to think about how to re-create in D3.
These include color of the line (gray for 1978-2009, green for 2010-2014, black for 2015-today), summer/winter months, a separate line representing the average ice area, a few callouts for min/max points, and contextualizing labels for various points on the Y axis (such as 10M sq. km. labelled "size of canada").

Inspecting the Sea Ice Index data, we can see that both the historical and near-real-time datasets follow the same csv column format, which will make it easier for us to process.
We can use D3's built-in csv functions to load the data files, but we'll want to process the rows a bit.
We'll need to consume the year, month, and day columns for the x-axis and the Extent column for the y-axis.

Creating each data point looks like this:
```js
// d3 processes csv files according to RFC4180, which says:
// "Spaces are considered part of a field and should not be ignored."
// there's weird spacing in the original dataset, hence the weird spaces here
return {
	date: new Date(+d["Year"], +d[" Month"], +d[" Day"]),
	extent: +d["     Extent"],
};
```

Any other property we want to show (color, etc) we can accomplish later with just these two values.
That keeps the data model nice and small.
Furthermore, I view the data model is philosphically immutable... we'll never go back and change the date or the extent for any object, but we may want to tweak the colors at some later point.
We can do this by handling those properties separately and leaving the core data model alone.
D3 interprets the csv data values as strings but we can easily translate those to javascript `Date` & `Number` objects

~

When building a D3 chart, I like to start with the scale functions, which are D3 [`scale`](https://github.com/mbostock/d3/wiki/Scales) objects.
They're a prerequisite for charting any data, and defining them first often helps clarify how the pieces of the chart fit together in code.

Horizontally, we need to translate a javascript `Date` to some pixel value from `0` to the width of the chart (linearly).
We could use the built in D3 [time scale helper](https://github.com/mbostock/d3/wiki/Time-Scales#scale) right?
Well, not quite.
That'd be what we'd want if we had one continuous line from 1978-2015, but actually we want to overlay each year on top of each other.
That makes our x-scale actually a function of the day of the year
D3 has a helper function to compute d.o.y. given a `Date`: [`d3.time.dayOfYear`](https://github.com/mbostock/d3/wiki/Time-Intervals#dayOfYear).
With that helper, our domain is `[0, 364]` and our range is `[0px, chart width px]`.
We don't need a D3 date scale for that... it's just a normal (eg, linear quantitative) scale!
All we need to do is remember to feed that scale object days of the year instead of the original date property.
*Later clarifying note: wait, not all years have 365 days! Won't that break the scale? Answer: D3 can extrapolate, but that does mean Dec 31's data points in leap years will be drawn more to the right that we'd expect data to be. Oops.*

The `x` scale:
```js
d3.scale.linear()
	.domain([0, 364])
	.range([size.padding, size.outer_width-size.padding]),
```

The vertical y scale is also a linear scale, from `[0, 18]` million square kilometers to `[chart height px, 0]`.
Remember, `0` is in the upper left.
D3 has no problem automatically inverting the range for us.
We should add some padding into those scales so that the chart area has some breathing room.
A true dynamic chart could read the domain from the dataset, but running a quick check... `d3.max(rows.map(function(d){ return d.extent }))` the max value is `16.635`, well under `18`.
Also, the original NYT chart has 18 m sq km as the max axis value.

The `y` scale:
```js
d3.scale.linear()
	.domain([0, 18])
	.range([size.outer_height-size.padding, size.padding]),
```

~

That's a lot of talking and not a lot of chart.
Now that we have scales that can translate model properties of the dataset to pixel position on the screen, lets put them together.
For that we'll want to use the D3 svg line helper, [`d3.svg.line`](https://github.com/mbostock/d3/wiki/SVG-Shapes#line).

```js
var line = d3.svg.line()
	.interpolate("linear")
	.x(function(d) {
		return scale.x(d3.time.dayOfYear(d.date));
	})
	.y(function(d) {
		return scale.y(d.extent);
	});
```

How it works is, We give it our data, and tell it what the `x` and `y` coordinates of each data point are via the scales we made, and it'll give us a svg `path` element's `d` attribute, which is a string of svg commands to draw the line.
It's very handy.

Since we want 1 line per year, lets group the data by year.

```js
var dataPointsByYear = _.groupBy(rows, function(d) {
	return d.date.getFullYear();
});
```

Inspecting that grouping we see an 18 element array for 1978 (the first partial data year), a lot of 356/356 element arrays (don't forget leap years *Later note: heh*) and... hold up, a bunch of years only have 182/183 values.
digging deeper we can see that 1979-1987 doesn't have data for every day
Is that going to break our chart?
Nope.
Nothing in our design absolutely requires data points for each day, and our data structures still work fine with variable numbers of points (a much less flexible data structure for this project would do something like, key the x coordinates off of an array index).
The line will still connect across "missing" data points since the x & y coordinates for the data points we **do** have are still valid.

Making sure there are basic `stroke` & `fill` styles for the year lines, let's check what we've got so far:

![screenshot-1](http://i.imgur.com/ao9yaCW.png)

Thats looking promising, but somethings wrong... why are there thick parts in 2 spots on the chart?

~

The SVG `path` line gets drawn in the order we hand it data points, and those points are coming out of the year groups, which is coming right out of the original data file, which is all correctly ordered by time.
Or, that's what **should** be happening.
In actuality, there's a bug in the code that create javascript `Date` objects from the dataset's year/month/day columns.
Javascript gurus will have already guessed the problem.
The javascript `Date` constructor's month property is 0-based, not 1-based.
That means creating a `Date` for February 1st, 1979 like `new Date(1979, 2, 1)` will give you back a date object for *MARCH* 1st, 1979!
Javascript is absurd.
That bug is causing some of the data points to be no longer be ordered correctly by time, so the line is doubling back on itself creating a thicker section.
Subtracting `1` from the month value in the date constructor fixes that issue.

```patch
-		date: new Date(+d["Year"], +d[" Month"], +d[" Day"]),
+		// javascript's date constructor's month property is 0-based. why. whyyyyyyyyyyyyyyyyyyyyy
+		date: new Date(+d["Year"], +d[" Month"]-1, +d[" Day"]),
```

Now we have this:

![screenshot-2](http://i.imgur.com/tZe0CBz.png)

...much better.

*Later note: in retrospect there does seem to be an artifact about halfway across. Another bug? No idea*

~

In addition to the 1978-2014 lines, there's two special lines on the chart: 2015, which comes from a separate dataset, and a dotted line that represents the 1981-2010 average.
Let's add that dotted line.
The NYT data uses 1981-2010 to compute their average, but i'm not sure why they starts at 1981 instead of 1978.
They appear to not include 2010+ since those years are colored differently (to highlight the decreasing ice extent in recent years) but I'm not sure if the NYT chart includes the year 2010 itself in the average or not, so in our chart we'll be extra clear that it's *through* 2009.
Since I can't think of a reason to exclude 1978-1980 in the average line, we're going to include it in this re-creation.

The logic to figure out an average year is pretty simple.
We need to generate an array of data models which represent the average extent for each day of the year, 0-356 (366 total for leap years).
Already there's a problem: we don't have data for every day of every year.
Remember that 1978 only covers a few months and we only have data for approximately every other day from 1979-1986.
I'm not sure how the NYT chart solved this, but it appears that they have less than half the number of dots vs days.
To guarantee that each year is represented in each average dot, we could interpolate the missing data by combining the most recent available day and the next available day.
But this chart is more like an executive summary than a research paper, so we're not going to do anything overcomplicated and instead acknowlege that the average line is mildy biased due to the sparse data for 1978-1986.

```js
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
```

To draw the line, we'll project a portion of our average data to SVG `circle`s to match the styling of the original chart.

```js
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
```

Swap the blue on the other lines for gray (probably should have started with gray), and now we have:

![screenshot-3](http://i.imgur.com/rqrWQ2w.png)

Not bad.

~

Speaking of line coloring, lets figure out light blue for 2010-2014.
We can apply color selectively by adding a css class to qualifying lines.
A line is there for each year, so the question then becomes, how do we qualify just the 2010-2014 years?
We'll use D3's [`classed`](https://github.com/mbostock/d3/wiki/Selections#classed) helper and a simple custom function to check if the year is in range.

*Later note: probably could have just used a simple inequality here rather than listing the years. However, it's worth remembering that the `year` parameter is a string.*
```js
.classed("highlight", function(year) {
	return _.include(["2010", "2011", "2012", "2013", "2014"], year);
})
```

Now our chart looks like this:

![screenshot-4](http://i.imgur.com/2UVcGUl.png)

Nice.

~

How about the 2015 data?
It's a separate dataset, so we'll have to load it separately.
Loading mulitiple csv files and only doing processing after they're all completely loaded is awkward in D3.
We can work around the awkwardness by moving our 2 callback functions into named functions, then only calling the draw function once both datasets are loaded.
Since the file load order is non-deterministic, we need to check in both load callbacks if it's appropriate to start drawing.
If there were many more data files, we'd want to take a more compact approach.
For only 2 files, a bit of duplication isn't a big deal.
Reusing both our parsing and drawing functions (but only calling the draw function once) means that all we need for the 2015 data to look right is another conditional style like before.

There's a nuance here to keep in mind while drawing things on top of each other: SVG has a fixed z-order based on the element order in the DOM.
By concatenating the 2015 data second, we can get it to draw on top of the older data.

```js
if (final_rows.length && nrt_rows.length) {
	drawChart([].concat(final_rows, nrt_rows));
}
```

Behold:

![screenshot-5](http://i.imgur.com/ARFDyOA.png)

~

Lets add some axes.

We can use D3's built in [SVG generator for axes](https://github.com/mbostock/d3/wiki/SVG-Axes#axis), but we'll need a new scale to translate a date range to pixel values.
D3 has a built in function for month names, and we can use the [tickFormat](https://github.com/mbostock/d3/wiki/SVG-Axes#tickFormat) helper to format them to abbreviations.

```js
d3.svg.axis()
	.scale(scale.x_axis)
	.orient("bottom")
	.ticks(d3.time.months)
	.tickSize(16, 0)
	.tickFormat(d3.time.format("%b")),
```

By the way, the original NYT chart mixes HTML for the text and axes with a png background for the chart data.
Since we're doing it all programmatically in SVG, there's going to be some small layout differences which would be too irritating to match, like only abbreviating **some** of the month names.
However, we can make something that gets pretty close without too much trouble.

We'll handle the season rectangles later; they're not part of the x-axis proper.

With the horizontal axis created, the chart now looks like:

![screenshot-6](http://i.imgur.com/XT7Z0s1.png)

~

The y-axis is a bit easier, because we can reuse the 0-18 million square kilometers scale we already built for the ice year lines.
In order to do special text for particular tick marks (like having the top tick, 18, show up as "18 million sq. km") we can use a custom `tickFormat` function and return whatever tick text we need.

This almost works well, but SVG text is a **massive** headache, and doesn't wrap like in HTML... so we have to do it manually.
It is very irritating to handwrite the code to insert SVG `tspans`, but this [helper function from StackOverflow](http://stackoverflow.com/a/13275930/1569) works pretty close to our needs.

We'll also need a edge padding adjustment to have enough room for custom text, which changes the dimensions of the chart a bit, making it narrower.

At this point I noticed the y-axis scale we previously wrote was slightly incorrect, as our scale starts with `0` but bottom tick on the NYT chart is `Size of California` (which turns out is larger than 0... [I checked](https://www.wolframalpha.com/input/?i=size+of+california+in+sq+km&a=*C.size-_*USStateProperty.dflt-&a=*DPClash.USStateP.size-_*Area-)).
Also, we have the issue of needing to represent "Size of Alaska" at a non-integral point, and not show `0` or `2` at all.

The D3 axis generator has a [`tickValues`](https://github.com/mbostock/d3/wiki/SVG-Axes#tickValues) function which allows us to specify precisely where we want ticks on an axis.
We can add `0.424`, `1.723`, and `9.976140` to that array instead of `0`, `2`, and `10` and then make sure to "format" those numbers with their appropriate labels in the tick formatter function.

```js
d3.svg.axis()
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
```

With the custom axes and padding adjustments:

![screenshot-7](http://i.imgur.com/cmRaKpu.png)

It's coming together nicely.

~

Now for the text callouts.
This is another case where the NYT approach of doing the text parts in HTML and using a png for the chart makes things simpler.
Again, since this is an SVG project, we're going to do the rest of the chart text in SVG, but as we already discovered with the axes, dealing with text in SVG is frustrating.
Additionally, there's no special D3 capabilities here (aside from the normal generator & selector functions) so it's going to be quite a few lines of code per text block.

The general approach is: create a `g` element and position it, then create a `text` element with the callout label, then use the `tspan` helper function from earlier to make it multiline.

*Later note: I probably should have pulled this tspan generator into a separate helper function. Didn't think of it at the time*
```js
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
```

After punching all this in, still without the corresponding callout lines:

![screenshot-8](http://i.imgur.com/ivGVxz9.png)

Fantastic.

~

Now for the callout lines.
This is also somewhat tedious, and again if we weren't making this chart programmatically with javascript and SVG, it'd be a lot easier to draw it manually in photoshop.
That said, we already know how to draw lines with D3, but before we used datapoint from csv files to draw them.
This time we'll need to hand enter the appropriate x/y values for each portion of the line.

We can create 1 new generic line helper for all the callout lines, and pick our own little data model that's easier to hand enter, such as arrays of `[x,y]` coordinates.
With this method, there's no problem extending the line to have a right angle, as with the 2012 minimum day line and the accent bars next to the min/max callout text.

```js
var callout_line = d3.svg.line()
	.interpolate("linear")
	.x(function(d) {
		return d[0];
	})
	.y(function(d) {
		return d[1];
	});
```

```js
chart.append("path")
	.attr("class", "black-line")
	.datum([[388,105], [388,167]])
	.attr("d", callout_line);
```

The last day of the 2015 data, 2015 maximum point, and 2012 lowest point also have dots, the latter two of which are manually constructed.

For the dot on the last day of 2015, we can position it using of the last element in the 2015 data array and use the same old dataset scale to plot it.

```js
// the last data point
chart.append("circle")
	.datum(_.last(dataPointsByYear[2015]))
	.attr("class", "black-dot")
	.attr("cx", function(d) {
		return scale.x(d3.time.dayOfYear(d.date));
	})
	.attr("cy", function(d) {
		return scale.y(d.extent);
	})
	.attr("r", 2);
```

![screenshot-9](http://i.imgur.com/5MRzGsl.png)

Almost there!

~

At this point the only missing elements are the summer/winter season markers above the x-axis.
SVG supports gradients, but naturally the syntax to do it is bizarre and frustrating.
I certainly don't know how to do it without google or MDN explaining by example.

The basic syntax is to define the gradient and its stops, then reference it as a rect `fill`.

```js
// summer season marker
var winter_gradient = chart.append("defs")
	.append("linearGradient")
		.attr("id", "summer")
		.attr("x1", "0%")
		.attr("y1", "100%")
		.attr("x2", "0%")
		.attr("y2", "5%");

winter_gradient.append("stop")
	.attr("offset", "0%")
	.style("stop-color", "rgb(255, 255, 227)");

winter_gradient.append("stop")
	.attr("offset", "100%")
	.style("stop-color", "#fff");
```

For the position of the seasonal rects, we can use the same scale as used for the ice lines, and define the left and width positions in terms of day of the year.
So for example, the first winter rect starts at `scale.x(0)` and has a width of `scale.x(59) - scale.x(0)`.
This relative position in days, through our previously defined scale, will output the pixel values we need for precise positioning without having to hand code it.
Summer extends from day 151-242, so that's `x = scale.x(151)`, `width = scale.x(242) - scale.x(151)`.

```
chart.append("rect")
	.attr("x", scale.x(151))
	.attr("y", scale.y(0)-51)
	.attr("width", scale.x(242) - scale.x(151))
	.attr("height", 50)
	.attr("fill", "url(#summer)");
```

And now we're all done!

~

Well, there's one more thing...

This chart now looks nearly identical to the original (allowing for different font choices and the smaller plot area), but since this is a programmatically generated data driven document, why not have some bonus fun?

Right now the chart loads instantly after the csv dataset files are processed, but it's hardly any more work to add animated transitions to different sections.
If "pizzaz" was the only purpose to an animation, then it's probably not worth doing.
In this case, by fading in different parts of the chart with delays, we can draw the eye to examine each part before seeing the chart as a whole.
Phased delays are a power way to direct focus and it's worth trying on this chart.

D3 makes animations easy by automatically tweening properties set after a [`transition`](https://github.com/mbostock/d3/wiki/Transitions#d3_transition) call.
All we'll need to do to get a fade in transition is set a zero opacity on the element, call `transition()`, then a 1.0 opacity.
To phase parts in in separate groups, we can use the [`delay`](https://github.com/mbostock/d3/wiki/Transitions#delay) helper.

But first, lets think about what we DON'T want to fade in.
The chart title and axes are fixed, and actually not dependent on the data, so we can draw them first before the data is even loaded.

Next, let's think about what we DO want to transition and see if we can make sure there won't be too many things changing.
There's three colors of lines in the chart: 1978-2009, 2010-2014, and 2015.
Let's try to fade these groups in separately with their corresponding callouts.

There's also the two bold callouts (the max at feb 25, 2015 and the min for 2012).
Since those callouts are key data points, lets transition those separately and last, so its the final point of focus.

To sum up, what we want is: 1) page loads and title & axes are draw 2) datasets are loaded & old data & callouts fade in 4) recent data & callouts fade in 5) near real time data & callouts fade in 6) key max/min points fade in
That hopefully won't be too terribly busy, with reasonable pauses between each change.

What we need to do to make things fade in together is to make sure they have the same D3 transition delay.

Let's do the lines first.
They're all drawn from one data set but we need 3 transisions for the three year groups.
This doesn't mean we'll need to draw the three sets separately, though.
All that differentiates the groups is how long to wait before fading in.
And like all other d3 helper functions, we can make the delay a function of the year the line represents.
We'll choose the same delay for each line in a group to get them to all fade in as a group.

For everything we're going to fade, we have to write:

```js
elements
  .style("opacity", 0)
  .transition()
    .delay( some number )
      .style("opacity", 1);
```

That's 4 lines per thing, and we've got a lot of things! That's a lot of lines!

Wouldn't it be nice if we could define these 4 lines once, then reuse them for our elements?
We can do exactly that using d3's [`selection.call`](https://github.com/mbostock/d3/wiki/Selections#call) method.
It lets us put those 4 transition lines in a helper, then with `call`, we can invoke them on the context with any parameters we need, or in our case, how long to delay.

```js
chart.selectAll(".year-line")
// ...snip...
	.call(fade, function(d) {
		if (d == 2015)
			return group.nrt_data;
		if (d <= 2014 && d >= 2010)
			return group.recent_data;
		return group.old_data;
	});
```

I've also defined a little "transition group" helper object, so we can tweak the animation timings later in just one place instead of having to carefully find/replace across the program.

```js
var group = {
	old_data: 0,
	recent_data: 4000,
	nrt_data: 8000,
	key_points: 12000,
};
```

Fin.

>> See the final product in action here: http://factormystic.net/utils/data-vis/arctic-ice/
