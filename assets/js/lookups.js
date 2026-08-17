/**
 * Reference lists for the filter controls, read from the registry.
 *
 * These used to be 551 <option> tags typed by hand into main.html. Keeping
 * them there meant every καλλικρατικός change required editing HTML on the
 * web servers, and the lists drifted: 49 options the registry knew about were
 * not offered at all, and the regional-directorate filter pointed at ids the
 * units no longer use.
 *
 * Responses are cached in localStorage, because these lists change a few times
 * a year and the map should not fetch nine of them on every visit.
 */
var MapsLookups = (function () {
    var CACHE_PREFIX = 'maps.lookups.v1.';
    var CACHE_TTL_MS = 24 * 60 * 60 * 1000;

    /* endpoint -> how to read an option out of a row */
    var SOURCES = {
        municipalities:    { id: 'municipality_id',     label: 'municipality' },
        unit_types:        { id: 'unit_type_id',        label: 'unit_type' },
        edu_admins:        { id: 'edu_admin_id',        label: 'edu_admin' },
        region_edu_admins: { id: 'region_edu_admin_id', label: 'region_edu_admin' },
        orientation_types: { id: 'orientation_type_id', label: 'orientation_type' },
        operation_shifts:  { id: 'operation_shift_id',  label: 'operation_shift' },
        education_levels:  { id: 'education_level_id',  label: 'education_level' },
        legal_characters:  { id: 'legal_character_id',  label: 'legal_character' },
        special_types:     { id: 'special_type_id',     label: 'special_type' }
    };

    function readCache(name) {
        try {
            var raw = window.localStorage.getItem(CACHE_PREFIX + name);
            if (!raw) return null;
            var entry = JSON.parse(raw);
            if (!entry || (Date.now() - entry.t) > CACHE_TTL_MS) return null;
            return entry.options;
        } catch (err) {
            return null;
        }
    }

    function writeCache(name, options) {
        try {
            window.localStorage.setItem(CACHE_PREFIX + name,
                JSON.stringify({ t: Date.now(), options: options }));
        } catch (err) {
            /* Private browsing or a full quota. Not worth failing over. */
        }
    }

    /**
     * Resolves to [{ value, label }], sorted by label.
     * Rejects if the list cannot be loaded and nothing is cached.
     */
    function load(name) {
        var source = SOURCES[name];
        if (!source) {
            return Promise.reject(new Error('Unknown lookup: ' + name));
        }

        var cached = readCache(name);
        if (cached) {
            return Promise.resolve(cached);
        }

        return fetch(MapsConfig.baseMMUrl + name)
            .then(function (response) {
                if (!response.ok) throw new Error(name + ': HTTP ' + response.status);
                return response.json();
            })
            .then(function (body) {
                if (body.status !== 200 || !Array.isArray(body.data)) {
                    throw new Error(name + ': ' + (body.message || 'unexpected response'));
                }
                var options = body.data
                    .filter(function (row) { return row[source.id] != null && row[source.label]; })
                    .map(function (row) {
                        return { value: String(row[source.id]), label: String(row[source.label]).trim() };
                    })
                    .sort(function (a, b) { return a.label.localeCompare(b.label, 'el'); });
                writeCache(name, options);
                return options;
            });
    }

    return { load: load, sources: SOURCES };
})();
