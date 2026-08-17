/**
 * Proximity: where am I, and which units are closest.
 *
 * The plan calls this "navigation", but the useful half needs no routing
 * service at all — every unit already carries coordinates, so distance and
 * ordering are arithmetic on data the page has already downloaded. Travel time
 * and drawn routes need a provider and are a separate decision.
 */
var MapsNearby = (function () {
    var EARTH_RADIUS_M = 6371000;

    function toRadians(degrees) {
        return degrees * Math.PI / 180;
    }

    /** Great-circle distance in metres. */
    function distance(lat1, lng1, lat2, lng2) {
        var dLat = toRadians(lat2 - lat1);
        var dLng = toRadians(lng2 - lng1);
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
    }

    /**
     * Greek units, and Greek decimal punctuation via toLocaleString: under a
     * kilometre in metres, above it in kilometres to one decimal place.
     */
    function format(metres) {
        if (!isFinite(metres)) return '';
        if (metres < 1000) {
            return Math.round(metres / 10) * 10 + ' μ.';
        }
        var km = metres / 1000;
        var digits = km < 100 ? 1 : 0;
        return km.toLocaleString('el-GR', {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
        }) + ' χλμ.';
    }

    /**
     * The `limit` closest features to a point, each annotated with its distance.
     * Features without usable coordinates are skipped rather than sorted to the
     * front as NaN.
     */
    function nearest(features, lat, lng, limit) {
        return (features || [])
            .map(function (feature) {
                var coords = feature.geometry && feature.geometry.coordinates;
                if (!coords) return null;
                var featureLat = Number(coords[1]);
                var featureLng = Number(coords[0]);
                if (!isFinite(featureLat) || !isFinite(featureLng)) return null;
                return {
                    feature: feature,
                    metres: distance(lat, lng, featureLat, featureLng)
                };
            })
            .filter(Boolean)
            .sort(function (a, b) { return a.metres - b.metres; })
            .slice(0, limit || 10);
    }

    /**
     * A map control that asks the browser where the visitor is. Kept separate
     * from what happens next, so the caller decides what to do with the answer.
     */
    function locateControl(options) {
        var control = L.control({ position: options.position || 'bottomright' });

        control.onAdd = function () {
            var wrapper = L.DomUtil.create('div', 'leaflet-bar leaflet-control locate-control');
            var button = L.DomUtil.create('button', '', wrapper);
            button.type = 'button';
            button.id = 'locate-btn';
            button.title = 'Η θέση μου';
            button.setAttribute('aria-label', 'Η θέση μου');
            button.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-locate"></use></svg>';

            L.DomEvent.disableClickPropagation(wrapper);
            L.DomEvent.on(button, 'click', function () {
                locate(button, options);
            });
            return wrapper;
        };

        return control;
    }

    /**
     * A control that turns the next click on the map into a point of reference,
     * so "what is near here" can be asked about anywhere -- a house being looked
     * at, a village someone is moving to -- and not only about where the visitor
     * happens to be standing.
     *
     * It only toggles a mode; the map click and everything downstream of it
     * belong to the caller, which is where the loaded units live.
     */
    function pointControl(options) {
        var control = L.control({ position: options.position || 'bottomright' });

        control.onAdd = function () {
            var wrapper = L.DomUtil.create('div', 'leaflet-bar leaflet-control point-control');
            var button = L.DomUtil.create('button', '', wrapper);
            button.type = 'button';
            button.id = 'point-btn';
            button.title = 'Μονάδες κοντά σε σημείο';
            button.setAttribute('aria-label', 'Μονάδες κοντά σε σημείο');
            button.setAttribute('aria-pressed', 'false');
            button.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-pin"></use></svg>';

            L.DomEvent.disableClickPropagation(wrapper);
            L.DomEvent.on(button, 'click', function () { options.onToggle(); });
            return wrapper;
        };

        return control;
    }

    /**
     * The marker for a point the visitor chose. Draggable, because the first
     * click is rarely exactly the spot meant, and drawn inline rather than from
     * the icon sheet so the teardrop can be filled -- a <use> reference cannot
     * be styled piece by piece.
     */
    function pointMarker(lat, lng) {
        return L.marker([lat, lng], {
            draggable: true,
            keyboard: false,
            zIndexOffset: 1000,
            title: 'Επιλεγμένο σημείο — σύρετέ το για αλλαγή',
            icon: L.divIcon({
                className: 'chosen-pin',
                iconSize: [30, 30],
                iconAnchor: [15, 29],
                html: '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">' +
                      '<path d="M12 22.5S19.5 14.4 19.5 9a7.5 7.5 0 10-15 0c0 5.4 7.5 13.5 7.5 13.5z"' +
                      ' fill="#d93025" stroke="#fff" stroke-width="1.6"/>' +
                      '<circle cx="12" cy="9" r="2.8" fill="#fff"/></svg>'
            })
        });
    }

    function locate(button, options) {
        if (!navigator.geolocation) {
            options.onError('Ο φυλλομετρητής δεν υποστηρίζει γεωεντοπισμό.');
            return;
        }

        button.classList.add('is-busy');
        navigator.geolocation.getCurrentPosition(
            function (position) {
                button.classList.remove('is-busy');
                options.onLocate(position.coords.latitude, position.coords.longitude,
                                 position.coords.accuracy);
            },
            function (error) {
                button.classList.remove('is-busy');
                /* Permission denied is a choice, not a fault: say what happened
                   and leave it there. */
                options.onError(error.code === error.PERMISSION_DENIED
                    ? 'Δεν δόθηκε άδεια πρόσβασης στη θέση σας.'
                    : 'Δεν ήταν δυνατός ο εντοπισμός της θέσης σας.');
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    }

    /**
     * Locates the visitor on load, but only if they have already granted the
     * permission on a previous visit.
     *
     * There is no permission-free way to read a device position: geolocation
     * always prompts. Firing that prompt on page load is a poor trade -- it
     * arrives before the visitor knows what the page is, is usually declined,
     * and in Chrome a request without user activation can be auto-blocked, which
     * would cost us the capability permanently for that person. So: silent for
     * anyone who has already said yes, and the button for everyone else.
     */
    function locateIfPermitted(options) {
        if (!navigator.permissions || !navigator.permissions.query) return;

        navigator.permissions.query({ name: 'geolocation' })
            .then(function (status) {
                if (status.state !== 'granted') return;
                var button = document.getElementById('locate-btn');
                if (button) locate(button, options);
            })
            .catch(function () {
                /* Safari has historically not supported querying this. No harm:
                   the visitor can still press the button. */
            });
    }

    return {
        distance: distance,
        format: format,
        nearest: nearest,
        locateControl: locateControl,
        pointControl: pointControl,
        pointMarker: pointMarker,
        locateIfPermitted: locateIfPermitted
    };
})();
