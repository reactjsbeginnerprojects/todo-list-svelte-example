<script>
	import TodoInput from './lib/TodoInput.svelte';
	import TodoList from './lib/TodoList.svelte';
	import TodoFilters from './lib/TodoFilters.svelte';

	let currentFilter = 'all';

	function handleFilterChange(event) {
		currentFilter = event.detail;
	}
</script>

<main>
	<h1>Todo List</h1>
	<TodoInput />
	<TodoList filter={currentFilter} />
	<TodoFilters {currentFilter} on:filterChange={handleFilterChange} />
</main>

<style>
	main {
		max-width: 600px;
		margin: 2rem auto;
		padding: 1rem;
		font-family: sans-serif;
	}
	h1 {
		text-align: center;
	}
</style>
