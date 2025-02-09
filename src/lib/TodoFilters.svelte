<script>
	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();
	export let currentFilter = 'all';

	function setFilter(filter) {
		dispatch('filterChange', filter);
	}
</script>

<div class="filters">
	<button on:click={() => setFilter('all')} class:active={currentFilter === 'all'}>All</button>
	<button on:click={() => setFilter('active')} class:active={currentFilter === 'active'}
		>Active</button
	>
	<button on:click={() => setFilter('completed')} class:active={currentFilter === 'completed'}
		>Completed</button
	>
</div>

<style>
	.filters button {
		margin-right: 8px;
		padding: 0.5rem 1rem;
	}
	.filters button.active {
		font-weight: bold;
		text-decoration: underline;
	}
</style>
