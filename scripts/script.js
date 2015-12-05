/**
 * Created by Harshit on 11/10/2015.
 */

const DATA_FILENAME = "data/flu_trends_data - 2003.csv";
const MAPDATA_FILENAME = "data/us.json";
const REGIONS_FILENAME = "data/flu_trends_data_regions.csv";
const YEAR_START = 2004;
const YEAR_END = 2014;

var yearsData = {};
var seasonsData = {};
var statesData = [];
var yearStatesData = {};
var regionsData = {};
var monthsData = {};
var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var selectedStates = [];
var selectedCities = [];
var statesFluAggregate = {};
var colorScale;
var stateCodes = {};
var selectedYear = "2009";
var selectedStatesSeasonData = [];
var stateIdNameMap = {};
var mapData = [];
var cities = {};
var codeStates = {};
var regions = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10'];
var regionStates = {
    R1: "CT, ME, MA, NH, RI, VT",
    R2: "NJ, NY",
    R3: "DE, DC, MD, PA, VA, WV",
    R4: "AL, FL, GA, KY, MS, NC, SC, TN",
    R5: "IL, IN, MI, MN, OH, WI",
    R6: "AR, LA, NM, OK, TX",
    R7: "IA, KS, MO, NE",
    R8: "CO, MT, ND, SD, UT, WY",
    R9: "AZ, CA, HI, NV",
    R10: "AK, ID, OR, WA"
};

var seasonsSVG;
var pieChartSVG;
var years = ['year', '2004', '2005', '2006', '2007', '2008', '2009', '2010', '2011', '2012', '2013', '2014'];
var patternData = [];

function loadData() {
    d3.csv("data/us_state_codes.csv", function (d) {
        d.forEach(function (kvp) {
            stateCodes[kvp.Code] = kvp.State;
            codeStates[kvp.State] = kvp.Code;
            cities[kvp.State] = [];
        });
    });

    d3.tsv("data/us-state-names.tsv", function (d) {
        d.forEach(function (key) {
            stateIdNameMap[key.id] = [key.code, key.name];
        });

        for (var i = 1; i <= 78; i++) {
            //uStatePaths[i]["Value"] = {};
            //yearStatesData[uStatePaths[i]["n"]] = {}
            if (stateIdNameMap[i] != undefined) {
                yearStatesData[stateIdNameMap[i][1]] = {};
                for (var j = YEAR_START; j <= YEAR_END; j++) {
                    //uStatePaths[i]["Value"][j] = 0;
                    yearStatesData[stateIdNameMap[i][1]][j] = 0;
                }
            }
        }
    });


    queue()
        .defer(d3.csv, DATA_FILENAME, function (d) {
            //console.log(d);
            var sumPerRecord = 0;
            var currentYearSeasonData = [];
            var currentDate;
            sumPerRecord = 0;
            currentDate = "";
            var currentYear = d["Date"].substring(d["Date"].lastIndexOf("/") + 1);
            var itr = 0;
            for (var key in d) {
                if (d.hasOwnProperty(key)) {
                    if ((key == 'Date'))
                        currentDate = d[key];
                    else if (key != "United States")
                        sumPerRecord += parseInt(d[key]);

                    var commaIndex = key.indexOf(',');
                    var stateName = undefined;
                    if (commaIndex > 0 && currentYear >= YEAR_START && currentYear <= YEAR_END) {
                        stateName = stateCodes[key.substring(commaIndex + 2)];
                    }
                    else if (key != "Date" && key != "United States" && currentYear >= YEAR_START && currentYear <= YEAR_END)
                        stateName = key;

                    if (stateName != undefined && yearStatesData[stateName].hasOwnProperty(parseInt(currentYear)))
                        yearStatesData[stateName][parseInt(currentYear)] += parseInt(d[key]);
                }
                if (key != "Date" && key != "United States") {
                    if (typeof statesFluAggregate[key] === 'undefined')
                        statesFluAggregate[key] = 0;
                    else
                        statesFluAggregate[key] += parseInt(d[key]);
                }

                //**seasons data********

                var currentPlace = {};
                if (key != "Date" && key != "United States") {
                    currentPlace['place'] = key;
                    currentPlace['value'] = d[key];
                    currentYearSeasonData.push(currentPlace);
                }
                //**********************

                //****cities************
                if (key.indexOf(',') > -1) {
                    var arr = key.split(", ");
                    var currentCities = cities[stateCodes[arr[1]]];
                    if (currentCities.indexOf(key) < 0)
                        currentCities.push(key);
                    cities[arr[0]] = currentCities;
                }
                //**********************
            }
            yearsData[currentDate] = sumPerRecord;
            seasonsData[currentDate] = currentYearSeasonData;
        })
        .defer(d3.json, MAPDATA_FILENAME)
        .defer(d3.csv, REGIONS_FILENAME, function (d) {
            var currentDate;
            var regionsArr = [];
            for (var key in d) {
                if (key == "Date")
                    currentDate = new Date(d[key]);
            }
            if (regionsData[parseInt(currentDate.getYear() + 1900)] === undefined) {
                for (var key in d) {
                    if (key != "Date") {

                        regionsArr.push(d[key]);
                    }
                }
                regionsData[parseInt(currentDate.getYear() + 1900)] = regionsArr;
            }
            else {
                var arr = regionsData[[parseInt(currentDate.getYear() + 1900)]];
                var count = 0;
                for (var key in d) {
                    if (key != "Date") {
                        arr[count] = parseInt(arr[count]) + parseInt(d[key]);
                        count++;
                    }
                }
                regionsData[[parseInt(currentDate.getYear() + 1900)]] = arr;
            }
        })
        //.defer(d3.tsv, "data/us-state-names.tsv")
        .await(loadMonthData);
}


//returns month wise data for the given year
function loadMonthData(error, yearData, usStateData) {

    if (error) {
        throw error;
    }

    mapData = topojson.feature(usStateData, usStateData.objects.states).features;
    mapData.forEach(function (d) {
        var id = d.id;
        d["StateName"] = stateIdNameMap[id][1];
        d["StateCode"] = stateIdNameMap[id][0];
        d["Value"] = yearStatesData[stateIdNameMap[id][1]];
    });

    drawMap();

    var year = "";
    var currentMonthData = [];
    for (var j = YEAR_START; j <= YEAR_END; j++) {
        //initializing array values
        for (var i = 0; i < 12; i++) {
            currentMonthData[i] = 0;
        }
        year = j;
        for (var key in yearsData) {
            if (key.indexOf(year) > -1) {
                var currentDate = new Date(key);
                var currentValue = currentMonthData[parseInt(currentDate.getMonth())];
                currentMonthData[currentDate.getMonth()] = currentValue + yearsData[key];
            }
        }
        monthsData[year] = currentMonthData;
        currentMonthData = [];
    }

    updateMonthBarChart("2009");
    updateRegionBarChart("2009");
    updateDonutChart(selectedStates);
    updateStackedChart("2009", selectedStates);
    d3.select("#year1").html(selectedYear);
    d3.select("#year2").html(selectedYear);
    d3.select("#year3").html(selectedYear);
    d3.select("#year4").html(selectedYear);
    patternData.push(years);
    updatePatternChart();
}

function drawMap() {
    max = 0;
    min = 99999999;
    year = document.getElementById("year").value;
    mapData.forEach(function (key) {
        if (key["Value"][year] > max) {
            max = key["Value"][year];
        }
        if (key["StateName"] != "Puerto Rico" && key["StateName"] != "Virgin Islands of the United States" && key["Value"][year] < min) {
            min = key["Value"][year];
        }
    });

    var legend = d3.select("#legend");
    var lblMinValue = legend.select("#minValue");
    lblMinValue.text(min.toString());
    var lblMaxValue = legend.select("#maxValue");
    lblMaxValue.text(max.toString());

    colorScale = d3.scale.ordinal()
        .domain([min, max])
        .range(["rgb(198, 219, 239)", "rgb(158, 202, 225)", "rgb(107, 174, 214)", "rgb(49,130,189)"]);

    var map = d3.select("#map");
    var states = d3.selectAll("#states");
    var projection = d3.geo.albersUsa()
        .scale(800)
        .translate([300, 180]);
    var path = d3.geo.path().projection(projection);

    map.html("");

    console.log(max + " " + min);
    map.append("g")
        .selectAll("path")
        .data(mapData)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("stroke", "white")
        .attr("class", "states")
        .style("fill", function (d) {
            if (selectedStates.indexOf(d["StateName"]) < 0) {
                year = document.getElementById("year").value;
                return colorScale(d["Value"][parseInt(year)]);
            }
            else {
                return 'white';
            }
        })
        .on("mouseover", function (d) {
            year = document.getElementById("year").value;
            d3.select("#tooltip")
                .transition()
                .duration(200)
                .style("opacity", .9);

            d3.select("#tooltip")
                .html(showToolTip(d["StateName"], d["Value"][parseInt(year)]))
                .style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
        })
        .on("mouseout", function (d) {
            d3.select("#tooltip")
                .transition()
                .duration(500)
                .style("opacity", 0);
        })
        .on("click", function (d) {
            year = document.getElementById("year").value;
            if (this.style.fill != "white") {
                if (selectedStates.length < 5) {
                    this.style.fill = "white";
                    selectedStates[selectedStates.length] = d["StateName"];
                    seasonsSVG.html("");
                    selectedStatesSeasonData = [];
                    updateStackedChart(selectedYear, selectedStates);
                    updateDonutChart(selectedStates);
                    for (var i = 0; i < selectedStates.length; i++) {
                        var currentSet = [];
                        for (var j = 0; j < mapData.length; j++) {
                            if (mapData[j]['StateName'] == selectedStates[i]) {

                                //console.log(mapData[j]['Value']);

                                currentSet.push(mapData[j]['StateName']);
                                for (var key in mapData[j]['Value']) {
                                    currentSet.push(mapData[j]['Value'][key])
                                }
                            }
                        }
                        patternData.push(currentSet);
                    }
                    updatePatternChart();
                }
                else {
                    alert("Only 5 selections are allowed. Please deselect and try again.");
                }
            }
            else {
                this.style.fill = colorScale(d["Value"][parseInt(year)]);
                var index = selectedStates.indexOf(d["StateName"]);
                selectedStates.splice(index, 1);
                seasonsSVG.html("");
                selectedStatesSeasonData = [];
                updateStackedChart(selectedYear, selectedStates);
                updateDonutChart(selectedStates);
                patternData = [];
                patternData.push(years);
                for (var i = 0; i < selectedStates.length; i++) {
                    var currentSet = [];
                    for (var j = 0; j < mapData.length; j++) {
                        if (mapData[j]['StateName'] == selectedStates[i]) {
                            //console.log(mapData[j]['Value']);
                            currentSet.push(mapData[j]['StateName']);
                            for (var key in mapData[j]['Value']) {
                                currentSet.push(mapData[j]['Value'][key])
                            }
                        }
                    }
                    patternData.push(currentSet);
                }
                updatePatternChart();
            }
            //alert(d["StateName"] + " was clicked");
            //console.log(selectedYear);
        });

    map.append("g")
        .selectAll("text")
        .data(mapData)
        .enter()
        .append("svg:text")
        .text(function (d) {
            return d["StateCode"];
        })
        .attr("x", function (d) {
            if (d["StateName"] != "Puerto Rico" && d["StateName"] != "Virgin Islands of the United States")
                return path.centroid(d)[0];
        })
        .attr("y", function (d) {
            if (d["StateName"] != "Puerto Rico" && d["StateName"] != "Virgin Islands of the United States")
                return path.centroid(d)[1];
        })
        .attr("text-anchor", "middle")
        .attr('fill', 'black');
}

//updates monthly bar chart
function updateMonthBarChart(year) {

    var margin = {top: 30, right: 30, bottom: 30, left: 40},
        width = 600 - margin.left - margin.right,
        height = 400 - margin.top - margin.bottom;
    var textHeight = 40;
    var textWidth = 40;
    var max = d3.max(monthsData[year], function (d) {
        return d;
    });
    var min = d3.min(monthsData[year], function (d) {
        return d;
    });

    var xScale = d3.scale.ordinal().rangeRoundBands([textWidth, 500], .1);
    xScale.domain(monthsData[year].map(function (d) {
        return d;
    }))
    var yScale = d3.scale.linear()
        .domain([0, max])
        .range([0, 300])
        .nice();


    var xAxisScale = d3.scale.ordinal().rangeRoundBands([textWidth, 500], .1);
    xAxisScale.domain(months.map(function (d) {
        return d;
    }))
    var xAxisG = d3.select("#xAxis");
    var xAxis = d3.svg.axis()
        .scale(xAxisScale)
        .orient("bottom");

    xAxisG
        .attr("class", "axis axis--x")
        .call(xAxis);

    var yAxisG = d3.select("#yAxis");
    var yScaleInverted = d3.scale.linear()
        .domain([max, 0])
        .range([0, 300])
        .nice();
    var yAxis = d3.svg.axis()
        .scale(yScaleInverted)
        .orient("left")
        .tickFormat(d3.format(".2s"));
    yAxisG
        .attr("class", "axis axis--y")
        .call(yAxis);


    var barchartG = d3.select("#monthBarChart")
        .attr({
            width: 600,
            height: 400
        })
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");


    var bars = d3.select("#bars")
        .selectAll("rect")
        .data(monthsData[year]);
    bars
        .enter()
        .append("rect");
    bars
        .attr("x", function (d, i) {
            return xScale(d);
        })
        .attr("y", margin.top + textHeight)
        .attr("height", function (d, i) {
            return yScale(d);
        })
        .attr("width", 25)
        .on("mouseover", function (d, i) {
            d3.select("#tooltip")
                .transition()
                .duration(200)
                .style("opacity", .9);

            d3.select("#tooltip")
                .html("Flu cases: " + d)
                .style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
        })
        .on("mouseout", function (d) {
            d3.select("#tooltip")
                .transition()
                .duration(500)
                .style("opacity", 0);
        });

    bars
        .exit()
        .remove();
}


function updateStackedChart(year, states) {
    var g = d3.select("#selectStateSeason");
    if (selectedStates.length > 0) {
        g.style("opacity", "0");
    }
    else {
        g.style("opacity", "1");
    }

    getSelectedStatesSeasonData(year, states);

    var margin = {top: 20, right: 20, bottom: 30, left: 40},
        width = 600 - margin.left - margin.right,
        height = 400 - margin.top - margin.bottom;

    var x = d3.scale.ordinal()
        .rangeRoundBands([0, width]);

    var y = d3.scale.linear()
        .rangeRound([height, 0]);

    var z = d3.scale.category20c();


    seasonsSVG = d3.select("#seasonsChart")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var seasons = ['winter', 'spring', 'summer', 'fall'];
    var layers = d3.layout.stack()(seasons.map(function (c) {
        return selectedStatesSeasonData.map(function (d) {
            return {x: d['place'], y: d[c]};
        });
    }));

    x.domain(layers[0].map(function (d) {
        return d.x;
    }));
    y.domain([0, d3.max(layers[layers.length - 1], function (d) {
        return d.y0 + d.y;
    })]).nice();

    var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom");

    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left")
        .tickFormat(d3.format(".2s"));

    var layer = seasonsSVG.selectAll(".layer")
        .data(layers)
        .enter().append("g")
        .attr("class", "layer")
        .style("fill", function (d, i) {
            return z(i);
        });


    layer.selectAll("rect")
        .data(function (d) {
            return d;
        })
        .enter().append("rect")
        .attr("x", function (d) {
            return x(d.x);
        })
        .attr("y", function (d) {
            return y(d.y + d.y0);
        })
        .attr("height", function (d) {
            return y(d.y0) - y(d.y + d.y0);
        })
        .attr("width", x.rangeBand() - 20)
        .attr("transform", "translate(10)")
        .on("click", function (d) {
            if (d['x'].indexOf(',') > -1) {
                seasonsSVG.html("");
                selectedStatesSeasonData = [];
                updateStackedChart(selectedYear, selectedStates);
            }
            else {
                selectedCities = cities[d['x']];
                if (selectedCities.length < 1) {
                    alert("No data for the cities of " + d['x']);
                    return;
                }
                if (selectedCities.length > 5) {
                    selectedCities.splice(5, selectedCities.length - 5);
                }
                seasonsSVG.html("");
                selectedStatesSeasonData = [];
                updateStackedChart(selectedYear, selectedCities);

            }
        })
        .on("mouseover", function (d) {
            d3.select("#tooltip")
                .transition()
                .duration(200)
                .style("opacity", .9);

            d3.select("#tooltip")
                .html("Flu cases: " + d.y)
                .style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
        })
        .on("mouseout", function (d) {
            d3.select("#tooltip")
                .transition()
                .duration(500)
                .style("opacity", 0);
        });


    var xAxisG = d3.select('#xAxisSeasons');
    xAxisG
        .attr("class", "axis axis--x")
        .call(xAxis);

    var yAxisG = d3.select('#yAxisSeasons');
    yAxisG
        .attr("class", "axis axis--y")
        .call(yAxis);

}

function getSelectedStatesSeasonData(year, states) {

    for (var j = 0; j < states.length; j++) {
        var tempObj = {};
        tempObj ['place'] = states[j];
        tempObj ['winter'] = 0;
        tempObj ['spring'] = 0;
        tempObj ['summer'] = 0;
        tempObj ['fall'] = 0;
        selectedStatesSeasonData.push(tempObj);
    }

    //console.log(seasonsData);
    //console.log(codeStates);
    for (var key in seasonsData) {
        if (key.indexOf(year) > -1) {
            var currentSet = seasonsData[key];
            for (var i = 0; i < currentSet.length; i++) {

                var splitArr1 = currentSet[i]['place'].split(",");
                var flag = false;
                if (splitArr1.length > 1) {
                    if (states.indexOf(stateCodes[splitArr1[1].trim()]) > -1)
                        flag = true;
                }
                if (states.indexOf(currentSet[i]['place']) > -1 || flag) {
                    var currentDate = new Date(key);

                    for (var k = 0; k < selectedStatesSeasonData.length; k++) {
                        var splitArr2 = currentSet[i]['place'].split(",")
                        var flag1 = false;
                        if (splitArr2.length > 1) {
                            if (splitArr2[1].trim() == codeStates[selectedStatesSeasonData[k]['place']])
                                flag1 = true;
                        }
                        if (currentSet[i]['place'] == selectedStatesSeasonData[k]['place'] || flag1) {
                            if (currentDate.getMonth() >= 0 && currentDate.getMonth() <= 2) {
                                selectedStatesSeasonData[k]['winter'] += parseInt(currentSet[i]['value']);
                            }
                            if (currentDate.getMonth() >= 3 && currentDate.getMonth() <= 5) {
                                selectedStatesSeasonData[k]['spring'] += parseInt(currentSet[i]['value']);
                            }
                            if (currentDate.getMonth() >= 6 && currentDate.getMonth() <= 8) {
                                selectedStatesSeasonData[k]['summer'] += parseInt(currentSet[i]['value']);
                            }
                            if (currentDate.getMonth() >= 9 && currentDate.getMonth() <= 11) {
                                selectedStatesSeasonData[k]['fall'] += parseInt(currentSet[i]['value']);
                            }
                        }
                    }
                }
            }
        }
    }

}

function updateDonutChart(states) {
    statesData = [];
    //console.log(statesFluAggregate);
    for (var k = 0; k < states.length; k++) {
        var obj = [];
        obj[0] = states[k];
        obj[1] = statesFluAggregate[states[k]];
        statesData.push(obj);
    }
    if (selectedStates.length < 1) {
        var chart = d3.select("#chart");
        chart.html("");
        var g = chart.append("g")
            .attr("style", "font-size: x-large");
        g.append("text")
            .text("Please select a state")
            .attr("style", "fill:red")
            .attr("transform", "translate(200,180)");
        return;
    }
    var chart = c3.generate({
        data: {
            bindto: '#chart',
            columns: statesData,
            type: 'donut'
        },
        legend: {
            position: 'right'
        },
        donut: {title: 'Flu Percentage'},
        tooltip: {
            format: {
                value: function (value) {
                    return value;
                }
            }
        }
    });

}

function updateCharts(year) {
    selectedYear = year;
    $('#yearSpan').text(year);
    updateMonthBarChart(year);
    updateRegionBarChart(year);
    selectedStatesSeasonData = [];
    statesData = [];
    seasonsSVG.html("");
    //console.log(selectedStates);
    updateStackedChart(year, selectedStates);
    drawMap();
    d3.select("#year2").html(selectedYear);
    d3.select("#year3").html(selectedYear);
    d3.select("#year4").html(selectedYear);

}

function showToolTip(n, d) {
    return "<h4>" + n + "</h4> Flu Cases: " + d;
}

function updateRegionBarChart(year) {

    var margin = {top: 30, right: 30, bottom: 30, left: 40},
        width = 600 - margin.left - margin.right,
        height = 400 - margin.top - margin.bottom;
    var textHeight = 40;
    var textWidth = 40;
    var max = d3.max(regionsData[year], function (d) {
        return d;
    });
    var min = d3.min(regionsData[year], function (d) {
        return d;
    });

    var xScale = d3.scale.ordinal().rangeRoundBands([textWidth, 500], .1);
    xScale.domain(regionsData[year].map(function (d) {
        return d;
    }))
    var yScale = d3.scale.linear()
        .domain([0, max])
        .range([0, 300])
        .nice();


    var xAxisScale = d3.scale.ordinal().rangeRoundBands([textWidth, 500], .1);
    xAxisScale.domain(regions.map(function (d) {
        return d;
    }))
    var xAxisG = d3.select("#xAxisRegion");
    var xAxis = d3.svg.axis()
        .scale(xAxisScale)
        .orient("bottom");

    xAxisG
        .attr("class", "axis axis--x")
        .call(xAxis);

    var yAxisG = d3.select("#yAxisRegion");
    var yScaleInverted = d3.scale.linear()
        .domain([max, 0])
        .range([0, 300])
        .nice();
    var yAxis = d3.svg.axis()
        .scale(yScaleInverted)
        .orient("left");
    yAxisG
        .attr("class", "axis axis--y")
        .call(yAxis);


    var barchartG = d3.select("#regionBarChart")
        .attr({
            width: 600,
            height: 400
        })
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");


    var bars = d3.select("#regionBars")
        .selectAll("rect")
        .data(regionsData[year]);
    bars
        .enter()
        .append("rect");
    bars
        .attr("x", function (d, i) {
            return xScale(d);
        })
        .attr("y", margin.top + textHeight)
        .attr("height", function (d, i) {
            return yScaleInverted(d);
        })
        .attr("width", 25)
        .on("mouseover", function (d, i) {
            d3.select("#tooltip")
                .transition()
                .duration(200)
                .style("opacity", .9);

            d3.select("#tooltip")
                .html(regionStates[regions[i]])
                .style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
        })
        .on("mouseout", function (d) {
            d3.select("#tooltip")
                .transition()
                .duration(500)
                .style("opacity", 0);
        });

    bars
        .exit()
        .remove();
}

function updatePatternChart() {
    if (selectedStates.length < 1) {
        var chart = d3.select("#patternChart");
        chart.html("");
        var g = chart.append("g")
            .attr("style", "font-size: x-large");
        g.append("text")
            .text("Please select a state")
            .attr("style", "fill:red")
            .attr("transform", "translate(200,180)");
        return;
    }
    var chart = c3.generate({
        size: {
            width: 550
        },
        bindto: '#patternChart',
        data: {
            x: 'year',
            columns: patternData
        },
        axis: {
            x: {
                tick: {
                    format: function (x) {
                        return x
                    }
                }
            },
            y: {
                tick: {
                    format: d3.format(".2s")
                }
            }
        },
    });
}








