module.exports = function(){
    var express = require('express');
    var router = express.Router();
    var axios = require('axios');

    // Render /profile on page visit
    router.get('/', function(req, res, next) {
        var context = {};
        // if user has logged in, then get user data from Users and Workouts and render profile page
        if(req.session.profile) {
            res.redirect('/profile')
        }
        // if user has not logged in, redirect to home page
        else {
            res.redirect('/login/spotifyAuthLogin');
        }
    }); 

    /**
     * Spotify OAuth Interface - authorization
     */
    router.get('/spotifyAuthLogin', function(req, res) {
        var loginParams = new URLSearchParams();
        loginParams.set('response_type', 'code');
        loginParams.set('client_id', req.app.get('authClient').client_id);
        loginParams.set('redirect_uri', req.app.get('authClient').client_url + '/login/spotifyAuthCallback');
        res.redirect('https://accounts.spotify.com/authorize?' + loginParams.toString());
    });

    /**
     * Spotify OAuth Interface - tokens
     */
    router.get('/spotifyAuthCallback', function(req, res) {
        // if user has accepted the request then autherization code should have been returned
        if (req.query.code) {
            var authTokenParams = new URLSearchParams();
            authTokenParams.set('code', req.query.code);
            authTokenParams.set('redirect_uri', req.app.get('authClient').client_url + '/login/spotifyAuthCallback');
            authTokenParams.set('grant_type', 'authorization_code');
            
            // headers for requesting tokens per Spotify docs
            var authTokenHeaders = {
                headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(req.app.get('authClient').client_id + ':' + req.app.get('authClient').client_secret).toString('base64')
                },
            };
    
            // perform POST request to token API with params and headers
            axios.post('https://accounts.spotify.com/api/token', authTokenParams.toString(), authTokenHeaders)
                .then(response => {
                    // store token data in session
                    req.session.token_data = response.data;
                    res.redirect('/login/fetchProfile');
                })
                .catch(error => {
                    console.log(error);
                });
            }
            // otherwise some error should be sent back
            else if (req.query.error) {
            // ##TODO
            }
            // this should never happen, but if it does - do something
            else {
            // ##TODO
        }
    });

    /**
     * Spotify OAuth Interface - fetch user's profile data
     */
    router.get('/fetchProfile', function(req, res) {
         // if app has user's auth token, then fetch their profile data
        if(req.session.token_data) {
            var authTokenHeaders = {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Bearer ' + req.session.token_data.access_token,
                },
            };
            axios.get('https://api.spotify.com/v1/me', authTokenHeaders)
            .then(response => {
                req.session.profile = response.data;
                res.redirect('/login/fetchPlaylists');
            })
            .catch(error => {
                console.log(error);
            });
        }
        // otherwise re-initiate login & authorization
        else {
            res.redirect('/login');
        }
    });

    /**
     * Spotify OAuth Interface - fetch user's playlist data
     */
    router.get('/fetchPlaylists', function(req, res) {
        if(req.session.token_data) {
            var authTokenHeaders = {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Bearer ' + req.session.token_data.access_token,
                },
            };
            axios.get('https://api.spotify.com/v1/me/playlists', authTokenHeaders)
            .then(response => {
                req.session.playlists = response.data;
                res.redirect('/profile');
            })
            .catch(error => {
                console.log(error);
            });
        }
        // otherwise initiate login & authorization
        else {
            res.redirect('/login');
        }
    });

    return router;
}();