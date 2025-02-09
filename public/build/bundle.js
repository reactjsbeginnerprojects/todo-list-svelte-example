
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        text.data = data;
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * Creates an event dispatcher that can be used to dispatch [component events](/docs#template-syntax-component-directives-on-eventname).
     * Event dispatchers are functions that can take two arguments: `name` and `detail`.
     *
     * Component events created with `createEventDispatcher` create a
     * [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent).
     * These events do not [bubble](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events#Event_bubbling_and_capture).
     * The `detail` argument corresponds to the [CustomEvent.detail](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/detail)
     * property and can contain any type of data.
     *
     * https://svelte.dev/docs#run-time-svelte-createeventdispatcher
     */
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail, { cancelable = false } = {}) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail, { cancelable });
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
                return !event.defaultPrevented;
            }
            return true;
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }
    function outro_and_destroy_block(block, lookup) {
        transition_out(block, 1, 1, () => {
            lookup.delete(block.key);
        });
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        const updates = [];
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                // defer updates until all the DOM shuffling is done
                updates.push(() => block.p(child_ctx, dirty));
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        run_all(updates);
        return new_blocks;
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=} start
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0 && stop) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const todos = writable([]);

    // Adds a new todo with a unique id
    function addTodo(text) {
    	todos.update((todos) => [...todos, { id: Date.now(), text, completed: false }]);
    }

    // Toggle the completion status of a todo by id
    function toggleTodo(id) {
    	todos.update((todos) =>
    		todos.map((todo) => (todo.id === id ? { ...todo, completed: !todo.completed } : todo))
    	);
    }

    // Remove a todo by id
    function deleteTodo(id) {
    	todos.update((todos) => todos.filter((todo) => todo.id !== id));
    }

    /* src/lib/TodoInput.svelte generated by Svelte v3.59.2 */

    function create_fragment$4(ctx) {
    	let div;
    	let input;
    	let t0;
    	let button;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			div = element("div");
    			input = element("input");
    			t0 = space();
    			button = element("button");
    			button.textContent = "Add";
    			attr(input, "type", "text");
    			attr(input, "placeholder", "What needs to be done?");
    			attr(input, "class", "svelte-yee6j7");
    			attr(button, "class", "svelte-yee6j7");
    			attr(div, "class", "todo-input svelte-yee6j7");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, input);
    			set_input_value(input, /*newTodo*/ ctx[0]);
    			append(div, t0);
    			append(div, button);

    			if (!mounted) {
    				dispose = [
    					listen(input, "input", /*input_input_handler*/ ctx[2]),
    					listen(input, "keydown", /*keydown_handler*/ ctx[3]),
    					listen(button, "click", /*handleAdd*/ ctx[1])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*newTodo*/ 1 && input.value !== /*newTodo*/ ctx[0]) {
    				set_input_value(input, /*newTodo*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let newTodo = '';

    	function handleAdd() {
    		if (newTodo.trim() !== '') {
    			addTodo(newTodo);
    			$$invalidate(0, newTodo = '');
    		}
    	}

    	function input_input_handler() {
    		newTodo = this.value;
    		$$invalidate(0, newTodo);
    	}

    	const keydown_handler = e => {
    		if (e.key === 'Enter') handleAdd();
    	};

    	return [newTodo, handleAdd, input_input_handler, keydown_handler];
    }

    class TodoInput extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});
    	}
    }

    /* src/lib/TodoItem.svelte generated by Svelte v3.59.2 */

    function create_fragment$3(ctx) {
    	let li;
    	let input;
    	let input_checked_value;
    	let t0;
    	let span;
    	let t1_value = /*todo*/ ctx[0].text + "";
    	let t1;
    	let t2;
    	let button;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			li = element("li");
    			input = element("input");
    			t0 = space();
    			span = element("span");
    			t1 = text(t1_value);
    			t2 = space();
    			button = element("button");
    			button.textContent = "Delete";
    			attr(input, "type", "checkbox");
    			input.checked = input_checked_value = /*todo*/ ctx[0].completed;
    			attr(span, "class", "svelte-1n5wlvs");
    			attr(button, "class", "svelte-1n5wlvs");
    			attr(li, "class", "svelte-1n5wlvs");
    			toggle_class(li, "completed", /*todo*/ ctx[0].completed);
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, input);
    			append(li, t0);
    			append(li, span);
    			append(span, t1);
    			append(li, t2);
    			append(li, button);

    			if (!mounted) {
    				dispose = [
    					listen(input, "change", /*change_handler*/ ctx[1]),
    					listen(button, "click", /*click_handler*/ ctx[2])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*todo*/ 1 && input_checked_value !== (input_checked_value = /*todo*/ ctx[0].completed)) {
    				input.checked = input_checked_value;
    			}

    			if (dirty & /*todo*/ 1 && t1_value !== (t1_value = /*todo*/ ctx[0].text + "")) set_data(t1, t1_value);

    			if (dirty & /*todo*/ 1) {
    				toggle_class(li, "completed", /*todo*/ ctx[0].completed);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(li);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { todo } = $$props;
    	const change_handler = () => toggleTodo(todo.id);
    	const click_handler = () => deleteTodo(todo.id);

    	$$self.$$set = $$props => {
    		if ('todo' in $$props) $$invalidate(0, todo = $$props.todo);
    	};

    	return [todo, change_handler, click_handler];
    }

    class TodoItem extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { todo: 0 });
    	}
    }

    /* src/lib/TodoList.svelte generated by Svelte v3.59.2 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[2] = list[i];
    	return child_ctx;
    }

    // (9:2) {#if filter === 'all' || (filter === 'active' && !todo.completed) || (filter === 'completed' && todo.completed)}
    function create_if_block(ctx) {
    	let todoitem;
    	let current;
    	todoitem = new TodoItem({ props: { todo: /*todo*/ ctx[2] } });

    	return {
    		c() {
    			create_component(todoitem.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(todoitem, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const todoitem_changes = {};
    			if (dirty & /*$todos*/ 2) todoitem_changes.todo = /*todo*/ ctx[2];
    			todoitem.$set(todoitem_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(todoitem.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(todoitem.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(todoitem, detaching);
    		}
    	};
    }

    // (8:1) {#each $todos as todo (todo.id)}
    function create_each_block(key_1, ctx) {
    	let first;
    	let if_block_anchor;
    	let current;
    	let if_block = (/*filter*/ ctx[0] === 'all' || /*filter*/ ctx[0] === 'active' && !/*todo*/ ctx[2].completed || /*filter*/ ctx[0] === 'completed' && /*todo*/ ctx[2].completed) && create_if_block(ctx);

    	return {
    		key: key_1,
    		first: null,
    		c() {
    			first = empty();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			this.first = first;
    		},
    		m(target, anchor) {
    			insert(target, first, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (/*filter*/ ctx[0] === 'all' || /*filter*/ ctx[0] === 'active' && !/*todo*/ ctx[2].completed || /*filter*/ ctx[0] === 'completed' && /*todo*/ ctx[2].completed) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*filter, $todos*/ 3) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(first);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    function create_fragment$2(ctx) {
    	let ul;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let current;
    	let each_value = /*$todos*/ ctx[1];
    	const get_key = ctx => /*todo*/ ctx[2].id;

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	return {
    		c() {
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr(ul, "class", "todo-list svelte-r57ivt");
    		},
    		m(target, anchor) {
    			insert(target, ul, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(ul, null);
    				}
    			}

    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*$todos, filter*/ 3) {
    				each_value = /*$todos*/ ctx[1];
    				group_outros();
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, ul, outro_and_destroy_block, create_each_block, null, get_each_context);
    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(ul);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let $todos;
    	component_subscribe($$self, todos, $$value => $$invalidate(1, $todos = $$value));
    	let { filter = 'all' } = $$props;

    	$$self.$$set = $$props => {
    		if ('filter' in $$props) $$invalidate(0, filter = $$props.filter);
    	};

    	return [filter, $todos];
    }

    class TodoList extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { filter: 0 });
    	}
    }

    /* src/lib/TodoFilters.svelte generated by Svelte v3.59.2 */

    function create_fragment$1(ctx) {
    	let div;
    	let button0;
    	let t1;
    	let button1;
    	let t3;
    	let button2;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			div = element("div");
    			button0 = element("button");
    			button0.textContent = "All";
    			t1 = space();
    			button1 = element("button");
    			button1.textContent = "Active";
    			t3 = space();
    			button2 = element("button");
    			button2.textContent = "Completed";
    			attr(button0, "class", "svelte-1wob7hi");
    			toggle_class(button0, "active", /*currentFilter*/ ctx[0] === 'all');
    			attr(button1, "class", "svelte-1wob7hi");
    			toggle_class(button1, "active", /*currentFilter*/ ctx[0] === 'active');
    			attr(button2, "class", "svelte-1wob7hi");
    			toggle_class(button2, "active", /*currentFilter*/ ctx[0] === 'completed');
    			attr(div, "class", "filters svelte-1wob7hi");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, button0);
    			append(div, t1);
    			append(div, button1);
    			append(div, t3);
    			append(div, button2);

    			if (!mounted) {
    				dispose = [
    					listen(button0, "click", /*click_handler*/ ctx[2]),
    					listen(button1, "click", /*click_handler_1*/ ctx[3]),
    					listen(button2, "click", /*click_handler_2*/ ctx[4])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*currentFilter*/ 1) {
    				toggle_class(button0, "active", /*currentFilter*/ ctx[0] === 'all');
    			}

    			if (dirty & /*currentFilter*/ 1) {
    				toggle_class(button1, "active", /*currentFilter*/ ctx[0] === 'active');
    			}

    			if (dirty & /*currentFilter*/ 1) {
    				toggle_class(button2, "active", /*currentFilter*/ ctx[0] === 'completed');
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	const dispatch = createEventDispatcher();
    	let { currentFilter = 'all' } = $$props;

    	function setFilter(filter) {
    		dispatch('filterChange', filter);
    	}

    	const click_handler = () => setFilter('all');
    	const click_handler_1 = () => setFilter('active');
    	const click_handler_2 = () => setFilter('completed');

    	$$self.$$set = $$props => {
    		if ('currentFilter' in $$props) $$invalidate(0, currentFilter = $$props.currentFilter);
    	};

    	return [currentFilter, setFilter, click_handler, click_handler_1, click_handler_2];
    }

    class TodoFilters extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { currentFilter: 0 });
    	}
    }

    /* src/App.svelte generated by Svelte v3.59.2 */

    function create_fragment(ctx) {
    	let main;
    	let h1;
    	let t1;
    	let todoinput;
    	let t2;
    	let todolist;
    	let t3;
    	let todofilters;
    	let current;
    	todoinput = new TodoInput({});

    	todolist = new TodoList({
    			props: { filter: /*currentFilter*/ ctx[0] }
    		});

    	todofilters = new TodoFilters({
    			props: { currentFilter: /*currentFilter*/ ctx[0] }
    		});

    	todofilters.$on("filterChange", /*handleFilterChange*/ ctx[1]);

    	return {
    		c() {
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "Todo List";
    			t1 = space();
    			create_component(todoinput.$$.fragment);
    			t2 = space();
    			create_component(todolist.$$.fragment);
    			t3 = space();
    			create_component(todofilters.$$.fragment);
    			attr(h1, "class", "svelte-r4xn29");
    			attr(main, "class", "svelte-r4xn29");
    		},
    		m(target, anchor) {
    			insert(target, main, anchor);
    			append(main, h1);
    			append(main, t1);
    			mount_component(todoinput, main, null);
    			append(main, t2);
    			mount_component(todolist, main, null);
    			append(main, t3);
    			mount_component(todofilters, main, null);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const todolist_changes = {};
    			if (dirty & /*currentFilter*/ 1) todolist_changes.filter = /*currentFilter*/ ctx[0];
    			todolist.$set(todolist_changes);
    			const todofilters_changes = {};
    			if (dirty & /*currentFilter*/ 1) todofilters_changes.currentFilter = /*currentFilter*/ ctx[0];
    			todofilters.$set(todofilters_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(todoinput.$$.fragment, local);
    			transition_in(todolist.$$.fragment, local);
    			transition_in(todofilters.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(todoinput.$$.fragment, local);
    			transition_out(todolist.$$.fragment, local);
    			transition_out(todofilters.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(main);
    			destroy_component(todoinput);
    			destroy_component(todolist);
    			destroy_component(todofilters);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let currentFilter = 'all';

    	function handleFilterChange(event) {
    		$$invalidate(0, currentFilter = event.detail);
    	}

    	return [currentFilter, handleFilterChange];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, {});
    	}
    }

    const app = new App({
    	target: document.getElementById('app')
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
