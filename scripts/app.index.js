/// <reference path="../js/jquery.min.js" />
/// <reference path="../vsdoc/kendo.mobile-vsdoc.js" />

var swimmersUrl = 'http://mobile.dsv.de/json/getswimmers?firstname={0}&lastname={1}';
var recordsUrl = 'http://mobile.dsv.de/json/getrecords?swimmerid={0}';

var events = []; events[0] = "25F"; events[1] = "50F"; events[2] = "100F"; events[3] = "200F"; events[4] = "400F"; events[5] = "800F"; events[6] = "1500F"; events[7] = "25B"; events[8] = "50B"; events[9] = "100B"; events[10] = "200B"; events[11] = "25R"; events[12] = "50R"; events[13] = "100R"; events[14] = "200R"; events[15] = "25S"; events[16] = "50S"; events[17] = "100S"; events[18] = "200S"; events[19] = "100L"; events[20] = "200L"; events[21] = "400L";

var store;
var currentSwimmer = {};
var currentSwimmerName = "-";
var currentSwimmerRecords = {};
var currentLocalSwimmerData = {};
var foundSwimmers = {};

$(document).ready(function ($) {
	$.support.cors = true;
	
	window.addEventListener('load', function (e) {
		if (window.applicationCache) {
			window.applicationCache.addEventListener('updateready', function (e) {
				if (window.applicationCache.status == window.applicationCache.UPDATEREADY) {
					console.log('Browser downloaded a new app cache.');

					window.applicationCache.swapCache();
					if (confirm('Neue Version vorhanden - jetzt laden?')) {
						window.location.reload();
					}
				} else {
					console.log('Manifest didnt change.');
				}
			}, false);
		}
	}, false);

	store = new Lawnchair({ name: 'swimrec', adapter: 'dom' }, function () {
	});

	$('#addFavorite').click(function () {
		saveFavorite();
	});

	$('#refreshFavs').click(function () {
		refreshFavoritesRecords();
	});

	$('#searchSwimmer').click(function () {
		searchSwimmers();
	});
	
	toastr.options = {
        positionClass: 'toast-top-left'
    };
    NotifierjsConfig.defaultTimeOut = 1250;
    NotifierjsConfig.position = ["top", "left"];
});

function showLoader(displayText) {
	kendoMobileApplication.pane.loader.element.find("h1").removeClass("loaderHeading").text(displayText);
	kendoMobileApplication.showLoading();
}

function hideLoader() {
	kendoMobileApplication.hideLoading();
}

function resultsViewInit() {
	var listviews = this.element.find("ul.km-listview");

	$("#laneSelect").kendoMobileButtonGroup({
		select: function () {
			listviews.hide()
					 .eq(this.selectedIndex)
					 .show();
		},
		index: 0
	});
}

function showDialog(dialogPage) {
	$('#' + dialogPage).data("kendoMobileModalView").open();
}

function closeModalView(e) {
	// find the closest modal view, relative to the button element.
	var modalView = e.sender.element.closest("[data-role=modalview]").data("kendoMobileModalView");
	modalView.close();
}

function clearFavoritesFromModalView(e) {
	clearFavorites();
	closeModalView(e);
}

function saveFavorite() {
	var key = 'Swimmer_' + currentSwimmer.SwimmerID + '_Data';

	currentLocalSwimmerData.Swimmer = currentSwimmer;
	currentLocalSwimmerData.Records = currentSwimmerRecords;

	store.save({ key: key, localSwimmer: currentLocalSwimmerData }, function (obj) {
	    //toastr.success(currentSwimmerName, 'Gespeichert.');
	    Notifier.success(currentSwimmerName, 'Gespeichert.');
	});
};

function loadFavorites(e) {
	var favorites = [];

	store.each(function (record, index) {
		var fav = {
			SwimmerID: record.localSwimmer.Swimmer.SwimmerID,
			Firstname: record.localSwimmer.Swimmer.Firstname,
			Lastname: record.localSwimmer.Swimmer.Lastname
		};

		favorites.push(fav);
	});

	var sortedFavorites = _.sortBy(favorites, function (favorite) { return favorite.Firstname });

	var kendoTemplate = kendo.template($("#favoritesTemplate").text());
	$("#favoritesSwimmer").html(kendoTemplate(sortedFavorites));
	kendo.mobile.init($("#favoritesSwimmer"));
};

function clearFavorites(e) {
	store.nuke();
	$('#favoritesSwimmer li').remove();
};

function displayFavorite(swimmerId) {
	var key = 'Swimmer_' + swimmerId + '_Data';

	store.get(key, function (record) {
		currentSwimmer = record.localSwimmer.Swimmer;
		currentSwimmerRecords = record.localSwimmer.Records;
		currentSwimmerName = currentSwimmer.Firstname + ' ' + currentSwimmer.Lastname;

		window.kendoMobileApplication.navigate("#recordsResultsPage");

		bindSwimmer(currentSwimmerRecords);
		bindRecordsTables(currentSwimmerRecords);
	});
}

function refreshFavoritesRecords() {
	showLoader("Aktualisiere..");

	var deferreds = refreshFavoritesRecordsCore();

	$.when.apply(null, deferreds).done(function () {
		hideLoader();
	});
};

function refreshFavoritesRecordsCore() {
	var deferreds = [];

	store.each(function (record, index) {
		var swimmerId = record.localSwimmer.Swimmer.SwimmerID;
		var url = recordsUrl.replace('{0}', swimmerId);

		deferreds.push(
			$.ajax({
				url: url,
				cache: false,
				type: "GET",
				processData: false,
				contentType: "application/json; charset=utf-8",
				error: function (data) {
					hideLoader();
					alert(data);
				},
				success: function (serverData) {
					//hideLoader();

					record.localSwimmer.Records = serverData;

					store.save({ key: record.key, localSwimmer: record.localSwimmer }, function (obj) {
					});
				}
			})
		);
	});

	return deferreds;
}

function searchSwimmers() {
	showLoader("Suche...");

	var swimmerName = $('#search').val().split(' ');
	var firstName = swimmerName[0];
	var lastName = swimmerName[1];

	var url = swimmersUrl.replace('{0}', firstName).replace('{1}', lastName);

	$.ajax({
		url: url,
		cache: false,
		type: "GET",
		dataType: "json",
		contentType: "application/json; charset=utf-8",
		error: function (data) {
			hideLoader();
			showDialog('serviceErrorDialog');
			//alert('Server kann nicht erreicht werden.');
		},
		success: function (serverData) {
			foundSwimmers = serverData;
			currentSwimmerName = firstName + ' ' + lastName;

			if (foundSwimmers == null || foundSwimmers == "") {
				showDialog('swimmerErrorDialog');
				hideLoader();
				//alert("Schwimmer nicht gefunden.");
				return;
			}

			if (foundSwimmers.length > 1) {				
				var kendoTemplate = kendo.template($("#swimmersTemplate").text());
				$("#searchResultList").html(kendoTemplate(foundSwimmers));
				kendo.mobile.init($("#searchResultList"));

				hideLoader();

				window.kendoMobileApplication.navigate("#swimmerResultsPage");
			}
			else {
				searchRecords(foundSwimmers[0].SwimmerID, false, true);
			}
		}
	});
};

function searchRecords(swimmerId, loader, display) {
	if (loader) {
		showLoader("Suche...");
	}

	var url = recordsUrl.replace('{0}', swimmerId);

	$.ajax({
		url: url,
		cache: false,
		type: "GET",
		processData: false,
		contentType: "application/json; charset=utf-8",
		error: function (data) {
			hideLoader();
			showDialog('serviceErrorDialog');
			//alert('Server kann nicht erreicht werden.');
		},
		success: function (serverData) {			
			currentSwimmer = _.find(foundSwimmers, function (n) { return n.SwimmerID == swimmerId; });
			currentSwimmerRecords = serverData;

			if (display) {
				window.kendoMobileApplication.navigate("#recordsResultsPage");

				bindSwimmer(currentSwimmerRecords);
				bindRecordsTables(currentSwimmerRecords);
            }

            hideLoader();
		}
	});
};

function bindSwimmer(swimmerRecordsData) {
	$("#currentSwimmerRecords").text(currentSwimmerName);
}

function bindRecordsTables(swimmerRecordsData) {
	var times25m = swimmerRecordsData[0].Times;
	var times50m = swimmerRecordsData[1].Times;
	var combined = [];
	var i = 0;

	times25m.forEach(function (time25m) {
		if (((time25m < times50m[i]) && time25m != '') || times50m[i] == '') {
			combined.push(time25m);
		}
		else {
			combined.push(times50m[i]);
		}

		i++;
	});

	var kendoTemplate = kendo.template($("#resultsTemplate").text());

	$("#recordsList25m").html(kendoTemplate(times25m));
	$("#recordsList50m").html(kendoTemplate(times50m));
	$("#recordsListTotal").html(kendoTemplate(combined));

	kendo.mobile.init($("#recordsList25m"));
	kendo.mobile.init($("#recordsList50m"));
	kendo.mobile.init($("#recordsListTotal"));
}
