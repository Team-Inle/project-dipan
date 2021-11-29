module.exports = function(){
    var express = require('express');
    var router = express.Router();
    var axios = require('axios');
    var shared = require('./shared.js');

    var setPlaylistInfo = function(context, req) {
        context.playlist_name = context.playlists[req.query.ind].name;
        context.playlist_image = context.playlists[req.query.ind].image;
        context.playlist_url = context.playlists[req.query.ind].link;
    }

    // Render /profile on page visit
    router.get('/', function(req, res, next) {
        var context = {};
        shared.userNavBarContext(context, req);
        setPlaylistInfo(context, req);

        // if track data has not yet been saved for this playlist, fetch it
        if(req.session.playlists[req.query.ind].tracks.length < 1) {
            
            var params = new URLSearchParams();
            params.set('offset', 0);

            var headers = {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + req.session.token_data.access_token,
                },
            };

            var tracks = [];
            // get first 50 tracks of the current playlist ID
            axios.get('https://api.spotify.com/v1/playlists/' + req.query.playlistId + '/tracks?' + params.toString(), headers)
                .then(response => {
                    var trackCount = response.data.total;
                    if(response.data.total > 50) {
                        trackCount = 50;
                    }
                    
                    var ids = [];
                    var names = [];
                    var artists = [];
                    var links = [];
                    var images = [];
                    var requests = [];
                    // for each track, get audio features and save to playlists
                    for(let j = 0; j < trackCount; j++) {
                        ids.push(response.data.items[j].track.id);
                        names.push(response.data.items[j].track.name);
                        artists.push(response.data.items[j].track.artists[0].name);
                        links.push(response.data.items[j].track.external_urls.spotify);
                        images.push(response.data.items[j].track.album.images[0].url);

                        let newGet = axios.get('https://api.spotify.com/v1/audio-features/' + response.data.items[j].track.id, headers);
                        requests.push(newGet);
                    }
                    
                    var trackIds = "";
                    for(let j = 0; j < trackCount; j++) {
                        trackIds += ids[j] + ',';
                    }

                    axios.all(requests)
                        .then(axios.spread((...responses) => {
                            daAverage = 0;
                            enAverage = 0;
                            loAverage = 0;
                            spAverage = 0;
                            acAverage = 0;
                            inAverage = 0;
                            liAverage = 0;
                            vaAverage = 0;

                            for (let j = 0; j < responses.length; j++) {
                                tracks.push({
                                    id: ids[j],
                                    name: names[j],
                                    artist: artists[j],
                                    link: links[j],
                                    image: images[j],
                                    danceability: Math.round(responses[j].data.danceability*10000)/100,
                                    energy: Math.round(responses[j].data.energy*10000)/100,
                                    loudness: Math.round((responses[j].data.loudness/-60)*10000)/100,
                                    speechiness: Math.round(responses[j].data.speechiness*10000)/100,
                                    acousticness: Math.round(responses[j].data.acousticness*10000)/100,
                                    instrumentalness: Math.round(responses[j].data.instrumentalness*10000)/100,
                                    liveness: Math.round(responses[j].data.liveness*10000)/100,
                                    valence: Math.round(responses[j].data.valence*10000)/100,
                                });

                                daAverage += tracks[j].danceability;
                                enAverage += tracks[j].energy;
                                loAverage += tracks[j].loudness;
                                spAverage += tracks[j].speechiness;
                                acAverage += tracks[j].acousticness;
                                inAverage += tracks[j].instrumentalness;
                                liAverage += tracks[j].liveness;
                                vaAverage += tracks[j].valence;
                            }

                            req.session.playlists[req.query.ind].tracks = tracks;
                            req.session.playlists[req.query.ind].averages = {
                                da: Math.round(daAverage/responses.length),
                                en: Math.round(enAverage/responses.length),
                                lo: Math.round(loAverage/responses.length),
                                sp: Math.round(spAverage/responses.length),
                                ac: Math.round(acAverage/responses.length),
                                in: Math.round(inAverage/responses.length),
                                li: Math.round(liAverage/responses.length),
                                va: Math.round(vaAverage/responses.length),
                            }

                            var chartParams = new URLSearchParams();
                            chartParams.set('cat1', req.session.playlists[req.query.ind].averages.ac);
                            chartParams.set('cat2', req.session.playlists[req.query.ind].averages.da);
                            chartParams.set('cat3', req.session.playlists[req.query.ind].averages.en);
                            chartParams.set('cat4', req.session.playlists[req.query.ind].averages.in);
                            chartParams.set('cat5', req.session.playlists[req.query.ind].averages.li);
                            chartParams.set('cat6', req.session.playlists[req.query.ind].averages.lo);
                            chartParams.set('cat7', req.session.playlists[req.query.ind].averages.sp);
                            chartParams.set('cat8', req.session.playlists[req.query.ind].averages.va);

                            axios.request({
                                method: 'GET',
                                url: 'https://radarchart-microservice-dennis.herokuapp.com/chart?' + chartParams.toString(),
                                responseType: 'text'
                                })
                                .then(response => {
                                console.log('Request: ', 'https://radarchart-microservice-dennis.herokuapp.com/chart?', chartParams.toString())
                                console.log('---\nResponse: ', response.data);
                                req.session.playlists[req.query.ind].chartUrl = response.data;

                                context.chart_url = req.session.playlists[req.query.ind].chartUrl;
                                context.tracks = tracks;
                                context.averages = req.session.playlists[req.query.ind].averages;
                                context.active_playlist = true;
                                res.render('playlist', context);
                            })
                            .catch(error => {
                                console.log(error);
                            });
                                
                        }))
                        .catch(error => {
                            console.log(error);
                        });
                })
                .catch(error => {
                    console.log(error);
                });
        }
        else {
            // pass user and playlist to page
            context.chart_url = req.session.playlists[req.query.ind].chartUrl;
            context.tracks = req.session.playlists[req.query.ind].tracks;
            context.averages = req.session.playlists[req.query.ind].averages;
            context.active_playlist = true;
            res.render('playlist', context);
        }
    }); 

    return router;
}();