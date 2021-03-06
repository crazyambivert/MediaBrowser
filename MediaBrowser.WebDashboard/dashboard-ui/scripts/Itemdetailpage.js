﻿(function ($, document, LibraryBrowser, window) {

    var currentItem;
    var sessionsPromise;

    function getSessionsPromise() {

        if (sessionsPromise == null) {
            sessionsPromise = ApiClient.getSessions();
        }

        return sessionsPromise;
    }

    function reload(page) {

        var id = getParameterByName('id');

        Dashboard.showLoadingMsg();

        ApiClient.getItem(Dashboard.getCurrentUserId(), id).done(function (item) {

            currentItem = item;

            renderHeader(page, item);

            $('#itemImage', page).html(LibraryBrowser.getDetailImageHtml(item));

            LibraryBrowser.renderName(item, $('.itemName', page));
            LibraryBrowser.renderParentName(item, $('.parentName', page));

            var context = getContext(item);
            setInitialCollapsibleState(page, item, context);
            renderDetails(page, item, context);
            LibraryBrowser.renderDetailPageBackdrop(page, item);

            if (MediaPlayer.canPlay(item)) {
                $('#playButtonContainer', page).show();
            } else {
                $('#playButtonContainer', page).hide();
            }

            Dashboard.getCurrentUser().done(function (user) {

                if (user.Configuration.IsAdministrator) {
                    $('#editButtonContainer', page).show();
                } else {
                    $('#editButtonContainer', page).hide();
                }

            });

            $(".autoNumeric").autoNumeric('init');

            if (ApiClient.isWebSocketOpen()) {
                ApiClient.sendWebSocketMessage("Context", [item.Type, item.Id, context].join('|'));
            }

            Dashboard.hideLoadingMsg();
        });
    }

    function getContext(item) {

        // should return either movies, tv, music or games

        if (item.Type == "Episode" || item.Type == "Series" || item.Type == "Season") {
            return "tv";
        }
        if (item.Type == "Movie" || item.Type == "Trailer" || item.Type == "BoxSet") {
            return "movies";
        }
        if (item.Type == "Audio" || item.Type == "MusicAlbum" || item.Type == "MusicArtist" || item.Type == "Artist") {
            return "music";
        }
        if (item.MediaType == "Game") {
            return "games";
        }
        return "";
    }

    function renderHeader(page, item) {

        $('.itemTabs', page).hide();

        if (item.Type == "MusicAlbum") {
            $('#albumTabs', page).show();
        }

        if (item.Type == "Audio") {
            $('#songTabs', page).show();
        }

        if (item.Type == "Movie") {
            $('#movieTabs', page).show();
        }

        if (item.MediaType == "Game") {
            $('#gameTabs', page).show();
        }

        if (item.Type == "GamePlatform") {
            $('#gameSystemTabs', page).show();
        }

        if (item.Type == "BoxSet") {
            $('#boxsetTabs', page).show();
        }

        if (item.Type == "Trailer") {
            $('#trailerTabs', page).show();
        }

        if (item.Type == "Episode" || item.Type == "Season" || item.Type == "Series") {
            $('#tvShowsTabs', page).show();
        }
    }

    function setInitialCollapsibleState(page, item, context) {

        if (item.ChildCount) {
            $('#childrenCollapsible', page).removeClass('hide');
            renderChildren(page, item);
        }
        else {
            $('#childrenCollapsible', page).addClass('hide');
        }
        if (LibraryBrowser.shouldDisplayGallery(item)) {
            $('#galleryCollapsible', page).show();
            renderGallery(page, item);
        } else {
            $('#galleryCollapsible', page).hide();
        }

        if (item.MediaStreams && item.MediaStreams.length) {
            renderMediaInfo(page, item);
        }
        if (!item.Chapters || !item.Chapters.length) {
            $('#scenesCollapsible', page).hide();
        } else {
            $('#scenesCollapsible', page).show();
            renderScenes(page, item, 6);
        }
        if (!item.LocalTrailerCount || item.LocalTrailerCount == 0) {
            $('#trailersCollapsible', page).addClass('hide');
        } else {
            $('#trailersCollapsible', page).removeClass('hide');
            renderTrailers(page, item);
        }
        if (!item.SpecialFeatureCount || item.SpecialFeatureCount == 0) {
            $('#specialsCollapsible', page).addClass('hide');
        } else {
            $('#specialsCollapsible', page).removeClass('hide');
            renderSpecials(page, item, 6);
        }
        if (!item.People || !item.People.length) {
            $('#castCollapsible', page).hide();
        } else {
            $('#castCollapsible', page).show();
            renderCast(page, item, context, 10);
        }

        $('#themeSongsCollapsible', page).hide();
        $('#themeVideosCollapsible', page).hide();

        ApiClient.getThemeSongs(Dashboard.getCurrentUserId(), item.Id).done(function (result) {
            renderThemeSongs(page, item, result);
        });

        ApiClient.getThemeVideos(Dashboard.getCurrentUserId(), item.Id).done(function (result) {
            renderThemeVideos(page, item, result);
        });

        renderCriticReviews(page, item, 1);
    }

    function renderDetails(page, item, context) {

        if (item.Taglines && item.Taglines.length) {
            $('#itemTagline', page).html(item.Taglines[0]).show();
        } else {
            $('#itemTagline', page).hide();
        }

        LibraryBrowser.renderOverview($('.itemOverview', page), item);

        if (item.CommunityRating || item.CriticRating) {
            $('.itemCommunityRating', page).html(LibraryBrowser.getRatingHtml(item)).show();
        } else {
            $('.itemCommunityRating', page).hide();
        }

        if (item.Type != "Episode" && item.Type != "Movie") {
            var premiereDateElem = $('#itemPremiereDate', page).show();
            LibraryBrowser.renderPremiereDate(premiereDateElem, item);
        } else {
            $('#itemPremiereDate', page).hide();
        }

        LibraryBrowser.renderBudget($('#itemBudget', page), item);
        LibraryBrowser.renderRevenue($('#itemRevenue', page), item);

        $('.itemMiscInfo', page).html(LibraryBrowser.getMiscInfoHtml(item));

        LibraryBrowser.renderGenres($('.itemGenres', page), item, context);
        LibraryBrowser.renderStudios($('.itemStudios', page), item, context);
        renderUserDataIcons(page, item);
        LibraryBrowser.renderLinks($('.itemExternalLinks', page), item);

        $('.criticRatingScore', page).html((item.CriticRating || '0') + '%');

        if (item.CriticRatingSummary) {
            $('#criticRatingSummary', page).show();
            $('.criticRatingSummaryText', page).html(item.CriticRatingSummary);

        } else {
            $('#criticRatingSummary', page).hide();
        }

        renderTags(page, item);

        var detailsSection = $('#detailsSection', page);
        var elem = $('.detailSectionContent', detailsSection)[0];
        var text = elem.textContent || elem.innerText;

        if (!text.trim()) {
            detailsSection.addClass('hide');
        } else {
            detailsSection.removeClass('hide');
        }

        renderSeriesAirTime(page, item, context);
        renderSimiliarItems(page, item);

        if (item.Players) {
            $('#players', page).show().html(item.Players + ' Player');
        } else {
            $('#players', page).hide();
        }

        if (item.Type == "Audio" && item.Artists && item.Artists.length) {
            $('#artist', page).show().html('Artist:&nbsp;&nbsp;<a class="textlink" href="itembynamedetails.html?context=music&artist=' + ApiClient.encodeName(item.Artists[0]) + '">' + item.Artists[0] + '</a>').trigger('create');
        } else {
            $('#artist', page).hide();
        }
    }

    function renderSimiliarItems(page, item) {

        if (item.Type != "Movie" &&
            item.Type != "Trailer" &&
            item.Type != "MusicAlbum" &&
            item.Type != "Series" &&
            item.MediaType != "Game") {

            $('#similarCollapsible', page).hide();
            return;
        }

        ApiClient.getSimilarItems(item.Id, {

            userId: Dashboard.getCurrentUserId(),
            limit: item.Type == "MusicAlbum" ? 6 : 8

        }).done(function (result) {

            if (!result.Items.length) {

                $('#similarCollapsible', page).hide();
                return;
            }

            var elem = $('#similarCollapsible', page).show();

            $('.detailSectionHeader', elem).html('If you like ' + item.Name + ', check these out...');

            var html = LibraryBrowser.getPosterViewHtml({
                items: result.Items,
                useAverageAspectRatio: item.MediaType != "Game",
                showNewIndicator: true,
                shape: item.Type == "MusicAlbum" ? "square" : "portrait"
            });

            $('#similarContent', page).html(html);
        });
    }

    function renderSeriesAirTime(page, item, context) {

        if (item.Type != "Series") {
            $('#seriesAirTime', page).hide();
            return;
        }

        var html = item.Status == 'Ended' ? 'Aired' : 'Airs';

        if (item.AirDays && item.AirDays.length) {
            html += item.AirDays.length == 7 ? 'daily' : ' ' + item.AirDays.map(function (a) {
                return a + "s";

            }).join(',');
        }

        if (item.Studios.length) {
            html += ' on <a class="textlink" href="itembynamedetails.html?context=' + context + '&studio=' + ApiClient.encodeName(item.Studios[0].Name) + '">' + item.Studios[0].Name + '</a>';
        }

        if (item.AirTime) {
            html += ' at ' + item.AirTime;
        }

        $('#seriesAirTime', page).show().html(html).trigger('create');
    }

    function renderTags(page, item) {

        if (item.Tags && item.Tags.length) {

            var html = '';

            for (var i = 0, length = item.Tags.length; i < length; i++) {

                html += '<div class="itemTag">' + item.Tags[i] + '</div>';

            }

            $('.itemTags', page).show().html(html);

        } else {
            $('.itemTags', page).hide();
        }
    }

    function renderChildren(page, item) {
        var sortBy = item.Type == "Boxset" ? "ProductionYear,SortName" : "SortName";

        ApiClient.getItems(Dashboard.getCurrentUserId(), {

            ParentId: getParameterByName('id'),
            SortBy: sortBy,
            Fields: "PrimaryImageAspectRatio,ItemCounts,DisplayMediaType,DateCreated,UserData,AudioInfo"

        }).done(function (result) {

            if (item.Type == "MusicAlbum") {

                $('#childrenContent', page).html(LibraryBrowser.getSongTableHtml(result.Items, { showArtist: true })).trigger('create');

            } else {

                var shape = "smallPoster";

                if (item.Type == "Season") {
                    shape = "smallBackdrop";
                }

                var html = LibraryBrowser.getPosterDetailViewHtml({
                    items: result.Items,
                    useAverageAspectRatio: true,
                    shape: shape
                });

                $('#childrenContent', page).html(html);

            }
        });

        if (item.Type == "Season") {
            $('#childrenTitle', page).html('Episodes (' + item.ChildCount + ')');
        }
        else if (item.Type == "Series") {
            $('#childrenTitle', page).html('Seasons (' + item.ChildCount + ')');
        }
        else if (item.Type == "BoxSet") {
            $('#childrenTitle', page).html('Movies (' + item.ChildCount + ')');
        }
        else if (item.Type == "MusicAlbum") {
            $('#childrenTitle', page).html('Tracks (' + item.ChildCount + ')');
        }
        else if (item.Type == "GamePlatform") {
            $('#childrenTitle', page).html('Games (' + item.ChildCount + ')');
        }
        else {
            $('#childrenTitle', page).html('Items (' + item.ChildCount + ')');
        }
    }
    function renderUserDataIcons(page, item) {
        $('.userDataIcons', page).html(LibraryBrowser.getUserDataIconsHtml(item));
    }

    function renderCriticReviews(page, item, limit) {

        var options = {};

        if (limit) {
            options.limit = limit;
        }

        ApiClient.getCriticReviews(item.Id, options).done(function (result) {

            if (result.TotalRecordCount || item.CriticRatingSummary) {
                $('#criticReviewsCollapsible', page).show();
                renderCriticReviewsContent(page, result, limit);
            } else {
                $('#criticReviewsCollapsible', page).hide();
            }
        });
    }

    function renderCriticReviewsContent(page, result, limit) {

        var html = '';

        var reviews = result.ItemReviews;

        for (var i = 0, length = reviews.length; i < length; i++) {

            var review = reviews[i];

            html += '<div class="criticReview">';

            html += '<div class="reviewScore">';


            if (review.Score != null) {
                html += review.Score;
            }
            else if (review.Likes != null) {

                if (review.Likes) {
                    html += '<img src="css/images/fresh.png" />';
                } else {
                    html += '<img src="css/images/rotten.png" />';
                }
            }

            html += '</div>';

            html += '<div class="reviewCaption">' + review.Caption + '</div>';

            var vals = [];

            if (review.ReviewerName) {
                vals.push(review.ReviewerName);
            }
            if (review.Publisher) {
                vals.push(review.Publisher);
            }

            html += '<div class="reviewerName">' + vals.join(', ') + '.';

            if (review.Date) {

                try {

                    var date = parseISO8601Date(review.Date, true).toLocaleDateString();

                    html += '<span class="reviewDate">' + date + '</span>';
                }
                catch (error) {

                }

            }

            html += '</div>';

            if (review.Url) {
                html += '<div class="reviewLink"><a class="textlink" href="' + review.Url + '" target="_blank">Full review</a></div>';
            }

            html += '</div>';
        }

        if (limit && result.TotalRecordCount > limit) {
            html += '<p style="margin: .5em 0 0;padding-left: .5em;"><button class="moreCriticReviews" data-inline="true" data-mini="true">More ...</button></p>';
        }

        $('#criticReviewsContent', page).html(html).trigger('create');
    }

    function renderThemeSongs(page, item, result) {

        if (result.Items.length) {

            $('#themeSongsCollapsible', page).show();

            $('#themeSongsContent', page).html(LibraryBrowser.getSongTableHtml(result.Items, { showArtist: true, showAlbum: true })).trigger('create');
        }
    }

    function renderThemeVideos(page, item, result) {

        if (result.Items.length) {

            $('#themeVideosCollapsible', page).show();

            $('#themeVideosContent', page).html(getVideosHtml(result.Items)).trigger('create');
        }
    }

    function renderScenes(page, item, limit) {
        var html = '';

        var chapters = item.Chapters || [];

        for (var i = 0, length = chapters.length; i < length; i++) {

            if (limit && i >= limit) {
                break;
            }

            var chapter = chapters[i];
            var chapterName = chapter.Name || "Chapter " + i;

            html += '<a class="posterItem smallBackdropPosterItem" href="#play-Chapter-' + i + '" onclick="ItemDetailPage.play(' + chapter.StartPositionTicks + ');">';

            var imgUrl;

            if (chapter.ImageTag) {

                imgUrl = ApiClient.getImageUrl(item.Id, {
                    width: 400,
                    tag: chapter.ImageTag,
                    type: "Chapter",
                    index: i
                });
            } else {
                imgUrl = "css/images/items/list/chapter.png";
            }

            html += '<div class="posterItemImage" style="background-image:url(\'' + imgUrl + '\');"></div>';

            html += '<div class="posterItemText">' + chapterName + '</div>';
            html += '<div class="posterItemText">';

            html += ticks_to_human(chapter.StartPositionTicks);

            html += '</div>';

            html += '</a>';
        }

        if (limit && chapters.length > limit) {
            html += '<p style="margin: .5em 0 0;padding-left: .5em;"><button class="moreScenes" data-inline="true" data-mini="true">More ...</button></p>';
        }

        $('#scenesContent', page).html(html).trigger('create');
    }

    function renderGallery(page, item) {

        var html = LibraryBrowser.getGalleryHtml(item);

        $('#galleryContent', page).html(html).trigger('create');
    }

    function renderMediaInfo(page, item) {

        var html = '';

        for (var i = 0, length = item.MediaStreams.length; i < length; i++) {

            var stream = item.MediaStreams[i];

            if (stream.Type == "Data") {
                continue;
            }

            var type;
            if (item.MediaType == "Audio" && stream.Type == "Video") {
                type = "Embedded Image";
            } else {
                type = stream.Type;
            }

            html += '<div class="mediaInfoStream">';

            html += '<span class="mediaInfoStreamType">' + type + ':</span>';

            var attributes = [];

            if (stream.Codec) {
                attributes.push('<span class="mediaInfoAttribute">' + stream.Codec + '</span>');
            }
            if (stream.Profile) {
                attributes.push('<span class="mediaInfoAttribute">' + stream.Profile + '</span>');
            }
            if (stream.Level) {
                attributes.push('<span class="mediaInfoAttribute">Level ' + stream.Level + '</span>');
            }
            if (stream.Language) {
                attributes.push('<span class="mediaInfoAttribute">' + stream.Language + '</span>');
            }

            if (stream.Width) {
                attributes.push('<span class="mediaInfoAttribute">' + stream.Width + '</span>');
            }

            if (stream.Height) {
                attributes.push('<span class="mediaInfoAttribute">' + stream.Height + '</span>');
            }

            if (stream.AspectRatio) {
                attributes.push('<span class="mediaInfoAttribute">' + stream.AspectRatio + '</span>');
            }

            if (stream.BitRate) {
                attributes.push('<span class="mediaInfoAttribute">' + (parseInt(stream.BitRate / 1000)) + ' kbps</span>');
            }

            if (stream.Channels) {
                attributes.push('<span class="mediaInfoAttribute">' + stream.Channels + ' ch</span>');
            }

            if (stream.SampleRate) {
                attributes.push('<span class="mediaInfoAttribute">' + stream.SampleRate + ' khz</span>');
            }

            var framerate = stream.AverageFrameRate || stream.RealFrameRate;

            if (framerate) {
                attributes.push('<span class="mediaInfoAttribute">' + framerate + '</span>');
            }

            if (stream.PixelFormat) {
                attributes.push('<span class="mediaInfoAttribute">' + stream.PixelFormat + '</span>');
            }

            if (stream.IsDefault) {
                attributes.push('<span class="mediaInfoAttribute">Default</span>');
            }
            if (stream.IsForced) {
                attributes.push('<span class="mediaInfoAttribute">Forced</span>');
            }
            if (stream.IsExternal) {
                attributes.push('<span class="mediaInfoAttribute">External</span>');
            }

            html += attributes.join('&nbsp;&#149;&nbsp;');

            html += '</div>';
        }

        $('#mediaInfoContent', page).html(html).trigger('create');
    }

    function getVideosHtml(items, limit, moreButtonClass) {

        var html = '';

        for (var i = 0, length = items.length; i < length; i++) {

            if (limit && i >= limit) {
                break;
            }

            var item = items[i];

            var cssClass = "posterItem smallBackdropPosterItem";

            html += '<a class="' + cssClass + '" href="#" onclick="MediaPlayer.playById(\'' + item.Id + '\');">';

            var imageTags = item.ImageTags || {};

            var imgUrl;

            if (imageTags.Primary) {

                imgUrl = ApiClient.getImageUrl(item.Id, {
                    maxwidth: 500,
                    tag: imageTags.Primary,
                    type: "primary"
                });

            } else {
                imgUrl = "css/images/items/detail/video.png";
            }

            html += '<div class="posterItemImage" style="background-image:url(\'' + imgUrl + '\');"></div>';

            html += '<div class="posterItemText">' + item.Name + '</div>';
            html += '<div class="posterItemText">';

            if (item.RunTimeTicks != "") {
                html += ticks_to_human(item.RunTimeTicks);
            }
            else {
                html += "&nbsp;";
            }
            html += '</div>';

            html += '</a>';

        }

        if (limit && items.length > limit) {
            html += '<p style="margin: .5em 0 0;padding-left: .5em;"><button class="' + moreButtonClass + '" data-inline="true" data-mini="true">More ...</button></p>';
        }

        return html;
    }

    function renderSpecials(page, item, limit) {

        ApiClient.getSpecialFeatures(Dashboard.getCurrentUserId(), item.Id).done(function (specials) {

            $('#specialsContent', page).html(getVideosHtml(specials, limit, "moreSpecials")).trigger('create');

        });
    }

    function renderTrailers(page, item) {

        ApiClient.getLocalTrailers(Dashboard.getCurrentUserId(), item.Id).done(function (trailers) {

            $('#trailersContent', page).html(getVideosHtml(trailers));

        });
    }

    function renderCast(page, item, context, limit) {

        var html = '';

        var casts = item.People || [];

        for (var i = 0, length = casts.length; i < length; i++) {

            if (limit && i >= limit) {
                break;
            }

            var cast = casts[i];

            html += '<a class="tileItem smallPosterTileItem" href="itembynamedetails.html?context=' + context + '&person=' + ApiClient.encodeName(cast.Name) + '">';

            var imgUrl;

            if (cast.PrimaryImageTag) {

                imgUrl = ApiClient.getPersonImageUrl(cast.Name, {
                    width: 130,
                    tag: cast.PrimaryImageTag,
                    type: "primary"
                });

            } else {

                imgUrl = "css/images/items/list/person.png";
            }

            html += '<div class="tileImage" style="background-image:url(\'' + imgUrl + '\');"></div>';



            html += '<div class="tileContent">';

            html += '<p>' + cast.Name + '</p>';

            var role = cast.Role ? "as " + cast.Role : cast.Type;
            
            if (role == "GuestStar") {
                role = "Guest star";
            }

            html += '<p>' + (role || "") + '</p>';

            html += '</div>';

            html += '</a>';
        }

        if (limit && casts.length > limit) {
            html += '<p style="margin: .5em 0 0;padding-left: .5em;"><button class="morePeople" data-inline="true" data-mini="true">More ...</button></p>';
        }

        $('#castContent', page).html(html).trigger('create');
    }

    function play(startPosition) {

        MediaPlayer.play([currentItem], startPosition);
    }

    $(document).on('pageinit', "#itemDetailPage", function () {

        var page = this;

        $('#btnPlay', page).on('click', function () {
            var userdata = currentItem.UserData || {};
            LibraryBrowser.showPlayMenu(this, currentItem.Id, currentItem.MediaType, userdata.PlaybackPositionTicks);
        });

        $('#btnEdit', page).on('click', function () {

            Dashboard.navigate("edititemimages.html?id=" + currentItem.Id);
        });

    }).on('pageshow', "#itemDetailPage", function () {

        var page = this;

        $(page).on("click.moreScenes", ".moreScenes", function () {

            renderScenes(page, currentItem);

        }).on("click.morePeople", ".morePeople", function () {

            renderCast(page, currentItem, getContext(currentItem));

        }).on("click.moreSpecials", ".moreSpecials", function () {

            renderSpecials(page, currentItem);

        }).on("click.moreCriticReviews", ".moreCriticReviews", function () {

            renderCriticReviews(page, currentItem);

        });

        reload(page);

    }).on('pagehide', "#itemDetailPage", function () {

        currentItem = null;

        var page = this;

        $(page).off("click.moreScenes").off("click.morePeople").off("click.moreSpecials").off("click.moreCriticReviews");
    });

    function itemDetailPage() {

        var self = this;

        self.play = play;
    }

    window.ItemDetailPage = new itemDetailPage();


})(jQuery, document, LibraryBrowser, window);