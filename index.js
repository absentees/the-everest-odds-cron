#!/usr/bin/env node

require('dotenv').config();
var Xray = require('x-ray');
var x = Xray();
var async = require('async');
var Airtable = require('airtable');
Airtable.configure({
	endpointUrl: 'https://api.airtable.com',
	apiKey: process.env.AIRTABLE_API_KEY
});
var base = Airtable.base(process.env.AIRTABLE_BASE_ID);

function scrapeOdds(horses, callback) {
	x('https://www.sportsbet.com.au/horse-racing/futures-aus-nz/the-everest/the-everest-all-in-win-or-each-way-3144278.html', '.racing-bettype-row', [{
		name: '.racer-name',
		win: '.price_box_str'
	}])(function (err, scrapedResults) {
		if (err) {
			console.log(`Something went wrong scraping odds: ${err}`);
		}

		scrapedResults = scrapedResults.map((horse) => {
			return {
				name: horse.name,
				win: parseFloat(horse.win)
			}
		});

		callback(null, horses, scrapedResults);
	});
}

function getAirtableRecords(callback) {
	var results = [];

	base('Horses').select({
		view: "Grid view"
	}).eachPage(function page(records, fetchNextPage) {
		records.forEach(function (record) {
			results.push({
				id: record.id,
				name: record.get('Name'),
				win: record.get('Win (Sportsbet)'),
			});
		});
		fetchNextPage();

	}, function done(err) {
		if (err) {
			console.log(`Something went wrong getting records: ${err}`);
		}

		return callback(null, results);
	});
}

function matchHorses(horses, scrapedResults, callback) {
	horses.forEach(function(horse){
		for (var i = 0; i < scrapedResults.length; i++) {
			if (horse.name == scrapedResults[i].name) {
				horse.win = scrapedResults[i].win;
			}
		}
	});

	callback(null, horses);
}

function updateAirtable(horses, callback) {
	console.log('Uploading odds to Airtable');

	horses.forEach(function(horse){
		base('Horses').update(horse.id, {
			"Win (Sportsbet)" : horse.win
		}, function(err, record) {
			if (err) {
				console.log(`Something went wrong updating record: ${err}`);
			}
			console.log(record.get('Win (Sportsbet)'));
		})
	});



	callback(null, horses);
}

async.waterfall([
	getAirtableRecords,
	scrapeOdds,
	matchHorses,
	updateAirtable
], (err, results) => {
	if (err) {
		console.log(`Something went wrong: ${err}`);
	}

	console.log(results);

});
