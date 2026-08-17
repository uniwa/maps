/**
 * A searchable multi-select, replacing select2.
 *
 * select2 brought jQuery, its own stylesheet and 84 KB to do this. The lists
 * here are at most a few hundred short strings, so a listbox with a filter box
 * covers it.
 *
 * Follows the ARIA combobox-with-listbox pattern: the toggle owns the expanded
 * state, the list is a multi-selectable listbox, and options carry their
 * selected state, so it is usable from the keyboard and announced by screen
 * readers. select2 managed none of that here.
 */
function MapsMultiSelect(container, options) {
    options = options || {};

    var state = {
        items: [],
        selected: [],
        activeIndex: -1,
        open: false
    };

    var id = container.id || ('ms-' + Math.random().toString(36).slice(2, 9));
    var placeholder = options.placeholder || 'Όλα';

    container.classList.add('ms');
    container.innerHTML = '';

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'ms-toggle';
    toggle.id = id + '-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-haspopup', 'listbox');
    if (options.labelledBy) toggle.setAttribute('aria-labelledby', options.labelledBy + ' ' + toggle.id);

    var panel = document.createElement('div');
    panel.className = 'ms-panel';
    panel.hidden = true;

    var search = document.createElement('input');
    search.type = 'search';
    search.className = 'ms-search';
    search.setAttribute('placeholder', 'Αναζήτηση…');
    search.setAttribute('aria-label', 'Αναζήτηση στη λίστα');
    search.setAttribute('autocomplete', 'off');

    var list = document.createElement('ul');
    list.className = 'ms-list';
    list.id = id + '-list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-multiselectable', 'true');
    toggle.setAttribute('aria-controls', list.id);

    var empty = document.createElement('p');
    empty.className = 'ms-empty';
    empty.hidden = true;
    empty.textContent = 'Κανένα αποτέλεσμα';

    panel.appendChild(search);
    panel.appendChild(list);
    panel.appendChild(empty);
    container.appendChild(toggle);
    container.appendChild(panel);

    /* Accents and case should not matter when searching Greek names. */
    function normalize(text) {
        return text.toLocaleLowerCase('el').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function visibleItems() {
        var term = normalize(search.value.trim());
        if (!term) return state.items;
        return state.items.filter(function (item) {
            return normalize(item.label).indexOf(term) !== -1;
        });
    }

    function updateToggle() {
        var count = state.selected.length;
        if (count === 0) {
            toggle.textContent = placeholder;
            toggle.classList.remove('has-value');
        } else if (count === 1) {
            var chosen = state.items.find(function (i) { return i.value === state.selected[0]; });
            toggle.textContent = chosen ? chosen.label : state.selected[0];
            toggle.classList.add('has-value');
        } else {
            toggle.textContent = count + ' επιλεγμένα';
            toggle.classList.add('has-value');
        }
    }

    function renderList() {
        var items = visibleItems();
        list.innerHTML = '';
        items.forEach(function (item, index) {
            var option = document.createElement('li');
            option.className = 'ms-option';
            option.id = id + '-opt-' + item.value;
            option.setAttribute('role', 'option');
            option.dataset.value = item.value;
            var isSelected = state.selected.indexOf(item.value) !== -1;
            option.setAttribute('aria-selected', isSelected ? 'true' : 'false');
            if (index === state.activeIndex) option.classList.add('is-active');
            option.textContent = item.label;
            list.appendChild(option);
        });
        empty.hidden = items.length > 0;
        var active = list.children[state.activeIndex];
        list.setAttribute('aria-activedescendant', active ? active.id : '');
        if (active) active.scrollIntoView({ block: 'nearest' });
    }

    function toggleValue(value) {
        var at = state.selected.indexOf(value);
        if (at === -1) state.selected.push(value);
        else state.selected.splice(at, 1);
        updateToggle();
        renderList();
        container.dispatchEvent(new CustomEvent('change', { bubbles: true }));
    }

    /* The panel is position:fixed, so it has to be placed against the toggle
       each time it opens. Absolute positioning would be clipped by the
       scrolling list of filters. */
    function place() {
        var rect = toggle.getBoundingClientRect();
        var below = window.innerHeight - rect.bottom;
        panel.style.left = rect.left + 'px';
        panel.style.width = rect.width + 'px';
        if (below < 220 && rect.top > below) {
            panel.style.top = 'auto';
            panel.style.bottom = (window.innerHeight - rect.top + 2) + 'px';
            panel.style.maxHeight = Math.max(160, rect.top - 12) + 'px';
        } else {
            panel.style.bottom = 'auto';
            panel.style.top = (rect.bottom + 2) + 'px';
            panel.style.maxHeight = Math.max(160, below - 12) + 'px';
        }
    }

    function open() {
        if (state.open) return;
        state.open = true;
        panel.hidden = false;
        place();
        toggle.setAttribute('aria-expanded', 'true');
        state.activeIndex = -1;
        search.value = '';
        renderList();
        search.focus();
    }

    function close() {
        if (!state.open) return;
        state.open = false;
        panel.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', function () {
        if (state.open) close();
        else open();
    });

    search.addEventListener('input', function () {
        state.activeIndex = -1;
        renderList();
    });

    list.addEventListener('click', function (event) {
        var option = event.target.closest('.ms-option');
        if (option) toggleValue(option.dataset.value);
    });

    container.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && state.open) {
            close();
            toggle.focus();
            event.preventDefault();
            return;
        }
        if (!state.open) return;

        var items = visibleItems();
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            var step = event.key === 'ArrowDown' ? 1 : -1;
            state.activeIndex = Math.max(0, Math.min(items.length - 1, state.activeIndex + step));
            renderList();
            event.preventDefault();
        } else if (event.key === 'Enter' && state.activeIndex >= 0 && items[state.activeIndex]) {
            toggleValue(items[state.activeIndex].value);
            event.preventDefault();
        }
    });

    document.addEventListener('click', function (event) {
        if (state.open && !container.contains(event.target) && !panel.contains(event.target)) {
            close();
        }
    });

    /* Scrolling or resizing would leave a fixed panel detached from its
       toggle, so follow the toggle instead of drifting away from it. */
    window.addEventListener('resize', function () { if (state.open) place(); });
    document.addEventListener('scroll', function () { if (state.open) place(); }, true);

    return {
        element: container,
        setItems: function (items) {
            state.items = items || [];
            /* Drop anything selected that the registry no longer offers. */
            var known = state.items.map(function (i) { return i.value; });
            state.selected = state.selected.filter(function (v) { return known.indexOf(v) !== -1; });
            updateToggle();
            if (state.open) renderList();
        },
        getValue: function () {
            return state.selected.slice();
        },
        setValue: function (values) {
            var wanted = (values == null ? [] : [].concat(values)).map(String);
            var known = state.items.map(function (i) { return i.value; });
            /* Before the lists arrive, keep the requested values as-is so a
               shared URL is not silently emptied by a slow network. */
            state.selected = state.items.length
                ? wanted.filter(function (v) { return known.indexOf(v) !== -1; })
                : wanted;
            updateToggle();
            if (state.open) renderList();
        },
        clear: function () {
            state.selected = [];
            updateToggle();
            if (state.open) renderList();
        }
    };
}
