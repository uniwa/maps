/**
 * Search-as-you-type over unit names.
 *
 * The dominant task on this map is "find one particular school", and until now
 * that meant typing a name, pressing a button, and reading a list. This turns
 * the name field into what every map has: a box that suggests units as you
 * type, and jumps straight to the one you pick.
 *
 * Suggestions come from the registry rather than a client-side index, because
 * a visitor arriving on a filtered link only has the filtered units in memory,
 * and the whole set is 2.8 MB. Once viewport loading lands (and the payload
 * stops being all-or-nothing) this is worth revisiting.
 */
function MapsSearch(options) {
    var MIN_CHARS = 3;
    var DEBOUNCE_MS = 250;
    var MAX_SUGGESTIONS = 10;

    var input = document.getElementById('search_name');
    var list = document.getElementById('search-suggestions');
    if (!input || !list) return null;

    var state = { items: [], total: 0, activeIndex: -1, timer: null, seq: 0 };

    function close() {
        list.hidden = true;
        list.replaceChildren();
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
        state.items = [];
        state.activeIndex = -1;
    }

    function render() {
        list.replaceChildren();

        state.items.forEach(function (item, index) {
            var option = document.createElement('li');
            option.className = 'suggestion';
            option.id = 'suggestion-' + index;
            option.setAttribute('role', 'option');
            option.setAttribute('aria-selected', index === state.activeIndex ? 'true' : 'false');
            if (index === state.activeIndex) option.classList.add('is-active');
            option.dataset.index = index;
            option.dataset.mmId = item.mmId;
            option.dataset.lat = item.lat;
            option.dataset.lng = item.lng;

            var name = document.createElement('span');
            name.className = 'suggestion-name';
            name.textContent = item.name;
            option.appendChild(name);

            list.appendChild(option);
        });

        /* Say so when the list is truncated, rather than implying these are
           all the matches. role=presentation keeps it out of the listbox. */
        if (state.total > state.items.length) {
            var hint = document.createElement('li');
            hint.className = 'suggestion-hint';
            hint.setAttribute('role', 'presentation');
            hint.textContent = 'και άλλες ' + (state.total - state.items.length) +
                ' μονάδες — πατήστε Αναζήτηση';
            list.appendChild(hint);
        }

        list.hidden = state.items.length === 0;
        input.setAttribute('aria-expanded', state.items.length ? 'true' : 'false');
        var active = list.children[state.activeIndex];
        if (active) {
            input.setAttribute('aria-activedescendant', active.id);
            active.scrollIntoView({ block: 'nearest' });
        } else {
            input.removeAttribute('aria-activedescendant');
        }
    }

    function choose(index) {
        var item = state.items[index];
        if (!item) return;
        input.value = item.name;
        close();
        options.onPick(item);
    }

    function query(term) {
        var seq = ++state.seq;
        fetch(MapsConfig.baseMMUrl + 'units.geojson?state=1&name=' + encodeURIComponent(term))
            .then(function (response) { return response.json(); })
            .then(function (body) {
                /* A slower earlier request must not overwrite a later one */
                if (seq !== state.seq) return;
                var features = (body && body.data && body.data.features) || [];
                state.total = features.length;
                state.items = features.slice(0, MAX_SUGGESTIONS).map(function (feature) {
                    return {
                        mmId: feature.properties.mmId,
                        name: feature.properties.name,
                        lat: feature.geometry.coordinates[1],
                        lng: feature.geometry.coordinates[0]
                    };
                });
                state.activeIndex = -1;
                render();
            })
            .catch(function () {
                if (seq === state.seq) close();
            });
    }

    input.addEventListener('input', function () {
        var term = input.value.trim();
        window.clearTimeout(state.timer);
        if (term.length < MIN_CHARS) {
            close();
            return;
        }
        state.timer = window.setTimeout(function () { query(term); }, DEBOUNCE_MS);
    });

    input.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            close();
            return;
        }
        if (list.hidden || state.items.length === 0) return;

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            var step = event.key === 'ArrowDown' ? 1 : -1;
            state.activeIndex = Math.max(0, Math.min(state.items.length - 1, state.activeIndex + step));
            render();
            event.preventDefault();
        } else if (event.key === 'Enter' && state.activeIndex >= 0) {
            /* Only intercept Enter when a suggestion is highlighted, so
               pressing it otherwise still submits the filter form. */
            choose(state.activeIndex);
            event.preventDefault();
        }
    });

    list.addEventListener('click', function (event) {
        var option = event.target.closest('.suggestion');
        if (!option) return;
        choose(Number(option.dataset.index));
    });

    document.addEventListener('click', function (event) {
        if (!list.hidden && !list.contains(event.target) && event.target !== input) {
            close();
        }
    });

    return { close: close };
}
